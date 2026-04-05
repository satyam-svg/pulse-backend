import mongoose, { type Document, type Types } from 'mongoose';
export interface IComment extends Document {
    video: Types.ObjectId;
    author: Types.ObjectId;
    text: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Comment: mongoose.Model<IComment, {}, {}, {}, mongoose.Document<unknown, {}, IComment, {}, {}> & IComment & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
