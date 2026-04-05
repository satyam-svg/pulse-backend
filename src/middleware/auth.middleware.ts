import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import type { UserRole } from '../models/User.model.js'

interface JwtPayload {
  sub: string
  role: UserRole
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) {
    res.status(401).json({ message: 'Authentication required' })
    return
  }
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload
    req.userId = decoded.sub
    req.userRole = decoded.role
    next()
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}

/** viewer | editor | admin */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userId || !req.userRole) {
      res.status(401).json({ message: 'Authentication required' })
      return
    }
    if (!roles.includes(req.userRole)) {
      res.status(403).json({ message: 'Insufficient permissions' })
      return
    }
    next()
  }
}
