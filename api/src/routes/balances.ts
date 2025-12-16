import { Router, Request, Response } from "express";
import pool from "../db";
import { RedisManager } from "../RedisManager";
import { ON_RAMP } from "../types";

export const balanceRouter = Router();

/**
 * GET user balances (all holdings)
 */
balanceRouter.get("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT 
        b.user_id,
        b.asset_id,
        b.available,
        b.locked,
        a.symbol,
        a.decimals
      FROM balances b
      JOIN assets a ON b.asset_id = a.id
      WHERE b.user_id = $1
      ORDER BY 
        CASE WHEN a.symbol = 'USDC' THEN 0 ELSE 1 END,
        a.symbol`,
      [userId]
    );

    res.json({ balances: result.rows });
  } catch (error) {
    console.error("Error fetching balances:", error);
    res.status(500).json({ error: "Failed to fetch balances" });
  }
});

/**
 * GET user USDC balance only
 */
balanceRouter.get("/:userId/usdc", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT 
        b.user_id,
        b.asset_id,
        b.available,
        b.locked,
        a.symbol,
        a.decimals
      FROM balances b
      JOIN assets a ON b.asset_id = a.id
      WHERE b.user_id = $1 AND a.symbol = 'USDC'`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        balance: {
          available: "0",
          locked: "0",
          symbol: "USDC",
        },
      });
    }

    res.json({ balance: result.rows[0] });
  } catch (error) {
    console.error("Error fetching USDC balance:", error);
    res.status(500).json({ error: "Failed to fetch USDC balance" });
  }
});

/**
 * POST add USDC balance only
 */
balanceRouter.post("/add-usdc", async (req: Request, res: Response) => {
  try {
    const { userId, amount }: { userId: number; amount: string } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({
        error: "userId and amount are required",
      });
    }

    if (parseFloat(amount) <= 0) {
      return res.status(400).json({
        error: "Amount must be greater than 0",
      });
    }

    // Get USDC asset id
    const assetResult = await pool.query(
      `SELECT id FROM assets WHERE symbol = 'USDC'`
    );

    if (assetResult.rows.length === 0) {
      return res.status(404).json({
        error: "USDC asset not found. Please seed assets first.",
      });
    }

    const usdcAssetId: number = assetResult.rows[0].id;

    // Upsert USDC balance
    await pool.query(
      `INSERT INTO balances (user_id, asset_id, available, locked)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (user_id, asset_id)
       DO UPDATE SET available = balances.available + $3`,
      [userId, usdcAssetId, amount]
    );

    // Get updated balance
    const updatedBalance = await pool.query(
      `SELECT 
        b.user_id,
        b.asset_id,
        b.available,
        b.locked,
        a.symbol,
        a.decimals
      FROM balances b
      JOIN assets a ON b.asset_id = a.id
      WHERE b.user_id = $1 AND a.symbol = 'USDC'`,
      [userId]
    );

    RedisManager.getInstance().pushMessage({
      type: ON_RAMP,
      data: {
        amount,
        userId: userId.toString(),
        txnId: (Math.random() * 1000000).toString(),
        asset: "USDC"
      }
    });

    res.json({
      message: "USDC added successfully",
      balance: updatedBalance.rows[0],
    });
  } catch (error) {
    console.error("Error adding USDC:", error);
    res.status(500).json({ error: "Failed to add USDC" });
  }
});


