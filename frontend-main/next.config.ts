import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Proxy all /api/* requests to the Oracle VM backend.
  // This runs on Vercel's edge — the browser never talks directly to the VM.
  // WebSocket (/ws) CANNOT be proxied through Vercel — use api.exchange.bylokesh.in for WS.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://129.159.17.91:8080/api/:path*",
      },
    ];
  },
};

export default nextConfig;
