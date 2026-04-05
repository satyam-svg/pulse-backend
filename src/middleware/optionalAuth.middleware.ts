import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import type { UserRole } from '../models/User.model.js'

interface JwtPayload {
  sub: string
  role: UserRole
}

/** Sets req.userId / req.userRole when Bearer header or `?token=` query is a valid JWT. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  let token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) {
    const q = req.query.token
    token =
      typeof q === 'string'
        ? q
        : Array.isArray(q) && typeof q[0] === 'string'
          ? q[0]
          : undefined
  }
  if (!token) {
    next()
    return
  }
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload
    req.userId = decoded.sub
    req.userRole = decoded.role
  } catch {
    /* invalid token — treat as anonymous */
  }
  next()
}
