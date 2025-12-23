import { Client } from "pg";
import { createClient } from "redis";
import { DbMessage } from "./types";

const pgClient = new Client({
  user: "postgres",
  host: "localhost",
  database: "exchange-platform",
  password: "020802",
  port: 5432,
});
pgClient.connect();

async function main() {
  const redisClient = createClient();
  await redisClient.connect();
  console.log("connected to redis");

  while (true) {
    const response = await redisClient.rPop("db_processor");
    if (!response) continue;

    const data: DbMessage = JSON.parse(response);

    if (data.type === "TRADE_ADDED") {
      const symbol = data.data.market;
      const price = data.data.price;
      const qty = data.data.quantity;
      const isBuyerMaker = data.data.isBuyerMaker;
      const tradeId = data.data.id || null;
      const timestamp = new Date(data.data.timestamp);
      const orderId = data.data.orderId;

      const query = `
        INSERT INTO trades (symbol, price, qty, isBuyerMaker, trade_id, ts, order_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `;

      const values = [
        symbol,
        price,
        qty,
        isBuyerMaker,
        tradeId,
        timestamp,
        orderId
      ];

      await pgClient.query(query, values);
      console.log(`✔ Inserted trade for ${symbol}`);
    }

    if (data.type === "ORDER_PLACED") {
      const query = `
            INSERT INTO orders (id, user_id, symbol, price, qty, side, filled, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO UPDATE SET filled = $7, status = $8
        `;
      const values = [
        data.data.orderId,
        data.data.userId,
        data.data.market,
        data.data.price,
        data.data.quantity,
        data.data.side,
        data.data.executedQty,
        'open' // Default status, might need logic to determine if filled
      ];
      await pgClient.query(query, values);
      console.log(`✔ Inserted/Updated order ${data.data.orderId}`);
    }

    if (data.type === "SNAPSHOT_SAVED") {
      const query = `
            INSERT INTO orderbook_snapshots (market, bids, asks, last_trade_id)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (market) DO UPDATE SET bids = $2, asks = $3, last_trade_id = $4, created_at = NOW()
        `;
      const values = [
        data.data.market,
        JSON.stringify(data.data.bids),
        JSON.stringify(data.data.asks),
        data.data.lastTradeId
      ];
      await pgClient.query(query, values);
      console.log(`✔ Saved snapshot for ${data.data.market}`);
    }
  }
}

main();
