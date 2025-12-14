import { Router } from "express";
import pool from "../db"

pool.connect();

export const tradesRouter = Router();

tradesRouter.get("/", async (req, res) => {
    const { market } = req.query;
    // get from DB
    res.json({});
})


// recent trades 
tradesRouter.get("/recent", async (req, res) => {
    const { market } = req.query;
    const query = `
    SELECT * FROM trades
    WHERE symbol = $1
    ORDER BY ts DESC
    LIMIT 50
    `;
    const values = [market];
    const result = await pool.query(query, values);
    res.json(result.rows);
})

