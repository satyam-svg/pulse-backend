import type { UserRole } from '../models/User.model.js';
export declare function signToken(userId: string, role: UserRole): string;
