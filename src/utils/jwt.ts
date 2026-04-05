import jwt, { type SignOptions } from 'jsonwebtoken'
import { env } from '../config/env.js'
import type { UserRole } from '../models/User.model.js'

export function signToken(userId: string, role: UserRole): string {
  const options: SignOptions = { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] }
  return jwt.sign({ sub: userId, role }, env.jwtSecret, options)
}
