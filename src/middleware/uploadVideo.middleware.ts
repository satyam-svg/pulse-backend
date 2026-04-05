import multer from 'multer'

const storage = multer.memoryStorage()

export const uploadVideoMiddleware = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith('video/')) {
      cb(new Error('Only video files are allowed'))
      return
    }
    cb(null, true)
  },
})
