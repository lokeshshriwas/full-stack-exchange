/**
 * Frontend environment configuration
 * 
 * NEXT_PUBLIC_ prefixed variables are available client-side.
 * These must be set at BUILD TIME for production deployments.
 * 
 * For local development, create a .env.local file:
 *   NEXT_PUBLIC_API_URL=http://localhost:8080
 *   NEXT_PUBLIC_WS_URL=ws://localhost:3001
 */

export const env = {
    // API URLs
    apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001",

    // Derived URLs for convenience
    get apiV1() {
        return `${this.apiUrl}/api/v1`;
    },
    get apiV2() {
        return `${this.apiUrl}/api/v2`;
    },
};
