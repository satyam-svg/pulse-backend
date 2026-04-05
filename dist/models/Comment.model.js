import mongoose, { Schema } from 'mongoose';
const commentSchema = new Schema({
    video: { type: Schema.Types.ObjectId, ref: 'Video', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
}, { timestamps: true });
commentSchema.index({ video: 1, createdAt: -1 });
commentSchema.set('toJSON', {
    transform(_doc, ret) {
        const o = ret;
        delete o.__v;
        o.id = o._id;
        delete o._id;
        return o;
    },
});
export const Comment = mongoose.model('Comment', commentSchema);
