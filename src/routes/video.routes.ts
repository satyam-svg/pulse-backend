import { Router } from 'express'
import { addComment, listComments } from '../controllers/comment.controller.js'
import {
  createVideo,
  deleteVideo,
  getVideo,
  listVideos,
  revokeVideoShare,
  shareVideoWithViewer,
  streamVideo,
  updateVideo,
} from '../controllers/video.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.middleware.js'
import { optionalAuth } from '../middleware/optionalAuth.middleware.js'

const r = Router()

r.get('/', optionalAuth, listVideos)

r.get('/:videoId/comments', optionalAuth, listComments)
r.post('/:videoId/comments', requireAuth, addComment)

r.post('/:id/share', requireAuth, shareVideoWithViewer)
r.delete('/:id/share/:viewerId', requireAuth, revokeVideoShare)

r.get('/:id/stream', optionalAuth, streamVideo)
r.head('/:id/stream', optionalAuth, streamVideo)
r.get('/:id', optionalAuth, getVideo)
r.post('/', requireAuth, requireRole('editor', 'admin'), createVideo)
r.patch('/:id', requireAuth, updateVideo)
r.delete('/:id', requireAuth, deleteVideo)

export default r
