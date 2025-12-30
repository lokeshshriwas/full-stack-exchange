import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
const app = express();
import { depthRouter } from "./routes/depth";
import { tradesRouter } from "./routes/trades";
import { orderRouter } from "./routes/order";
import { balanceRouter } from "./routes/balances";
import { assetsRouter } from "./routes/assets";
import { positionsRouter } from "./routes/positions";
import cors from "cors";
import { userRouter } from "./routes/user";
import cookieParser from "cookie-parser";

// Replace this with the target server URL
const targetUrl = process.env.TARGET_URL;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- THE FIX ---
app.use(cors({
  origin: true,
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
app.use("/api/v2/positions", positionsRouter);

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