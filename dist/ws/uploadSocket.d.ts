import type { Server } from 'node:http';
/** Uploader + all connected admin dashboards receive progress. */
export declare function broadcastUploadEvent(uploaderUserId: string, data: unknown): void;
export declare function attachUploadWebSocket(httpServer: Server): void;
