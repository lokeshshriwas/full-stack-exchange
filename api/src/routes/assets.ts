import { Router, Request, Response } from "express";
import pool from "../db";

const router = Router();

// GET all assets
router.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM assets ORDER BY symbol"
    );
    res.json({ assets: result.rows });
  } catch (error) {
    console.error("Error fetching assets:", error);
    res.status(500).json({ error: "Failed to fetch assets" });
  }
});

// POST seed assets (run once)
router.post("/seed", async (_req: Request, res: Response) => {
  try {
    await pool.query(`
      INSERT INTO assets (symbol, decimals) VALUES
        ('USDC', 6),
        ('BTC', 8),
        ('ETH', 18),
        ('SOL', 9),
        ('BNB', 18),
        ('XRP', 6),
        ('ADA', 6),
        ('DOGE', 8),
        ('MATIC', 18),
        ('AVAX', 18)
      ON CONFLICT (symbol) DO NOTHING
    `);

    res.json({ message: "Assets seeded successfully" });
  } catch (error) {
    console.error("Error seeding assets:", error);
    res.status(500).json({ error: "Failed to seed assets" });
  }
});

export default router;
