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

const redisClient = createClient();

async function main() {
  await pgClient.connect();
  await redisClient.connect();
  console.log("Connected to DB and Redis");

  // Load assets for ID lookup (needed for balances table)
  const assetsMap = new Map<string, number>();
  try {
    const assetsResult = await pgClient.query("SELECT id, symbol FROM assets");
    assetsResult.rows.forEach(row => {
      assetsMap.set(row.symbol, row.id);
    });
    console.log(`Loaded ${assetsMap.size} assets`);
  } catch (e) {
    console.error("Failed to load assets", e);
  }

  // Run processors concurrently
  await Promise.all([
    processTrades(),
    processBalances(assetsMap)
  ]);
}

async function processTrades() {
  // Clone client for blocking operations if needed, or share?
  // Redis client needs to be dedicated if we use blocking pop (brPop)
  // The main redisClient is already connected. Sharing it for single threaded popping is tricky if we want BrPop on multiple keys.
  // It's better to duplicate client for each blocking loop or use non-blocking RPop with sleep.
  // Existing code used RPop in a loop. Let's stick to that for simplicity or create new clients.
  // Create dedicated client for this loop to avoid context switching issues if we switch to blocking later.
  const client = redisClient.duplicate();
  await client.connect();

  while (true) {
    try {
      const response = await client.rPop("db_processor");
      if (!response) {
        await new Promise(r => setTimeout(r, 100)); // Sleep 100ms to avoid CPU spinning
        continue;
      }

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

        // Insert into recent_trades
        const recentQuery = `
                    INSERT INTO recent_trades (market, trade_id, trade_json)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (market, trade_id) DO NOTHING
                `;
        const tradeJson = JSON.stringify({
          tradeId: tradeId,
          isBuyerMaker: isBuyerMaker,
          price: price,
          quantity: qty,
          timestamp: timestamp,
        });
        await pgClient.query(recentQuery, [symbol, tradeId, tradeJson]);

        // Trim recent_trades
        const trimQuery = `
                    DELETE FROM recent_trades
                    WHERE id IN (
                        SELECT id FROM recent_trades
                        WHERE market = $1
                        ORDER BY trade_id DESC
                        OFFSET 100
                    )
                `;
        await pgClient.query(trimQuery, [symbol]);
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
          'open'
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
    } catch (e) {
      console.error("Error processing db message", e);
    }
  }
}

async function processBalances(assetsMap: Map<string, number>) {
  const client = redisClient.duplicate();
  await client.connect();

  while (true) {
    try {
      // Non-blocking pop to coexist nicely, with sleep
      const response = await client.rPop("db_balance_updates");
      if (!response) {
        await new Promise(r => setTimeout(r, 100));
        continue;
      }

      const data = JSON.parse(response);
      const { userId, asset, amountChange, availableChange, lockedChange, type, eventId, timestamp } = data;

      // Resolve Asset ID for balances table
      const assetId = assetsMap.get(asset);

      await pgClient.query("BEGIN");

      // 1. Insert into Ledger
      const ledgerQuery = `
                INSERT INTO balance_ledger (user_id, asset, amount_change, locked_change, type, event_id, timestamp)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `;
      const date = new Date(Number(timestamp));

      await pgClient.query(ledgerQuery, [
        userId, asset, amountChange, lockedChange, type, eventId, date
      ]);

      // 2. Update Balance Snapshot
      if (assetId !== undefined) {
        const balanceQuery = `
                    INSERT INTO balances (user_id, asset_id, available, locked, last_updated_at)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (user_id, asset_id)
                    DO UPDATE SET
                        available = balances.available + $6,
                        locked = balances.locked + $7,
                        last_updated_at = $8
                `;

        await pgClient.query(balanceQuery, [
          userId,
          assetId,
          availableChange,
          lockedChange,
          date,
          availableChange,
          lockedChange,
          date
        ]);
      } else {
        console.warn(`Asset ${asset} not found in map. Skipping balance snapshot update for user ${userId}.`);
        // Consider reloading map or inserting asset if missing
      }

      await pgClient.query("COMMIT");
      console.log(`Synced balance for ${userId} ${asset}`);

    } catch (e) {
      console.error("Error processing balance update:", e);
      await pgClient.query("ROLLBACK");
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

main().catch(console.error);
