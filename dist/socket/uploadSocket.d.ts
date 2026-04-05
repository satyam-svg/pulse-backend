import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
export declare function initUploadSocketIO(httpServer: HttpServer): Server;
/** Uploader + admins (one emit per socket — no duplicate rooms). */
export declare function broadcastUploadEvent(uploaderUserId: string, event: 'upload_progress' | 'upload_complete' | 'upload_error', payload: Record<string, unknown>): void;
