import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { env } from '../config/env.js'
import { Video } from '../models/Video.model.js'
import { broadcastUploadEvent } from '../socket/uploadSocket.js'

const require = createRequire(import.meta.url)
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path as string
const ffprobePath = require('@ffprobe-installer/ffprobe').path as string

const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate'

const LIKELIHOODS = ['UNKNOWN', 'VERY_UNLIKELY', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'VERY_LIKELY'] as const
type Likelihood = (typeof LIKELIHOODS)[number]

function likelihoodScore(s: string | undefined): number {
  if (!s) return 0
  const i = LIKELIHOODS.indexOf(s as Likelihood)
  return i >= 0 ? i : 0
}

/** Flag when adult, violence, or racy is LIKELY or VERY_LIKELY */
function safeSearchIsFlagged(ann: {
  adult?: string
  violence?: string
  racy?: string
}): boolean {
  const threshold = LIKELIHOODS.indexOf('LIKELY')
  return (
    likelihoodScore(ann.adult) >= threshold ||
    likelihoodScore(ann.violence) >= threshold ||
    likelihoodScore(ann.racy) >= threshold
  )
}

function ffprobeDurationSeconds(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffprobePath, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      videoPath,
    ])
    let out = ''
    proc.stdout.on('data', (c: Buffer) => {
      out += c.toString()
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0) {
        resolve(0)
        return
      }
      const n = parseFloat(out.trim())
      resolve(Number.isFinite(n) && n > 0 ? n : 0)
    })
  })
}

function extractFrameAt(videoPath: string, seconds: number, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      ffmpegPath,
      ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(Math.max(0, seconds)), '-i', videoPath, '-frames:v', '1', '-q:v', '3', outPath],
      { stdio: 'ignore' },
    )
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`ffmpeg exited ${code}`))
      else resolve()
    })
  })
}

async function visionSafeSearchImages(apiKey: string, base64Contents: string[]): Promise<boolean> {
  if (base64Contents.length === 0) return false
  const url = `${VISION_URL}?key=${encodeURIComponent(apiKey)}`
  const requests = base64Contents.map((content) => ({
    image: { content },
    features: [{ type: 'SAFE_SEARCH_DETECTION', maxResults: 1 }],
  }))
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  })
  const data = (await res.json()) as {
    responses?: Array<{ safeSearchAnnotation?: { adult?: string; violence?: string; racy?: string }; error?: { message?: string } }>
    error?: { message?: string }
  }
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Vision HTTP ${res.status}`)
  }
  let anyFlagged = false
  for (const r of data.responses ?? []) {
    if (r.error?.message) continue
    const ann = r.safeSearchAnnotation
    if (ann && safeSearchIsFlagged(ann)) anyFlagged = true
  }
  return anyFlagged
}

const VISION_TAG_ALL = ['vision:safe', 'vision:flagged', 'vision:error', 'vision:disabled'] as const

async function applyModerationResult(
  videoId: string,
  userId: string,
  outcome: 'safe' | 'flagged' | 'error' | 'disabled',
): Promise<void> {
  const status: 'safe' | 'flagged' = outcome === 'flagged' ? 'flagged' : 'safe'
  const tag =
    outcome === 'flagged'
      ? 'vision:flagged'
      : outcome === 'safe'
        ? 'vision:safe'
        : outcome === 'error'
          ? 'vision:error'
          : 'vision:disabled'

  await Video.findByIdAndUpdate(videoId, {
    $set: {
      status,
      moderationCheckedAt: new Date(),
    },
    $pullAll: { tags: [...VISION_TAG_ALL] },
    $addToSet: { tags: tag },
  })

  broadcastUploadEvent(userId, 'moderation_complete', {
    videoId,
    status,
    moderationTag: tag,
  })
}

/**
 * After upload returns 100%, decodes the buffer with FFmpeg, samples frames, calls Vision Safe Search,
 * then sets `status` + `tags` (vision:safe / vision:flagged) and notifies the client.
 */
export async function runGoogleVisionModeration(opts: {
  videoId: string
  userId: string
  buffer: Buffer
  /** Duration in seconds from Cloudinary when available */
  durationSec?: number
}): Promise<void> {
  const { videoId, userId, buffer, durationSec } = opts
  const apiKey = env.googleCloudVisionApiKey

  if (!apiKey) {
    await applyModerationResult(videoId, userId, 'disabled')
    return
  }

  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'vsa-mod-'))

  const videoPath = path.join(tmpRoot, `in-${videoId}.mp4`)

  try {
    await writeFile(videoPath, buffer)

    let duration = typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0
    if (duration <= 0) {
      duration = await ffprobeDurationSeconds(videoPath)
    }

    const frameCount = 6
    const offsets: number[] = []
    if (duration <= 0) {
      for (let i = 0; i < frameCount; i++) offsets.push(0.5 + i * 1.0)
    } else {
      const margin = Math.min(1, duration * 0.05)
      const usable = Math.max(duration - 2 * margin, 0.1)
      for (let i = 0; i < frameCount; i++) {
        const t = margin + (usable * i) / Math.max(frameCount - 1, 1)
        offsets.push(t)
      }
    }

    const framePaths: string[] = []
    for (let i = 0; i < offsets.length; i++) {
      const fp = path.join(tmpRoot, `f${i}.jpg`)
      try {
        await extractFrameAt(videoPath, offsets[i]!, fp)
        framePaths.push(fp)
      } catch {
        /* skip bad seek */
      }
    }

    if (framePaths.length === 0) {
      await applyModerationResult(videoId, userId, 'error')
      return
    }

    const base64Batch: string[] = []
    for (const fp of framePaths) {
      try {
        const buf = await readFile(fp)
        base64Batch.push(buf.toString('base64'))
      } catch {
        /* skip */
      }
    }

    if (base64Batch.length === 0) {
      await applyModerationResult(videoId, userId, 'error')
      return
    }

    const flagged = await visionSafeSearchImages(apiKey, base64Batch)
    await applyModerationResult(videoId, userId, flagged ? 'flagged' : 'safe')
  } catch (e) {
    console.error('[moderation]', videoId, e)
    await applyModerationResult(videoId, userId, 'error')
  } finally {
    await rm(tmpRoot, { recursive: true, force: true })
  }
}
