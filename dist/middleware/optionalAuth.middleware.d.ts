import type { NextFunction, Request, Response } from 'express';
/** Sets req.userId / req.userRole when Bearer header or `?token=` query is a valid JWT. */
export declare function optionalAuth(req: Request, _res: Response, next: NextFunction): void;
