import { PassThrough, Readable } from 'node:stream';
import { configureCloudinary, cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';
import { Video } from '../models/Video.model.js';
import { broadcastUploadEvent } from '../socket/uploadSocket.js';
function formatDurationSeconds(sec) {
    if (sec == null || !Number.isFinite(sec))
        return '—';
    const s = Math.floor(sec % 60);
    const m = Math.floor((sec / 60) % 60);
    const h = Math.floor(sec / 3600);
    if (h > 0)
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}
function thumbnailFromResult(result) {
    const eager = result.eager?.[0]?.secure_url;
    if (eager)
        return eager;
    configureCloudinary();
    return cloudinary.url(result.public_id, {
        resource_type: 'video',
        secure: true,
        format: 'jpg',
        transformation: [{ width: 640, height: 360, crop: 'fill', gravity: 'auto', start_offset: 0 }],
    });
}
function emitProgress(userId, uploadId, payload) {
    if (!userId || !uploadId)
        return;
    broadcastUploadEvent(userId, 'upload_progress', {
        uploadId,
        percent: payload.percent,
        phase: payload.phase,
        title: payload.title,
    });
}
/** Server sends 41–100 (single bar: client uses 0–40 for browser→API, then WS continues). */
function throttleEmit(minMs, emit) {
    let lastT = 0;
    let lastPct = -1;
    return (pct) => {
        const now = Date.now();
        if (pct >= 99 || now - lastT >= minMs || Math.abs(pct - lastPct) >= 1) {
            lastT = now;
            lastPct = pct;
            emit(pct);
        }
    };
}
/** Many small chunks so PassThrough emits `data` often → smoother Cloudinary byte progress. */
function chunkBufferReadable(buffer, chunkSize) {
    let offset = 0;
    return new Readable({
        read() {
            if (offset >= buffer.length) {
                this.push(null);
                return;
            }
            const end = Math.min(offset + chunkSize, buffer.length);
            this.push(buffer.subarray(offset, end));
            offset = end;
        },
    });
}
function uploadBufferToCloudinaryWithProgress(buffer, onPercent) {
    configureCloudinary();
    const total = Math.max(buffer.length, 1);
    let written = 0;
    const push = throttleEmit(40, onPercent);
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({
            resource_type: 'video',
            folder: 'video-sensitivity',
            eager: [{ width: 640, height: 360, crop: 'fill', gravity: 'auto', format: 'jpg' }],
            eager_async: false,
        }, (err, result) => {
            if (err) {
                reject(err);
                return;
            }
            if (!result) {
                reject(new Error('Empty Cloudinary response'));
                return;
            }
            onPercent(82);
            resolve(result);
        });
        const pt = new PassThrough();
        pt.on('data', (chunk) => {
            written += chunk.length;
            const streamPct = 41 + Math.floor((written / total) * 37);
            push(Math.min(78, streamPct));
        });
        const chunkSize = 64 * 1024;
        chunkBufferReadable(buffer, chunkSize)
            .on('error', reject)
            .pipe(pt)
            .on('error', reject)
            .pipe(uploadStream)
            .on('error', reject);
    });
}
export async function uploadVideoToCloudinary(req, res, next) {
    const userId = req.userId;
    const uploadId = typeof req.body.uploadId === 'string' ? req.body.uploadId.trim().slice(0, 80) : '';
    try {
        if (!isCloudinaryConfigured()) {
            res.status(503).json({
                message: 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server/.env (copy from Cloudinary dashboard).',
            });
            return;
        }
        if (!req.file?.buffer) {
            res.status(400).json({ message: 'Video file is required (form field name: video)' });
            return;
        }
        const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
        if (!title) {
            res.status(400).json({ message: 'title is required' });
            return;
        }
        const description = typeof req.body.description === 'string' ? req.body.description : '';
        emitProgress(userId, uploadId, {
            percent: 41,
            phase: 'Uploading stream to Cloudinary',
            title,
        });
        const cResult = await uploadBufferToCloudinaryWithProgress(req.file.buffer, (pct) => {
            emitProgress(userId, uploadId, { percent: pct, phase: 'Streaming to Cloudinary', title });
        });
        emitProgress(userId, uploadId, { percent: 85, phase: 'Saving video — publishing', title });
        const videoUrl = cResult.secure_url;
        const thumbnailUrl = thumbnailFromResult(cResult);
        const duration = formatDurationSeconds(cResult.duration);
        const video = await Video.create({
            title,
            description,
            owner: req.userId,
            thumbnailUrl,
            videoUrl,
            duration,
            status: 'safe',
            tags: [],
            isPublished: true,
        });
        await video.populate('owner', 'name channelName avatarUrl');
        const json = video.toJSON();
        emitProgress(userId, uploadId, { percent: 92, phase: 'Saved — updating feed', title });
        emitProgress(userId, uploadId, { percent: 100, phase: 'Published', title });
        if (uploadId && userId) {
            broadcastUploadEvent(userId, 'upload_complete', {
                uploadId,
                title,
                video: json,
            });
        }
        res.status(201).json({ video: json });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed';
        const errTitle = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 200) : '';
        if (uploadId && userId) {
            broadcastUploadEvent(userId, 'upload_error', {
                uploadId,
                title: errTitle || undefined,
                message: msg,
            });
        }
        next(e);
    }
}
