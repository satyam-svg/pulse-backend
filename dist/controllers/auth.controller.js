import bcrypt from 'bcryptjs';
import { User } from '../models/User.model.js';
import { signToken } from '../utils/jwt.js';
export async function register(req, res) {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
        res.status(400).json({ message: 'email, password, and name are required' });
        return;
    }
    const allowed = ['viewer', 'editor', 'admin'];
    const userRole = role && allowed.includes(role) ? role : 'viewer';
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
        email,
        passwordHash,
        name,
        role: userRole,
        channelName: name,
    });
    const token = signToken(user.id, user.role);
    res.status(201).json({ user: user.toJSON(), token });
}
export async function login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ message: 'email and password are required' });
        return;
    }
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user || !user.passwordHash) {
        res.status(401).json({ message: 'Invalid email or password' });
        return;
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
        res.status(401).json({ message: 'Invalid email or password' });
        return;
    }
    const token = signToken(user.id, user.role);
    const safe = await User.findById(user.id);
    res.json({ user: safe?.toJSON(), token });
}
