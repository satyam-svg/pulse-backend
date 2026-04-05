import dotenv from 'dotenv'

dotenv.config()

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (!v) throw new Error(`Missing required env: ${name}`)
  return v
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  mongodbUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY?.trim() ?? '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET?.trim() ?? '',
  /** Google Cloud Vision API key (Safe Search on sampled frames). Optional — if empty, moderation is skipped. */
  googleCloudVisionApiKey: process.env.GOOGLE_CLOUD_VISION_API_KEY?.trim() ?? '',
  /**
   * `proxy` (default): server forwards Range to CDN and streams bytes (206 support).
   * `redirect`: 302 to stored URL (less server bandwidth; Range handled by CDN only).
   */
  videoStreamMode: (process.env.VIDEO_STREAM_MODE ?? 'proxy').toLowerCase() === 'redirect' ? 'redirect' : 'proxy',
}
