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

      if (data.type === "ORDER_UPDATE") {
        try {
          const orderId = data.data.orderId;
          const executedQty = data.data.executedQty;
          const market = data.data.market;
          const price = data.data.price;
          const quantity = data.data.quantity;
          const side = data.data.side;

          if (quantity) {
            // Full update (likely Taker)
            const status = Number(executedQty) === Number(quantity) ? "filled" : "partial";
            const query = `
                INSERT INTO orders (id, user_id, symbol, price, qty, side, filled, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO UPDATE SET filled = $7, status = $8
             `;
            // Note: user_id is missing in data.data for ORDER_UPDATE for Taker in Engine logic?
            // Let's check Engine.ts logic again.
            // Taker update: orderId, executedQty, market, price, quantity, side. MISSING userId.
            // Wait, INSERT requires user_id.
            // If order exists, we don't need user_id for UPDATE.
            // But ON CONFLICT requires valid values for INSERT.

            // If I assume order ALREADY EXISTS (it should, or ORDER_PLACED handles it? 
            // Taker order is created and may be filled immediately. 
            // Engine emits `ORDER_PLACED` (handled above) AND `ORDER_UPDATE`?
            // Engine `createOrder`:
            // 1. `createDbTrades`
            // 2. `updateDbOrders` (emits ORDER_UPDATE)
            // 3. `publishWs...`
            // 4. Returns... then `process` emits `ORDER_PLACED` (via DB queue or API? `process` sends `ORDER_PLACED` to Redis/API but also pushes to DB queue?

            // Check `process` in Engine.ts:
            // ...RedisManager.getInstance().pushMessage({ type: "ORDER_PLACED", data: ... });

            // So `ORDER_PLACED` event acts as the creation.
            // `ORDER_UPDATE` acts as the update.
            // Race condition? 
            // If `ORDER_UPDATE` comes before `ORDER_PLACED`, we might fail if we try to UPDATE non-existent order.
            // But `ORDER_PLACED` is pushed *after* `createOrder` returns.
            // `ORDER_UPDATE` is pushed *inside* `createOrder`.
            // So `ORDER_UPDATE` comes FIRST.
            // Use `market` from update?

            // Only `ORDER_PLACED` has `userId`.
            // So `ORDER_UPDATE` for Taker (New Order) CANNOT insert if it's the first message.

            // This is a problem.
            // Taker order flow:
            // 1. Engine calls `createOrder`.
            // 2. `createOrder` -> `updateDbOrders` -> Pushes `ORDER_UPDATE` (no userId).
            // 3. `createOrder` returns.
            // 4. `process` -> Pushes `ORDER_PLACED` (with userId).

            // If DB worker processes `ORDER_UPDATE` first, it fails to find order?
            // Or I should make `ORDER_UPDATE` handle strict update only?
            // If strict update: `UPDATE orders SET ... WHERE id = ...`
            // If no rows updated -> Order not found.
            // But eventually `ORDER_PLACED` will come and Insert it with correct state?
            // `ORDER_PLACED` has `filled` (executedQty).

            // So `ORDER_PLACED` handles the final state of the Taker order quite well actually.
            // `ORDER_UPDATE` for Taker helps redundant update?
            // But `ORDER_UPDATE` is primarily defining for *fills*.

            // Ideally:
            // 1. Taker Order: `ORDER_PLACED` message contains everything needed.
            // 2. Maker Order: `ORDER_PLACED` came long ago. Now we need `ORDER_UPDATE`.

            // So `ORDER_UPDATE` is CRITICAL for Makers.
            // For Makers, we update existing orders.
            // For Taker, `ORDER_PLACED` handles it.

            // So `ORDER_UPDATE` handler:
            // If it's a Taker update (has quantity, side etc), we can probably ignore it IF we trust `ORDER_PLACED` will arrive with same info.
            // OR better: Update if exists.

            // BUT `ORDER_UPDATE` for Maker (partial info) is essential.

            // Let's update `db/src/index.ts` to handle Maker updates (increment).
            // And handle Taker updates (absolute).

            const updateQuery = quantity
              ? `UPDATE orders SET filled = $1, status = CASE WHEN $1 = $2 THEN 'filled' ELSE 'partial' END WHERE id = $3`
              : `UPDATE orders SET filled = filled + $1, status = CASE WHEN filled + $1 >= qty THEN 'filled' ELSE 'partial' END WHERE id = $2`;

            if (quantity) {
              await pgClient.query(updateQuery, [executedQty, quantity, orderId]);
            } else {
              await pgClient.query(updateQuery, [executedQty, orderId]);
            }
            console.log(`✔ Updated order ${orderId}`);

          } else {
            // Maker update (incremental)
            const updateQuery = `
                    UPDATE orders 
                    SET filled = filled + $1, 
                        status = CASE WHEN filled + $1 >= qty THEN 'filled' ELSE 'partial' END 
                    WHERE id = $2
              `;
            await pgClient.query(updateQuery, [executedQty, orderId]);
            console.log(`✔ Updated fill for order ${orderId}`);
          }
        } catch (e) {
          console.error("Error processing ORDER_UPDATE", e);
        }
      }

      if (data.type === "ORDER_CANCELLED") {
        const orderId = data.data.orderId;
        const query = `
            UPDATE orders SET status = 'cancelled' WHERE id = $1
        `;
        await pgClient.query(query, [orderId]);
        console.log(`✔ Cancelled order ${orderId}`);
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
