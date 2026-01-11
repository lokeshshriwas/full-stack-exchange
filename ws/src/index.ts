import { WebSocketServer } from "ws";
import { UserManager } from "./UserManager";
import { config } from "./config";

console.log(`[WS] Starting WebSocket server on port ${config.ws.port}`);
console.log('[WS] JWT_SECRET loaded:', config.auth.jwtSecret ? 'YES' : 'NO (using default)');

const wss = new WebSocketServer({ port: config.ws.port });

wss.on("connection", (ws) => {
    UserManager.getInstance().addUser(ws);
});

