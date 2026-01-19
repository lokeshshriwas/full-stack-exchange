import dotenv from "dotenv";
dotenv.config();

/**
 * Centralized configuration for the WebSocket server.
 * All environment variables are loaded here with sensible defaults for local development.
 */
export const config = {
    // Redis configuration
    redis: {
        url: process.env.REDIS_URL || "redis://localhost:6379",
    },

    // WebSocket server configuration
    ws: {
        port: parseInt(process.env.WS_PORT || "3001"),
    },

    // Authentication secrets
    auth: {
        jwtSecret: process.env.JWT_SECRET || "password_password",
        refreshSecret: process.env.REFRESH_SECRET || "refresh_secret_password",
    },
};
