import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
const app = express();
import dotenv from "dotenv";
import { depthRouter } from "./routes/depth";
import { tradesRouter } from "./routes/trades";
import { orderRouter } from "./routes/order";
import { balanceRouter } from "./routes/balances";
import { assetsRouter } from "./routes/assets";
import cors from "cors";
import { userRouter } from "./routes/user";
import cookieParser from "cookie-parser";
dotenv.config();

// Replace this with the target server URL
const targetUrl = process.env.TARGET_URL;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- THE FIX ---
app.use(cors({
  origin: function (origin, callback) {
    // 1. Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // 2. Return the origin dynamically. 
    // This tells the browser: "Yes, we allow THIS specific domain" 
    // instead of returning a generic "*"
    return callback(null, true);
  },
  credentials: true, // This allows cookies
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
  })
);

const port = 8080;
app.listen(port, () => {
  console.log(`Proxy server running on http://localhost:${port}`);
});