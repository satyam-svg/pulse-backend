import mongoose, { Schema } from 'mongoose';
const videoSchema = new Schema({
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
    tags: [{ type: String, trim: true }],
}, { timestamps: true });
videoSchema.index({ owner: 1, createdAt: -1 });
videoSchema.index({ title: 'text', description: 'text' });
videoSchema.set('toJSON', {
    transform(_doc, ret) {
        const o = ret;
        delete o.__v;
        o.id = o._id;
        delete o._id;
        return o;
    },
});
export const Video = mongoose.model('Video', videoSchema);
