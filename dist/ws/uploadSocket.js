import jwt from 'jsonwebtoken';
import { WebSocket as WsClient, WebSocketServer } from 'ws';
import { env } from '../config/env.js';
const byUserId = new Map();
const adminSockets = new Set();
const meta = new WeakMap();
function addSocket(ws, userId, role) {
    meta.set(ws, { userId, role });
    let set = byUserId.get(userId);
    if (!set) {
        set = new Set();
        byUserId.set(userId, set);
    }
    set.add(ws);
    if (role === 'admin') {
        adminSockets.add(ws);
    }
}
function removeSocket(ws) {
    const m = meta.get(ws);
    if (!m)
        return;
    meta.delete(ws);
    const set = byUserId.get(m.userId);
    if (set) {
        set.delete(ws);
        if (set.size === 0)
            byUserId.delete(m.userId);
    }
    adminSockets.delete(ws);
}
function safeSend(ws, data) {
    if (ws.readyState !== WsClient.OPEN)
        return;
    try {
        ws.send(JSON.stringify(data));
    }
    catch {
        /* ignore */
    }
}
/** Uploader + all connected admin dashboards receive progress. */
export function broadcastUploadEvent(uploaderUserId, data) {
    const seen = new Set();
    for (const ws of byUserId.get(uploaderUserId) || []) {
        safeSend(ws, data);
        seen.add(ws);
    }
    for (const ws of adminSockets) {
        if (!seen.has(ws))
            safeSend(ws, data);
    }
}
export function attachUploadWebSocket(httpServer) {
    const wss = new WebSocketServer({ noServer: true });
    httpServer.on('upgrade', (request, socket, head) => {
        try {
            const host = request.headers.host ?? 'localhost';
            const url = new URL(request.url ?? '/', `http://${host}`);
            if (url.pathname !== '/ws') {
                socket.destroy();
                return;
            }
            const origin = request.headers.origin;
            if (origin && origin !== env.corsOrigin) {
                socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                socket.destroy();
                return;
            }
            const token = url.searchParams.get('token');
            if (!token) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }
            let decoded;
            try {
                decoded = jwt.verify(token, env.jwtSecret);
            }
            catch {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }
            const userId = decoded.sub;
            const role = decoded.role;
            wss.handleUpgrade(request, socket, head, (ws) => {
                addSocket(ws, userId, role);
                ws.on('close', () => removeSocket(ws));
                ws.on('error', () => removeSocket(ws));
                safeSend(ws, { type: 'connected', role });
            });
        }
        catch {
            socket.destroy();
        }
    });
}
