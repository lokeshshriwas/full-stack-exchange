import { Router } from "express";
import { Client } from "pg"
const pgClient = new Client({
    user: "postgres",
    host: "localhost",
    database: "exchange-platform",
    password: "020802",
    port: 5432,
});
pgClient.connect();

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
    const result = await pgClient.query(query, values);
    res.json(result.rows);
})

