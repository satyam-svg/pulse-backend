import type { NextFunction, Request, Response } from 'express'
import mongoose from 'mongoose'
import multer from 'multer'

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  void next
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ message: 'Video file is too large (max 500MB)' })
      return
    }
    res.status(400).json({ message: err.message })
    return
  }
  if (err instanceof Error && err.message === 'Only video files are allowed') {
    res.status(400).json({ message: err.message })
    return
  }
  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ message: 'Validation failed', details: err.errors })
    return
  }
  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
    res.status(409).json({ message: 'Duplicate key — already exists' })
    return
  }
  const message = err instanceof Error ? err.message : 'Internal server error'
  const status = typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status: number }).status) : 500
  if (status >= 500) {
    console.error(err)
  }
  res.status(status >= 400 && status < 600 ? status : 500).json({ message })
}
