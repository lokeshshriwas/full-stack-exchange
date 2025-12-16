import { Router, Request, Response } from "express";
import pool from "../db";

export const assetsRouter = Router();

// GET all assets
assetsRouter.get("/", async (_req: Request, res: Response) => {
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
assetsRouter.post("/seed", async (_req: Request, res: Response) => {
  try {
    await pool.query(`
      INSERT INTO assets (symbol, decimals) VALUES
        ('USDC', 6),
        ('BTC', 8),
        ('ETH', 18),
        ('BNB', 18),
        ('AAVE', 18),
        ('SOL', 9),
        ('HYPE', 18),
        ('LINK', 18),
        ('TRUMP', 6),
        ('UNI', 18),
        ('XRP', 6),
        ('APT', 8),
        ('SUI', 9),
        ('ZRO', 18),
        ('RENDER', 8),
        ('USDT', 6),
        ('RAY', 6),
        ('0G', 18),
        ('LDO', 18),
        ('WLD', 18),
        ('ONDO', 18),
        ('WIF', 6),
        ('JTO', 9),
        ('MET', 18),
        ('ME', 6),
        ('ENA', 18),
        ('APE', 18),
        ('JUP', 6),
        ('DRIFT', 9),
        ('IO', 18),
        ('WLFI', 18),
        ('XPL', 18),
        ('DOGE', 8),
        ('SEI', 6),
        ('POL', 18),
        ('2Z', 18),
        ('STRK', 18),
        ('FLOCK', 18),
        ('ES', 18),
        ('TNSR', 9),
        ('CLOUD', 18),
        ('WCT', 18),
        ('SONIC', 18),
        ('PIPE', 18),
        ('PYTH', 6),
        ('KMNO', 18),
        ('DEEP', 18),
        ('W', 18),
        ('SWTCH', 18),
        ('BLUE', 18),
        ('MON', 18),
        ('PRCL', 18),
        ('STABLE', 6),
        ('PENGU', 6),
        ('PUMP', 6),
        ('BOME', 6),
        ('WEN', 6),
        ('BONK', 5),
        ('SHIB', 18),
        ('PEPE', 18)
      ON CONFLICT (symbol) DO NOTHING
    `);

    res.json({ message: "Assets seeded successfully" });
  } catch (error) {
    console.error("Error seeding assets:", error);
    res.status(500).json({ error: "Failed to seed assets" });
  }
});


