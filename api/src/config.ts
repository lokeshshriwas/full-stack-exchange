import dotenv from "dotenv";
dotenv.config();

/**
 * Centralized configuration for the API server.
 * All environment variables are loaded here with sensible defaults for local development.
 */
export const config = {
    // Database configuration
    postgres: {
        host: process.env.POSTGRES_HOST || "localhost",
        port: parseInt(process.env.POSTGRES_PORT || "5432"),
        database: process.env.POSTGRES_DB || "exchange-platform",
        user: process.env.POSTGRES_USER || "postgres",
        password: process.env.POSTGRES_PASSWORD || "020802",
    },

    // Redis configuration
    redis: {
        url: process.env.REDIS_URL || "redis://localhost:6379",
    },

    // API server configuration
    api: {
        port: parseInt(process.env.API_PORT || "8080"),
        targetUrl: process.env.TARGET_URL || "https://api.backpack.exchange",
        corsOrigins: process.env.CORS_ORIGINS?.split(",") || ["http://localhost:3000"],
    },

    // Authentication secrets
    auth: {
        jwtSecret: process.env.JWT_SECRET || "secret_password",
        refreshSecret: process.env.REFRESH_SECRET || "refresh_secret_password",
    },

    // Environment
    isProduction: process.env.NODE_ENV === "production",
};
