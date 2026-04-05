import { User } from '../models/User.model.js';
export async function getMe(req, res) {
    const user = await User.findById(req.userId);
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    res.json(user.toJSON());
}
export async function updateMe(req, res) {
    const { name, channelName, channelDescription, avatarUrl } = req.body;
    const user = await User.findById(req.userId);
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    if (name !== undefined)
        user.name = name;
    if (channelName !== undefined)
        user.channelName = channelName;
    if (channelDescription !== undefined)
        user.channelDescription = channelDescription;
    if (avatarUrl !== undefined)
        user.avatarUrl = avatarUrl;
    await user.save();
    res.json(user.toJSON());
}
