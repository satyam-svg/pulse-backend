import type { UserRole } from '../models/User.model.js'

export function ownerIdOf(video: { owner: unknown }): string {
  const o = video.owner
  if (o && typeof o === 'object' && '_id' in o) {
    return String((o as { _id: unknown })._id)
  }
  if (o && typeof o === 'object' && 'id' in o) {
    return String((o as { id: unknown }).id)
  }
  return String(o)
}

export function userInSharedWith(video: { sharedWith?: unknown }, userId?: string): boolean {
  if (!userId) return false
  const raw = video.sharedWith
  if (!Array.isArray(raw)) return false
  return raw.some((entry) => {
    if (entry == null) return false
    if (typeof entry === 'object' && ('_id' in entry || 'id' in entry)) {
      const e = entry as { _id?: unknown; id?: unknown }
      const id = e.id ?? e._id
      return id != null && String(id) === userId
    }
    return String(entry) === userId
  })
}

/** Published → public. Otherwise owner, admin, or explicit share. */
export function canAccessVideoContent(
  video: { owner: unknown; isPublished: boolean; sharedWith?: unknown },
  opts: { userId?: string; userRole?: UserRole },
): boolean {
  if (opts.userRole === 'admin') return true
  if (video.isPublished) return true
  if (!opts.userId) return false
  if (ownerIdOf(video) === opts.userId) return true
  return userInSharedWith(video, opts.userId)
}
