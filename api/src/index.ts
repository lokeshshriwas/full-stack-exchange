import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
const app = express();
import dotenv from "dotenv";
// import { klineRouter } from "./routes/kline";
import { depthRouter } from "./routes/depth";
import { tradesRouter } from "./routes/trades";
// import { tickersRouter } from "./routes/ticker";
import { orderRouter } from "./routes/order";
dotenv.config();

// Replace this with the target server URL
const targetUrl = process.env.TARGET_URL;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// app.use("/api/v2/real-kline", klineRouter);
app.use("/api/v2/depth", depthRouter);
app.use("/api/v2/trades", tradesRouter);
app.use("/api/v2/order", orderRouter);
// app.use('/api/v2/tickers', tickersRouter)

// Handle CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Expose-Headers", "Content-Length, Content-Range");
  next();
});

app.use(
  "/",
  createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    // onProxyReq: (proxyReq, req, res) => {
    //     // Optionally, you can modify the request here
    // },
    // onProxyRes: (proxyRes, req, res) => {
    //     // Optionally, you can modify the response here
    // }
  })
);

const port = 8080;
app.listen(port, () => {
  console.log(`Proxy server running on http://localhost:${port}`);
});
