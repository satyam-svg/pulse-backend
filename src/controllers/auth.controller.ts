import bcrypt from 'bcryptjs'
import type { Request, Response } from 'express'
import { User } from '../models/User.model.js'
import type { UserRole } from '../models/User.model.js'
import { signToken } from '../utils/jwt.js'

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name, role } = req.body as {
    email?: string
    password?: string
    name?: string
    role?: UserRole
  }
  if (!email || !password || !name) {
    res.status(400).json({ message: 'email, password, and name are required' })
    return
  }
  const allowed: UserRole[] = ['viewer', 'editor', 'admin']
  const userRole: UserRole = role && allowed.includes(role) ? role : 'viewer'
  const passwordHash = await bcrypt.hash(password, 12)
  const user = await User.create({
    email,
    passwordHash,
    name,
    role: userRole,
    channelName: name,
  })
  const token = signToken(user.id, user.role)
  res.status(201).json({ user: user.toJSON(), token })
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email?: string; password?: string }
  if (!email || !password) {
    res.status(400).json({ message: 'email and password are required' })
    return
  }
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash')
  if (!user || !user.passwordHash) {
    res.status(401).json({ message: 'Invalid email or password' })
    return
  }
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    res.status(401).json({ message: 'Invalid email or password' })
    return
  }
  const token = signToken(user.id, user.role)
  const safe = await User.findById(user.id)
  res.json({ user: safe?.toJSON(), token })
}
