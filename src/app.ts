import cors from 'cors'
import express from 'express'
import { uploadVideoToCloudinary } from './controllers/videoUpload.controller.js'
import { env } from './config/env.js'
import { requireAuth, requireRole } from './middleware/auth.middleware.js'
import { errorMiddleware } from './middleware/error.middleware.js'
import { uploadVideoMiddleware } from './middleware/uploadVideo.middleware.js'
import apiRoutes from './routes/index.js'

const app = express()

app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  }),
)

/* Mounted on `app` (not under `/api` Router) so `npm start` + stale processes are easier to spot; avoids sub-router ordering surprises. */
app.get('/api/upload/video', (_req, res) => {
  res.status(200).json({
    message:
      'Yeh URL browser se GET mat karo — video bhejne ke liye POST chahiye (multipart, field name: video, Bearer token, title).',
    useMethod: 'POST',
    path: '/api/upload/video',
  })
})

app.post(
  '/api/upload/video',
  requireAuth,
  requireRole('editor', 'admin'),
  uploadVideoMiddleware.single('video'),
  uploadVideoToCloudinary,
)

app.use(express.json({ limit: '2mb' }))

app.use('/api', apiRoutes)

app.use(errorMiddleware)

export default app
