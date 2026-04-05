import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
export function signToken(userId, role) {
    const options = { expiresIn: env.jwtExpiresIn };
    return jwt.sign({ sub: userId, role }, env.jwtSecret, options);
}
