import type { Server as HttpServer } from 'node:http'
import jwt from 'jsonwebtoken'
import { Server } from 'socket.io'
import { env } from '../config/env.js'
import type { UserRole } from '../models/User.model.js'

interface JwtPayload {
  sub: string
  role: UserRole
}

let io: Server | null = null

export function initUploadSocketIO(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: env.corsOrigin,
      credentials: true,
    },
  })

  io.use((socket, next) => {
    const authTok = socket.handshake.auth?.token
    const q = socket.handshake.query.token
    const raw =
      (typeof authTok === 'string' ? authTok : undefined) ??
      (typeof q === 'string' ? q : Array.isArray(q) ? q[0] : undefined)
    if (!raw) {
      next(new Error('Authentication required'))
      return
    }
    try {
      const decoded = jwt.verify(raw, env.jwtSecret) as JwtPayload
      socket.data.userId = decoded.sub
      socket.data.role = decoded.role
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    socket.emit('connected', { role: socket.data.role as UserRole })
  })

  return io
}

/** Uploader + admins (one emit per socket — no duplicate rooms). */
export function broadcastUploadEvent(
  uploaderUserId: string,
  event: 'upload_progress' | 'upload_complete' | 'upload_error' | 'moderation_complete',
  payload: Record<string, unknown>,
): void {
  if (!io) return
  for (const socket of io.sockets.sockets.values()) {
    const uid = socket.data.userId as string | undefined
    const role = socket.data.role as UserRole | undefined
    if (uid === uploaderUserId || role === 'admin') {
      socket.emit(event, payload)
    }
  }
}
