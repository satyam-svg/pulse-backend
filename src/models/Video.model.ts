import mongoose, { type Document, Schema, type Types } from 'mongoose'

export type VideoStatus = 'safe' | 'flagged' | 'processing'

export interface IVideo extends Document {
  title: string
  description: string
  owner: Types.ObjectId
  thumbnailUrl: string
  /** Stored file URL or object key after upload pipeline */
  videoUrl: string
  /** Human-readable e.g. "12:04" or "—" while processing */
  duration: string
  status: VideoStatus
  views: number
  /** If false, hidden from public lists (draft / private) */
  isPublished: boolean
  /** Viewers (and others) granted watch access by the owner */
  sharedWith: Types.ObjectId[]
  tags: string[]
  /** Set after Google Vision (or skip) runs on sampled frames */
  moderationCheckedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const videoSchema = new Schema<IVideo>(
  {
    title: { type: String, required: true, trim: true, maxlength: 500 },
    description: { type: String, default: '', trim: true, maxlength: 5000 },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    thumbnailUrl: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    duration: { type: String, default: '—' },
    status: {
      type: String,
      enum: ['safe', 'flagged', 'processing'],
      default: 'processing',
      index: true,
    },
    views: { type: Number, default: 0, min: 0 },
    isPublished: { type: Boolean, default: true, index: true },
    sharedWith: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    tags: [{ type: String, trim: true }],
    moderationCheckedAt: { type: Date },
  },
  { timestamps: true },
)

videoSchema.index({ owner: 1, createdAt: -1 })
videoSchema.index({ sharedWith: 1, createdAt: -1 })
videoSchema.index({ title: 'text', description: 'text' })

videoSchema.set('toJSON', {
  transform(_doc, ret) {
    const o = ret as unknown as Record<string, unknown>
    delete o.__v
    o.id = o._id
    delete o._id
    if (Array.isArray(o.sharedWith)) {
      o.sharedWith = o.sharedWith.map((x: unknown) => {
        if (x && typeof x === 'object' && ('_id' in x || 'id' in x)) {
          const r = x as Record<string, unknown>
          const id = r.id ?? r._id
          return {
            id: String(id),
            ...(typeof r.name === 'string' ? { name: r.name } : {}),
            ...(typeof r.email === 'string' ? { email: r.email } : {}),
            ...(typeof r.channelName === 'string' ? { channelName: r.channelName } : {}),
          }
        }
        return { id: String(x) }
      })
    }
    return o
  },
})

export const Video = mongoose.model<IVideo>('Video', videoSchema)
