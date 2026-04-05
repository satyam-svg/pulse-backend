import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import videoRoutes from './video.routes.js';
const api = Router();
api.use('/auth', authRoutes);
api.use('/users', userRoutes);
api.use('/videos', videoRoutes);
api.get('/health', (_req, res) => {
    res.json({ ok: true });
});
export default api;
