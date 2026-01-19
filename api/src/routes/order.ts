import { Router } from "express";
import { RedisManager } from "../RedisManager";
import { CREATE_ORDER, CANCEL_ORDER, GET_OPEN_ORDERS } from "../types";
import { authMiddleware, AuthRequest } from "../middleware";
import pool from "../db";

export const orderRouter = Router();

orderRouter.post("/", authMiddleware, async (req: AuthRequest, res) => {
  if (req.body) {
    const { market, price, quantity, side } = req.body;
    const userId = req.userId;
    console.log({ market, price, quantity, side, userId });

    // REMOVED: ENSURE_USER call that was overwriting Redis with stale DB data
    // The Engine already has user balances from login (/auth/me endpoint sends ENSURE_USER once)
    // Fetching from DB here creates a race condition:
    // 1. Fetch stale balance from DB (e.g., 500 USDC)
    // 2. Send ENSURE_USER with stale balance to Engine
    // 3. Engine processes CREATE_ORDER (updates Redis to 499 USDC) ✅
    // 4. ENSURE_USER arrives and overwrites Redis back to 500 USDC ❌
    // Result: Balance shows wrong value and incorrect data persists to DB

    //TODO: can u make the type of the response object right? Right now it is a union.
    const response = await RedisManager.getInstance().sendAndAwait({
      type: CREATE_ORDER,
      data: {
        market,
        price,
        quantity,
        side,
        userId: userId!,
      },
    });
    res.json(response.payload);
  }
});

orderRouter.delete("/", async (req, res) => {
  const { orderId, market } = req.body;
  const response = await RedisManager.getInstance().sendAndAwait({
    type: CANCEL_ORDER,
    data: {
      orderId,
      market,
    },
  });
  res.json(response.payload);
});

orderRouter.get("/open", authMiddleware, async (req: AuthRequest, res) => {
  const response = await RedisManager.getInstance().sendAndAwait({
    type: GET_OPEN_ORDERS,
    data: {
      userId: req.userId!,
      market: req.query.market as string,
    },
  });
  res.json(response.payload);
});

orderRouter.get("/history", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId;
  const response = await pool.query(`
        SELECT * FROM orders 
        WHERE user_id = $1 AND status = 'filled'
        ORDER BY created_at DESC
    `, [userId]);

  res.json(response.rows.map(o => ({
    orderId: o.id,
    market: o.symbol,
    price: o.price,
    quantity: o.qty,
    filled: o.filled,
    side: o.side,
    status: o.status,
    timestamp: o.created_at
  })));
});

orderRouter.get("/", async (req, res) => {
  res.json({ message: "order router working fine" });
});
