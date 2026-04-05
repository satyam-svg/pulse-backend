import type { Request, Response } from 'express';
/**
 * Multi-tenant: no JWT → empty list. Non-admin → only own videos. Admin → all videos.
 */
export declare function listVideos(req: Request, res: Response): Promise<void>;
/**
 * Stream entrypoint: redirects to stored URL (e.g. Cloudinary). CDN handles HTTP Range.
 * Published videos: no JWT required. Unpublished: JWT + owner or admin (`?token=` for `<video src>`).
 */
export declare function streamVideo(req: Request, res: Response): Promise<void>;
export declare function listMyVideos(req: Request, res: Response): Promise<void>;
export declare function getVideo(req: Request, res: Response): Promise<void>;
export declare function createVideo(req: Request, res: Response): Promise<void>;
export declare function updateVideo(req: Request, res: Response): Promise<void>;
export declare function deleteVideo(req: Request, res: Response): Promise<void>;
