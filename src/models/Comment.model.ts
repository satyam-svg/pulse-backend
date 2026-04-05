import mongoose, { type Document, Schema, type Types } from 'mongoose'

export interface IComment extends Document {
  video: Types.ObjectId
  author: Types.ObjectId
  text: string
  createdAt: Date
  updatedAt: Date
}

const commentSchema = new Schema<IComment>(
  {
    video: { type: Schema.Types.ObjectId, ref: 'Video', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
)

commentSchema.index({ video: 1, createdAt: -1 })

commentSchema.set('toJSON', {
  transform(_doc, ret) {
    const o = ret as unknown as Record<string, unknown>
    delete o.__v
    o.id = o._id
    delete o._id
    return o
  },
})

export const Comment = mongoose.model<IComment>('Comment', commentSchema)
