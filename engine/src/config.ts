/**
 * Centralized configuration for the matching engine.
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

    // API URL for fetching initial market data
    api: {
        tickersUrl: process.env.ENGINE_API_URL
            ? `${process.env.ENGINE_API_URL}/api/v1/tickers`
            : "http://localhost:8080/api/v1/tickers",
    },

    // Engine options
    withSnapshot: process.env.WITH_SNAPSHOT === "true",
};
