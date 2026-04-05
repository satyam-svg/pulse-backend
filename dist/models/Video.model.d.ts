import mongoose, { type Document, type Types } from 'mongoose';
export type VideoStatus = 'safe' | 'flagged' | 'processing';
export interface IVideo extends Document {
    title: string;
    description: string;
    owner: Types.ObjectId;
    thumbnailUrl: string;
    /** Stored file URL or object key after upload pipeline */
    videoUrl: string;
    /** Human-readable e.g. "12:04" or "—" while processing */
    duration: string;
    status: VideoStatus;
    views: number;
    /** If false, hidden from public lists (draft / private) */
    isPublished: boolean;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}
export declare const Video: mongoose.Model<IVideo, {}, {}, {}, mongoose.Document<unknown, {}, IVideo, {}, {}> & IVideo & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
