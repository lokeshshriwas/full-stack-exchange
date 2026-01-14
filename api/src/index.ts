import { config } from "./config";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
const app = express();
import { depthRouter } from "./routes/depth";
import { tradesRouter } from "./routes/trades";
import { orderRouter } from "./routes/order";
import { balanceRouter } from "./routes/balances";
import { assetsRouter } from "./routes/assets";
import cors from "cors";
import { userRouter } from "./routes/user";
import cookieParser from "cookie-parser";

// Replace this with the target server URL
const targetUrl = config.api.targetUrl;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- CORS Configuration ---
const corsOrigins = config.api.corsOrigins;
console.log(`[API] CORS allowed origins: ${corsOrigins.join(", ")}`);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (corsOrigins.includes(origin) || corsOrigins.includes("*")) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Content-Length", "X-Requested-With"]
}));

// --- REMOVE THE MANUAL HEADER BLOCK ---
// You previously had app.use((req, res, next) => { ... }) here. 
// DELETE IT. It conflicts with the cors() configuration above.

app.use("/api/v2/depth", depthRouter);
app.use("/api/v2/trades", tradesRouter);
app.use("/api/v2/order", orderRouter);
app.use("/api/v2/auth", userRouter);
app.use("/api/v2/balances", balanceRouter);
app.use("/api/v2/assets", assetsRouter);

app.use(
  "/",
  createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    onProxyRes: (proxyRes: any, req: any, _res: any) => {
      // Add CORS headers to proxied responses
      const origin = req.headers.origin;
      if (origin && (corsOrigins.includes(origin) || corsOrigins.includes("*"))) {
        proxyRes.headers["Access-Control-Allow-Origin"] = origin;
        proxyRes.headers["Access-Control-Allow-Credentials"] = "true";
        proxyRes.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
        proxyRes.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
      }
    }
  } as any)
);

const port = config.api.port;
app.listen(port, () => {
  console.log(`Proxy server running on http://localhost:${port}`);
});