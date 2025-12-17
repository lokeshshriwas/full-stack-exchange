import { Router } from "express";
import { RedisManager } from "../RedisManager";
import { CREATE_ORDER, CANCEL_ORDER, GET_OPEN_ORDERS, ENSURE_USER } from "../types";
import { authMiddleware, AuthRequest } from "../middleware";
import pool from "../db";

export const orderRouter = Router();

orderRouter.post("/", authMiddleware, async (req: AuthRequest, res) => {
  if (req.body) {
    const { market, price, quantity, side } = req.body;
    const userId = req.userId;
    console.log({ market, price, quantity, side, userId });

    if (userId) {
      const balances = await pool.query(`SELECT 
        b.user_id,
        b.asset_id,
        b.available,
        b.locked,
        a.symbol,
        a.decimals
      FROM balances b
      JOIN assets a ON b.asset_id = a.id
      WHERE b.user_id = $1`, [userId]);

      const formattedBalances = balances.rows.reduce((acc, balance) => {
        acc[balance.symbol] = {
          available: Number(balance.available),
          locked: Number(balance.locked)
        };
        return acc;
      }, {});

      RedisManager.getInstance().pushMessage({
        type: ENSURE_USER,
        data: {
          userId: userId,
          balances: formattedBalances
        }
      });
    }

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

orderRouter.get("/open", async (req, res) => {
  const response = await RedisManager.getInstance().sendAndAwait({
    type: GET_OPEN_ORDERS,
    data: {
      userId: req.query.userId as string,
      market: req.query.market as string,
    },
  });
  res.json(response.payload);
});

orderRouter.get("/", async (req, res) => {
  res.json({ message: "order router working fine" });
});
