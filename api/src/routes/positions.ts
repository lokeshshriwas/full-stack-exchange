
import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware";
import pool from "../db";

export const positionsRouter = Router();

positionsRouter.get("/", authMiddleware, async (req: Request, res: Response) => {
    // @ts-ignore
    const userId = req.userId; // authMiddleware populates this

    try {
        const query = `
            SELECT 
                market, 
                side, 
                entry_price, 
                quantity, 
                unrealized_pnl, 
                created_at, 
                updated_at 
            FROM open_positions 
            WHERE user_id = $1
        `;
        const result = await pool.query(query, [userId]);

        res.json({
            success: true,
            data: result.rows.map(row => ({
                market: row.market,
                side: row.side,
                entryPrice: row.entry_price,
                quantity: row.quantity,
                unrealizedPnL: row.unrealized_pnl,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }))
        });
    } catch (e) {
        console.error("Error/positions", e);
        res.status(500).json({ success: false, message: "Internal Error" });
    }
});

positionsRouter.get("/history", authMiddleware, async (req: Request, res: Response) => {
    // @ts-ignore
    const userId = req.userId;

    try {
        const query = `
            SELECT 
                market, 
                side, 
                entry_price, 
                close_price, 
                quantity, 
                realized_pnl, 
                opened_at, 
                closed_at 
            FROM position_history 
            WHERE user_id = $1
            ORDER BY closed_at DESC
            LIMIT 50
        `;
        const result = await pool.query(query, [userId]);

        res.json({
            success: true,
            data: result.rows.map(row => ({
                market: row.market,
                side: row.side,
                entryPrice: row.entry_price,
                closePrice: row.close_price,
                quantity: row.quantity,
                realizedPnL: row.realized_pnl,
                openedAt: row.opened_at,
                closedAt: row.closed_at
            }))
        });
    } catch (e) {
        console.error("Error/positions/history", e);
        res.status(500).json({ success: false, message: "Internal Error" });
    }
});
