import { Video } from '../models/Video.model.js';
/**
 * Multi-tenant: no JWT → empty list. Non-admin → only own videos. Admin → all videos.
 */
export async function listVideos(req, res) {
    if (!req.userId) {
        res.json({ videos: [] });
        return;
    }
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filter = {};
    if (req.userRole !== 'admin') {
        filter.owner = req.userId;
    }
    if (q) {
        filter.$text = { $search: q };
    }
    const videos = await Video.find(filter)
        .sort({ createdAt: -1 })
        .populate('owner', 'name channelName avatarUrl email')
        .limit(200);
    res.json({ videos: videos.map((doc) => doc.toJSON()) });
}
/**
 * Stream entrypoint: redirects to stored URL (e.g. Cloudinary). CDN handles HTTP Range.
 * Published videos: no JWT required. Unpublished: JWT + owner or admin (`?token=` for `<video src>`).
 */
export async function streamVideo(req, res) {
    const video = await Video.findById(req.params.id);
    if (!video) {
        res.status(404).json({ message: 'Video not found' });
        return;
    }
    const url = video.videoUrl?.trim();
    if (!url) {
        res.status(404).json({ message: 'No stream URL' });
        return;
    }
    if (video.isPublished) {
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.redirect(302, url);
        return;
    }
    if (!req.userId) {
        res.status(401).json({ message: 'Authentication required' });
        return;
    }
    const oid = ownerIdOf(video);
    const allowed = oid === req.userId || req.userRole === 'admin';
    if (!allowed) {
        res.status(403).json({ message: 'Not available' });
        return;
    }
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.redirect(302, url);
}
export async function listMyVideos(req, res) {
    const videos = await Video.find({ owner: req.userId })
        .sort({ createdAt: -1 })
        .populate('owner', 'name channelName avatarUrl');
    res.json({ videos: videos.map((doc) => doc.toJSON()) });
}
function ownerIdOf(video) {
    const o = video.owner;
    if (o && typeof o === 'object' && '_id' in o) {
        return String(o._id);
    }
    return String(o);
}
export async function getVideo(req, res) {
    const video = await Video.findById(req.params.id).populate('owner', 'name channelName avatarUrl email');
    if (!video) {
        res.status(404).json({ message: 'Video not found' });
        return;
    }
    const oid = ownerIdOf(video);
    if (!video.isPublished && oid !== req.userId && req.userRole !== 'admin') {
        res.status(403).json({ message: 'Not available' });
        return;
    }
    await Video.updateOne({ _id: video._id }, { $inc: { views: 1 } });
    video.views += 1;
    res.json({ video: video.toJSON() });
}
export async function createVideo(req, res) {
    const { title, description, thumbnailUrl, videoUrl, duration, tags, isPublished } = req.body;
    if (!title) {
        res.status(400).json({ message: 'title is required' });
        return;
    }
    const video = await Video.create({
        title,
        description: typeof description === 'string' ? description : '',
        owner: req.userId,
        thumbnailUrl: typeof thumbnailUrl === 'string' ? thumbnailUrl : '',
        videoUrl: typeof videoUrl === 'string' ? videoUrl : '',
        duration: typeof duration === 'string' ? duration : '—',
        status: 'processing',
        tags: Array.isArray(tags) ? tags : [],
        isPublished: typeof isPublished === 'boolean' ? isPublished : true,
    });
    await video.populate('owner', 'name channelName avatarUrl');
    res.status(201).json({ video: video.toJSON() });
}
export async function updateVideo(req, res) {
    const video = await Video.findById(req.params.id);
    if (!video) {
        res.status(404).json({ message: 'Video not found' });
        return;
    }
    if (String(video.owner) !== req.userId && req.userRole !== 'admin') {
        res.status(403).json({ message: 'Not your video' });
        return;
    }
    const { title, description, thumbnailUrl, videoUrl, duration, status, isPublished, tags } = req.body;
    if (title !== undefined)
        video.title = String(title);
    if (description !== undefined)
        video.description = String(description);
    if (thumbnailUrl !== undefined)
        video.thumbnailUrl = String(thumbnailUrl);
    if (videoUrl !== undefined)
        video.videoUrl = String(videoUrl);
    if (duration !== undefined)
        video.duration = String(duration);
    if (isPublished !== undefined)
        video.isPublished = Boolean(isPublished);
    if (Array.isArray(tags))
        video.tags = tags.map(String);
    if (status !== undefined) {
        const s = String(status);
        if (['safe', 'flagged', 'processing'].includes(s))
            video.status = s;
    }
    await video.save();
    await video.populate('owner', 'name channelName avatarUrl');
    res.json({ video: video.toJSON() });
}
export async function deleteVideo(req, res) {
    const video = await Video.findById(req.params.id);
    if (!video) {
        res.status(404).json({ message: 'Video not found' });
        return;
    }
    if (String(video.owner) !== req.userId && req.userRole !== 'admin') {
        res.status(403).json({ message: 'Not your video' });
        return;
    }
    await video.deleteOne();
    res.status(204).send();
}
