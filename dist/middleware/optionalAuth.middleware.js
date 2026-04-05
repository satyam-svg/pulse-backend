import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
/** Sets req.userId / req.userRole when Bearer header or `?token=` query is a valid JWT. */
export function optionalAuth(req, _res, next) {
    const header = req.headers.authorization;
    let token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
        const q = req.query.token;
        token =
            typeof q === 'string'
                ? q
                : Array.isArray(q) && typeof q[0] === 'string'
                    ? q[0]
                    : undefined;
    }
    if (!token) {
        next();
        return;
    }
    try {
        const decoded = jwt.verify(token, env.jwtSecret);
        req.userId = decoded.sub;
        req.userRole = decoded.role;
    }
    catch {
        /* invalid token — treat as anonymous */
    }
    next();
}
