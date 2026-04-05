import mongoose, { type Document, Schema } from 'mongoose'

export type UserRole = 'viewer' | 'editor' | 'admin'

export interface IUser extends Document {
  email: string
  passwordHash: string
  name: string
  role: UserRole
  /** Optional channel branding (YouTube-style) */
  channelName?: string
  channelDescription?: string
  avatarUrl?: string
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['viewer', 'editor', 'admin'],
      default: 'viewer',
    },
    channelName: { type: String, trim: true },
    channelDescription: { type: String, trim: true, maxlength: 1000 },
    avatarUrl: { type: String, trim: true },
    emailVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
)

userSchema.set('toJSON', {
  transform(_doc, ret) {
    const o = ret as unknown as Record<string, unknown>
    delete o.passwordHash
    delete o.__v
    o.id = o._id
    delete o._id
    return o
  },
})

export const User = mongoose.model<IUser>('User', userSchema)
