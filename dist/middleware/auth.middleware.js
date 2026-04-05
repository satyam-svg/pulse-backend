import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
export function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
        res.status(401).json({ message: 'Authentication required' });
        return;
    }
    try {
        const decoded = jwt.verify(token, env.jwtSecret);
        req.userId = decoded.sub;
        req.userRole = decoded.role;
        next();
    }
    catch {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
}
/** viewer | editor | admin */
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.userId || !req.userRole) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }
        if (!roles.includes(req.userRole)) {
            res.status(403).json({ message: 'Insufficient permissions' });
            return;
        }
        next();
    };
}
