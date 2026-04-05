import type { Request, Response } from 'express'
import { User } from '../models/User.model.js'
import { Video } from '../models/Video.model.js'
import type { VideoStatus } from '../models/Video.model.js'
import { env } from '../config/env.js'
import { canAccessVideoContent, ownerIdOf } from '../utils/videoAccess.js'
import { proxyVideoStreamToResponse } from '../utils/videoStreamProxy.js'

const ownerPopulate = 'name channelName avatarUrl email' as const

function textFilter(q: string): Record<string, unknown> | null {
  if (!q) return null
  return { $text: { $search: q } }
}

/**
 * Admin: `allVideos` (+ legacy `videos`).
 * Editor/viewer: `myVideos`, `sharedWithMe`, and legacy `videos` = both combined (deduped).
 */
export async function listVideos(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    res.json({ videos: [], myVideos: [], sharedWithMe: [] })
    return
  }

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const tf = textFilter(q)

  if (req.userRole === 'admin') {
    const filter: Record<string, unknown> = {}
    if (tf) Object.assign(filter, tf)
    const videos = await Video.find(filter)
      .sort({ createdAt: -1 })
      .populate('owner', ownerPopulate)
      .limit(200)
    const mapped = videos.map((doc) => doc.toJSON())
    res.json({ allVideos: mapped, videos: mapped })
    return
  }

  const myBase: Record<string, unknown> = { owner: req.userId }
  const myFilter = tf ? { $and: [myBase, tf] } : myBase

  const sharedBase: Record<string, unknown> = {
    sharedWith: req.userId,
    owner: { $ne: req.userId },
  }
  const sharedFilter = tf ? { $and: [sharedBase, tf] } : sharedBase

  const [myDocs, sharedDocs] = await Promise.all([
    Video.find(myFilter).sort({ createdAt: -1 }).populate('owner', ownerPopulate).limit(200),
    Video.find(sharedFilter).sort({ createdAt: -1 }).populate('owner', ownerPopulate).limit(200),
  ])

  const myVideos = myDocs.map((d) => d.toJSON())
  const sharedWithMe = sharedDocs.map((d) => {
    const j = d.toJSON() as Record<string, unknown>
    delete j.sharedWith
    return j
  })

  const seen = new Set<string>()
  const videos = [...myVideos, ...sharedWithMe].filter((v) => {
    const id = String(v.id ?? '')
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })

  res.json({ myVideos, sharedWithMe, videos })
}

/**
 * Stream: published → open. Else JWT (`Authorization` or `?token=`) + owner / admin / sharedWith.
 */
export async function streamVideo(req: Request, res: Response): Promise<void> {
  const video = await Video.findById(req.params.id)
  if (!video) {
    res.status(404).json({ message: 'Video not found' })
    return
  }
  const url = video.videoUrl?.trim()
  if (!url) {
    res.status(404).json({ message: 'No stream URL' })
    return
  }
  if (!canAccessVideoContent(video, { userId: req.userId, userRole: req.userRole })) {
    if (!req.userId) {
      res.status(401).json({ message: 'Authentication required' })
      return
    }
    res.status(403).json({ message: 'Not available' })
    return
  }

  const cacheControl = video.isPublished ? 'public, max-age=300' : 'private, max-age=300'

  if (env.videoStreamMode === 'redirect') {
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', cacheControl)
    res.redirect(302, url)
    return
  }

  await proxyVideoStreamToResponse(url, req, res, cacheControl)
}

export async function listMyVideos(req: Request, res: Response): Promise<void> {
  const videos = await Video.find({ owner: req.userId })
    .sort({ createdAt: -1 })
    .populate('owner', 'name channelName avatarUrl')
  res.json({ videos: videos.map((doc) => doc.toJSON()) })
}

export async function getVideo(req: Request, res: Response): Promise<void> {
  const video = await Video.findById(req.params.id).populate('owner', ownerPopulate)
  if (!video) {
    res.status(404).json({ message: 'Video not found' })
    return
  }
  if (!canAccessVideoContent(video, { userId: req.userId, userRole: req.userRole })) {
    res.status(403).json({ message: 'Not available' })
    return
  }

  const oid = ownerIdOf(video)
  const canManageShares = Boolean(req.userId && (oid === req.userId || req.userRole === 'admin'))
  if (canManageShares) {
    await video.populate('sharedWith', 'name email channelName')
  }

  await Video.updateOne({ _id: video._id }, { $inc: { views: 1 } })
  video.views += 1

  const payload = video.toJSON() as Record<string, unknown>
  if (!canManageShares) {
    delete payload.sharedWith
  }
  res.json({ video: payload })
}

export async function createVideo(req: Request, res: Response): Promise<void> {
  const { title, description, thumbnailUrl, videoUrl, duration, tags, isPublished } = req.body as Record<
    string,
    string | boolean | string[] | undefined
  >
  if (!title) {
    res.status(400).json({ message: 'title is required' })
    return
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
    sharedWith: [],
  })
  await video.populate('owner', 'name channelName avatarUrl')
  res.status(201).json({ video: video.toJSON() })
}

export async function updateVideo(req: Request, res: Response): Promise<void> {
  const video = await Video.findById(req.params.id)
  if (!video) {
    res.status(404).json({ message: 'Video not found' })
    return
  }
  if (String(video.owner) !== req.userId && req.userRole !== 'admin') {
    res.status(403).json({ message: 'Not your video' })
    return
  }
  const { title, description, thumbnailUrl, videoUrl, duration, status, isPublished, tags } = req.body as Record<
    string,
    unknown
  >
  if (title !== undefined) video.title = String(title)
  if (description !== undefined) video.description = String(description)
  if (thumbnailUrl !== undefined) video.thumbnailUrl = String(thumbnailUrl)
  if (videoUrl !== undefined) video.videoUrl = String(videoUrl)
  if (duration !== undefined) video.duration = String(duration)
  if (isPublished !== undefined) video.isPublished = Boolean(isPublished)
  if (Array.isArray(tags)) video.tags = tags.map(String)
  if (status !== undefined) {
    const s = String(status) as VideoStatus
    if (['safe', 'flagged', 'processing'].includes(s)) video.status = s
  }
  await video.save()
  await video.populate('owner', 'name channelName avatarUrl')
  res.json({ video: video.toJSON() })
}

export async function deleteVideo(req: Request, res: Response): Promise<void> {
  const video = await Video.findById(req.params.id)
  if (!video) {
    res.status(404).json({ message: 'Video not found' })
    return
  }
  if (String(video.owner) !== req.userId && req.userRole !== 'admin') {
    res.status(403).json({ message: 'Not your video' })
    return
  }
  await video.deleteOne()
  res.status(204).send()
}

export async function shareVideoWithViewer(req: Request, res: Response): Promise<void> {
  const video = await Video.findById(req.params.id)
  if (!video) {
    res.status(404).json({ message: 'Video not found' })
    return
  }
  if (String(video.owner) !== req.userId && req.userRole !== 'admin') {
    res.status(403).json({ message: 'Not your video' })
    return
  }
  const { viewerId } = req.body as { viewerId?: string }
  if (!viewerId?.trim()) {
    res.status(400).json({ message: 'viewerId is required' })
    return
  }
  const viewer = await User.findById(viewerId.trim()).select('_id role')
  if (!viewer || viewer.role !== 'viewer') {
    res.status(400).json({ message: 'Target must be an account with viewer role' })
    return
  }
  if (String(viewer._id) === String(video.owner)) {
    res.status(400).json({ message: 'Cannot share with the owner' })
    return
  }
  const sid = String(viewer._id)
  const ids = (video.sharedWith ?? []).map(String)
  if (!ids.includes(sid)) {
    video.sharedWith.push(viewer._id)
    await video.save()
  }
  await video.populate('owner', ownerPopulate)
  await video.populate('sharedWith', 'name email channelName')
  res.json({ video: video.toJSON() })
}

export async function revokeVideoShare(req: Request, res: Response): Promise<void> {
  const video = await Video.findById(req.params.id)
  if (!video) {
    res.status(404).json({ message: 'Video not found' })
    return
  }
  if (String(video.owner) !== req.userId && req.userRole !== 'admin') {
    res.status(403).json({ message: 'Not your video' })
    return
  }
  const viewerId = req.params.viewerId
  if (!viewerId) {
    res.status(400).json({ message: 'viewerId is required' })
    return
  }
  video.sharedWith = (video.sharedWith ?? []).filter((id) => String(id) !== viewerId)
  await video.save()
  await video.populate('owner', ownerPopulate)
  await video.populate('sharedWith', 'name email channelName')
  res.json({ video: video.toJSON() })
}
