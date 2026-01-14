/**
 * Frontend environment configuration
 * 
 * NEXT_PUBLIC_ prefixed variables are available client-side.
 * These must be set at BUILD TIME for production deployments.
 * 
 * For EC2 same-origin deployment: Set NEXT_PUBLIC_API_URL="" (empty)
 * For local development: NEXT_PUBLIC_API_URL=http://localhost:8080
 */

// Detect if running in browser and determine base URL
const getBaseUrl = () => {
    // If env var is explicitly set, use it
    if (process.env.NEXT_PUBLIC_API_URL !== undefined) {
        return process.env.NEXT_PUBLIC_API_URL;
    }
    // In browser, use same origin (empty string)
    if (typeof window !== 'undefined') {
        return '';
    }
    // Server-side default
    return 'http://localhost:8080';
};

const getWsUrl = () => {
    // If env var is explicitly set, use it
    if (process.env.NEXT_PUBLIC_WS_URL !== undefined) {
        return process.env.NEXT_PUBLIC_WS_URL;
    }
    // In browser, construct WebSocket URL from current origin with /ws path
    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/ws`;
    }
    // Server-side default
    return 'ws://localhost:3001';
};

export const env = {
    // API URLs - empty string means same origin
    apiUrl: getBaseUrl(),
    wsUrl: getWsUrl(),

    // Derived URLs for convenience
    get apiV1() {
        return `${this.apiUrl}/api/v1`;
    },
    get apiV2() {
        return `${this.apiUrl}/api/v2`;
    },
};

