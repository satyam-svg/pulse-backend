import http from 'node:http';
import app from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { initUploadSocketIO } from './socket/uploadSocket.js';
async function main() {
    await connectDatabase();
    const httpServer = http.createServer(app);
    initUploadSocketIO(httpServer);
    httpServer.listen(env.port, () => {
        console.log(`API listening on http://localhost:${env.port}`);
        console.log(`Health: http://localhost:${env.port}/api/health`);
        console.log(`Upload: POST http://localhost:${env.port}/api/upload/video`);
        console.log(`Socket.io: same origin + path /socket.io (auth.token = JWT)`);
    });
    httpServer.timeout = 900_000;
    httpServer.headersTimeout = 905_000;
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
