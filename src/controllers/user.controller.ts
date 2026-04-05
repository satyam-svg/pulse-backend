import type { Request, Response } from 'express'
import { User } from '../models/User.model.js'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.userId)
  if (!user) {
    res.status(404).json({ message: 'User not found' })
    return
  }
  res.json(user.toJSON())
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const { name, channelName, channelDescription, avatarUrl } = req.body as Record<string, string | undefined>
  const user = await User.findById(req.userId)
  if (!user) {
    res.status(404).json({ message: 'User not found' })
    return
  }
  if (name !== undefined) user.name = name
  if (channelName !== undefined) user.channelName = channelName
  if (channelDescription !== undefined) user.channelDescription = channelDescription
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl
  await user.save()
  res.json(user.toJSON())
}

/** Editor/admin: list viewer-role accounts for sharing videos. */
export async function listViewers(req: Request, res: Response): Promise<void> {
  if (req.userRole !== 'editor' && req.userRole !== 'admin') {
    res.status(403).json({ message: 'Insufficient permissions' })
    return
  }
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const filter: Record<string, unknown> = { role: 'viewer' }
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ email: rx }, { name: rx }]
  }
  const users = await User.find(filter).select('name email channelName role').limit(50).lean()
  res.json({
    users: users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      channelName: u.channelName,
      role: u.role,
    })),
  })
}
