import { Comment } from '../models/Comment.model.js';
import { Video } from '../models/Video.model.js';
export async function listComments(req, res) {
    const videoId = req.params.videoId;
    const video = await Video.findById(videoId);
    if (!video) {
        res.status(404).json({ message: 'Video not found' });
        return;
    }
    const comments = await Comment.find({ video: video._id })
        .sort({ createdAt: -1 })
        .populate('author', 'name avatarUrl')
        .limit(200);
    res.json({ comments: comments.map((c) => c.toJSON()) });
}
export async function addComment(req, res) {
    const { text } = req.body;
    if (!text?.trim()) {
        res.status(400).json({ message: 'text is required' });
        return;
    }
    const videoId = req.params.videoId;
    const video = await Video.findById(videoId);
    if (!video) {
        res.status(404).json({ message: 'Video not found' });
        return;
    }
    const comment = await Comment.create({
        video: video._id,
        author: req.userId,
        text: text.trim(),
    });
    await comment.populate('author', 'name avatarUrl');
    res.status(201).json({ comment: comment.toJSON() });
}
