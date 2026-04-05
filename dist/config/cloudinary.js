import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';
export function isCloudinaryConfigured() {
    return Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);
}
export function configureCloudinary() {
    cloudinary.config({
        cloud_name: env.cloudinaryCloudName,
        api_key: env.cloudinaryApiKey,
        api_secret: env.cloudinaryApiSecret,
    });
}
export { cloudinary };
