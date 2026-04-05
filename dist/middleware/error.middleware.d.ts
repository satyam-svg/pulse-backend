import type { NextFunction, Request, Response } from 'express';
export declare function errorMiddleware(err: unknown, _req: Request, res: Response, next: NextFunction): void;
