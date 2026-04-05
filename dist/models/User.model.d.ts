import mongoose, { type Document } from 'mongoose';
export type UserRole = 'viewer' | 'editor' | 'admin';
export interface IUser extends Document {
    email: string;
    passwordHash: string;
    name: string;
    role: UserRole;
    /** Optional channel branding (YouTube-style) */
    channelName?: string;
    channelDescription?: string;
    avatarUrl?: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, {}> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
