import type { UserRole } from '../models/User.model.js'

declare global {
  namespace Express {
    interface Request {
      userId?: string
      userRole?: UserRole
    }
  }
}

export {}
