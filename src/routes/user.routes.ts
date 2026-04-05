import { Router } from 'express'
import { listMyVideos } from '../controllers/video.controller.js'
import { getMe, listViewers, updateMe } from '../controllers/user.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const r = Router()

r.get('/viewers', requireAuth, listViewers)
r.get('/me', requireAuth, getMe)
r.patch('/me', requireAuth, updateMe)
r.get('/me/videos', requireAuth, listMyVideos)

export default r
