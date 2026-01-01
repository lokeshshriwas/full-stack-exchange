import { WebSocketServer } from "ws";
import { UserManager } from "./UserManager";
import dotenv from "dotenv";

// Load environment variables FIRST
dotenv.config();

console.log('[WS] Starting WebSocket server on port 3001');
console.log('[WS] JWT_SECRET loaded:', process.env.JWT_SECRET ? 'YES' : 'NO (using default)');

const wss = new WebSocketServer({ port: 3001 });

wss.on("connection", (ws) => {
    UserManager.getInstance().addUser(ws);
});

