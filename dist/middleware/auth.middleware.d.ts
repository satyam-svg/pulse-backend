import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '../models/User.model.js';
export declare function requireAuth(req: Request, res: Response, next: NextFunction): void;
/** viewer | editor | admin */
export declare function requireRole(...roles: UserRole[]): (req: Request, res: Response, next: NextFunction) => void;
