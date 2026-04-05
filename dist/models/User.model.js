import mongoose, { Schema } from 'mongoose';
const userSchema = new Schema({
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
}, { timestamps: true });
userSchema.set('toJSON', {
    transform(_doc, ret) {
        const o = ret;
        delete o.passwordHash;
        delete o.__v;
        o.id = o._id;
        delete o._id;
        return o;
    },
});
export const User = mongoose.model('User', userSchema);
