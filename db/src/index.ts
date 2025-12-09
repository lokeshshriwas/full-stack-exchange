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
  }
}

main();
