import fs from "fs";
import { RedisManager } from "../RedisManager";
import { ORDER_UPDATE, TRADE_ADDED } from "../types/index";
import { OrderPlacedMessage } from "../types/toWs";
import { CANCEL_ORDER, CREATE_ORDER, GET_DEPTH, GET_OPEN_ORDERS, MessageFromApi, ON_RAMP, ENSURE_USER } from "../types/fromApi";
import { Fill, Order, Orderbook } from "./Orderbook";
import axios from "axios";
import { Ticker } from "../types/toApi";
import { config } from "../config";

export const BASE_CURRENCY = "USDC";



interface MarketConfig {
  baseAsset: string;
  quoteAsset: string;
  ticker: string;
}

export class Engine {
  private orderbooks: Orderbook[] = [];
  private supportedMarkets: Map<string, MarketConfig> = new Map();
  static initializeMarkets: boolean = false;

  constructor() {
    // Initialization moved to init() method
  }

  async init() {
    if (!Engine.initializeMarkets) {
      await this.initializeSupportedMarkets();
      Engine.initializeMarkets = true;
    }

    // Try to load from DB first
    const pgClient = new (require("pg").Client)({
      user: config.postgres.user,
      host: config.postgres.host,
      database: config.postgres.database,
      password: config.postgres.password,
      port: config.postgres.port,
    });

    try {
      await pgClient.connect();
      console.log("Connected to DB from Engine");

      // Load Snapshots
      const result = await pgClient.query("SELECT * FROM orderbook_snapshots");
      const snapshots = result.rows;

      if (snapshots.length > 0) {
        console.log(`Found ${snapshots.length} snapshots in DB`);
        snapshots.forEach((s: any) => {
          const orderbook = new Orderbook(
            s.market.split("_")[0],
            s.bids,
            s.asks,
            s.last_trade_id,
            0, // currentPrice - not stored in snapshot table currently?
            s.market.split("_")[1]
          );
          this.orderbooks.push(orderbook);
        });
        // Also need to load balances? For now, we rely on Redis for balances or snapshot.json fallback?
        // Requirement says "Restore Order books and User balances".
        // Since we haven't implemented balance snapshots in DB explicitly yet (just the table), 
        // we might check if we can query balances table directly if we populated it?
        // But the seed script re-created balances table.
        // Let's stick to the prompt requirement: "Load latest snapshot from DB".

        // If we assume balances are in 'balances' table.

        // Load recent trades from DB to restore Redis List
        console.log("Loading recent trades from DB...");
        const recentTradesResult = await pgClient.query("SELECT market, trade_json FROM recent_trades ORDER BY created_at ASC");
        for (const row of recentTradesResult.rows) {
          const trade = row.trade_json;
          const market = row.market;

          const tradePayload = {
            e: "trade" as "trade",
            t: trade.tradeId,
            m: trade.isBuyerMaker,
            p: trade.price,
            q: trade.quantity,
            s: market,
            T: trade.timestamp
          };

          // Re-populate Engine/Orderbook trades array (if we want internal history)
          const ob = this.orderbooks.find(o => o.ticker() === market);
          if (ob) {
            if (!ob.trades.find(t => t.tradeId === trade.tradeId)) {
              ob.trades.push({
                price: trade.price,
                quantity: trade.quantity,
                tradeId: trade.tradeId,
                timestamp: trade.timestamp,
                isBuyerMaker: trade.isBuyerMaker
              });
            }
          }

          // Restore Redis LIST
          await RedisManager.getInstance().pushToQueue(`trades_snapshot:${market}`, JSON.stringify(tradePayload));
        }

        // Trim queues to ensure limit
        for (const ob of this.orderbooks) {
          await RedisManager.getInstance().trimQueue(`trades_snapshot:${ob.ticker()}`, 100);
        }

      } else {

        // Fallback to snapshot.json
        let snapshot = null;
        try {
          if (config.withSnapshot) {
            snapshot = fs.readFileSync("./snapshot.json");
          }
        } catch (e) {
          console.log("No partial snapshot found");
        }

        if (snapshot) {
          const snapshotSnapshot = JSON.parse(snapshot.toString());
          this.orderbooks = snapshotSnapshot.orderbooks.map((o: any) =>
            new Orderbook(o.baseAsset, o.bids, o.asks, o.lastTradeId, o.currentPrice, o.quoteAsset, o.trades)
          );

          if (snapshotSnapshot.supportedMarkets) {
            this.supportedMarkets = new Map(snapshotSnapshot.supportedMarkets);
          }
        } else {
          this.initializeOrderbooks();
        }
      }
      await pgClient.end();

    } catch (e) {
      console.log("DB Connection failed, falling back to file snapshot", e);
      // Fallback logic duplicated here or just proceed?
      this.initializeOrderbooks(); // Simple fallback for now to avoid blocking
    }

    setInterval(() => {
      this.saveSnapshot();
    }, 1000 * 3);
  }

  private async initializeSupportedMarkets() {
    try {
      const fetchMarkets = await axios.get<Ticker[]>(config.api.tickersUrl);
      const markets: MarketConfig[] = fetchMarkets.data
        .filter((t: Ticker) => !t.symbol.endsWith("PERP"))
        .map((t: Ticker) => {
          const [baseAsset, quoteAsset] = t.symbol.split("_");
          return {
            baseAsset,
            quoteAsset,
            ticker: t.symbol,
          };
        });
      markets.forEach(market => {
        this.supportedMarkets.set(market.ticker, market);
      });
    } catch (e) {
      console.log("Failed to fetch markets from API", e);
    }
  }

  private initializeOrderbooks() {
    this.supportedMarkets.forEach((config) => {
      const orderbook = new Orderbook(
        config.baseAsset,
        [],
        [],
        0,
        0,
        config.quoteAsset
      );
      this.orderbooks.push(orderbook);
      console.log(`Initialized orderbook for ${config.ticker}`);
    });
  }

  addMarket(baseAsset: string, quoteAsset: string): boolean {
    const ticker = `${baseAsset}_${quoteAsset}`;

    if (this.supportedMarkets.has(ticker)) {
      console.log(`Market ${ticker} already exists`);
      return false;
    }

    this.supportedMarkets.set(ticker, { baseAsset, quoteAsset, ticker });
    const orderbook = new Orderbook(baseAsset, [], [], 0, 0, quoteAsset);
    this.orderbooks.push(orderbook);

    console.log(`Added new market: ${ticker}`);
    return true;
  }

  getSupportedMarkets(): string[] {
    return Array.from(this.supportedMarkets.keys());
  }

  isMarketSupported(market: string): boolean {
    return this.supportedMarkets.has(market);
  }

  getMarketConfig(market: string): MarketConfig | undefined {
    return this.supportedMarkets.get(market);
  }

  saveSnapshot() {
    const snapshotSnapshot = {
      orderbooks: this.orderbooks.map(o => o.getSnapshot()),
      supportedMarkets: Array.from(this.supportedMarkets.entries())
    };
    fs.writeFileSync("./snapshot.json", JSON.stringify(snapshotSnapshot));

    this.orderbooks.forEach(o => {
      RedisManager.getInstance().set(`orderbook_snapshot:${o.ticker()}`, JSON.stringify(o.getSnapshot()));
      RedisManager.getInstance().set(`depth_snapshot:${o.ticker()}`, JSON.stringify(o.getDepth()));
      RedisManager.getInstance().set(`orderbook_snapshot:${o.ticker()}`, JSON.stringify(o.getSnapshot()));
      RedisManager.getInstance().set(`depth_snapshot:${o.ticker()}`, JSON.stringify(o.getDepth()));
      // RedisManager.getInstance().set(`trades_snapshot:${o.ticker()}`, JSON.stringify(o.trades)); // Removed, using List instead

      RedisManager.getInstance().pushMessage({
        type: "SNAPSHOT_SAVED",
        data: {
          market: o.ticker(),
          bids: o.bids,
          asks: o.asks,
          lastTradeId: o.lastTradeId
        }
      });
    });
  }

  async process({ message, clientId }: { message: MessageFromApi, clientId: string }) {
    switch (message.type) {
      case CREATE_ORDER:
        try {
          const market = message.data.market;

          if (!this.isMarketSupported(market)) {
            const [baseAsset, quoteAsset] = market.split("_");
            if (baseAsset && quoteAsset) {
              this.addMarket(baseAsset, quoteAsset);
            } else {
              throw new Error(`Market ${market} is not supported`);
            }
          }

          const { executedQty, fills, orderId } = await this.createOrder(
            market,
            message.data.price,
            message.data.quantity,
            message.data.side,
            message.data.userId
          );

          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_PLACED",
            payload: {
              orderId,
              executedQty,
              fills
            }
          });

          // ORDER_PLACED is now pushed in createOrder() with correct filled/status
          // This ensures DB persistence happens BEFORE the API response
        } catch (e: any) {
          console.log("Error creating order:", e.message);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: {
              orderId: "",
              executedQty: 0,
              remainingQty: 0,
              error: e.message
            }
          });
        }
        break;

      case CANCEL_ORDER:
        try {
          const orderId = message.data.orderId;
          const cancelMarket = message.data.market;

          if (!this.isMarketSupported(cancelMarket)) {
            throw new Error(`Market ${cancelMarket} is not supported`);
          }

          const cancelOrderbook = this.orderbooks.find(o => o.ticker() === cancelMarket);
          const marketConfig = this.getMarketConfig(cancelMarket);

          if (!cancelOrderbook || !marketConfig) {
            throw new Error("No orderbook found");
          }

          const order = cancelOrderbook.asks.find(o => o.orderId === orderId) ||
            cancelOrderbook.bids.find(o => o.orderId === orderId);

          if (!order) {
            console.log("No order found");
            throw new Error("No order found");
          }

          if (order.side === "buy") {
            const price = cancelOrderbook.cancelBid(order);
            const remainingQty = order.quantity - order.filled;
            const amountToUnlock = remainingQty * order.price;

            // Unlock: locked -= amount, available += amount
            await RedisManager.getInstance().updateBalance(
              order.userId,
              marketConfig.quoteAsset,
              amountToUnlock,
              -amountToUnlock,
              "cancel",
              orderId
            );

            if (price) {
              this.sendUpdatedDepthAt(price.toString(), cancelMarket);
            }
          } else {
            const price = cancelOrderbook.cancelAsk(order);
            const remainingQty = order.quantity - order.filled;

            // Unlock: locked -= amount, available += amount
            await RedisManager.getInstance().updateBalance(
              order.userId,
              marketConfig.baseAsset,
              remainingQty,
              -remainingQty,
              "cancel",
              orderId
            );

            if (price) {
              this.sendUpdatedDepthAt(price.toString(), cancelMarket);
            }
          }

          const remainingQty = order.quantity - order.filled;

          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: {
              orderId,
              executedQty: order.filled,
              remainingQty
            }
          });

          // Publish private update  to open_orders:user channel
          RedisManager.getInstance().publishMessage(`open_orders:user:${order.userId}`, {
            stream: `open_orders:user:${order.userId}`,
            data: {
              type: "ORDER_CANCELLED",
              payload: {
                orderId,
                market: cancelMarket,
                price: order.price.toString(),
                quantity: order.quantity.toString(), // Original qty
                filled: order.filled,
                side: order.side,
                remainingQty,
                timestamp: Date.now()
              }
            }
          });
          console.log(`[Engine] Published ORDER_CANCELLED for order ${orderId} to open_orders:user:${order.userId}`);

          // Push to DB processor
          RedisManager.getInstance().pushMessage({
            type: "ORDER_CANCELLED",
            data: {
              orderId,
              executedQty: order.filled,
              market: cancelMarket,
              remainingQty
            }
          });

        } catch (e: any) {
          console.log("Error while cancelling order:", e.message);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: {
              orderId: message.data.orderId,
              executedQty: 0,
              remainingQty: 0,
              error: e.message
            }
          });
        }
        break;

      case GET_OPEN_ORDERS:
        try {
          const market = message.data.market;

          if (!this.isMarketSupported(market)) {
            throw new Error(`Market ${market} is not supported`);
          }

          const openOrderbook = this.orderbooks.find(o => o.ticker() === market);
          if (!openOrderbook) {
            throw new Error("No orderbook found");
          }

          const openOrders = openOrderbook.getOpenOrders(message.data.userId);

          RedisManager.getInstance().sendToApi(clientId, {
            type: "OPEN_ORDERS",
            payload: openOrders
          });
        } catch (e) {
          console.log("Error getting open orders:", e);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "OPEN_ORDERS",
            payload: []
          });
        }
        break;

      case ON_RAMP:
        const userId = message.data.userId;
        const amount = Number(message.data.amount);
        const asset = message.data.asset || BASE_CURRENCY;

        // Deposit: available += amount
        await RedisManager.getInstance().updateBalance(
          userId, asset, amount, 0, "deposit", Math.random().toString() // Generate unique ID for deposit
        );
        console.log(`[Engine] User ${userId} on-ramped ${amount} ${asset}`);
        break;

      case GET_DEPTH:
        try {
          const market = message.data.market;

          if (!this.isMarketSupported(market)) {
            throw new Error(`Market ${market} is not supported`);
          }

          const orderbook = this.orderbooks.find(o => o.ticker() === market);
          if (!orderbook) {
            throw new Error("No orderbook found");
          }

          RedisManager.getInstance().sendToApi(clientId, {
            type: "DEPTH",
            payload: orderbook.getDepth()
          });
        } catch (e) {
          console.log("Error getting depth:", e);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "DEPTH",
            payload: {
              bids: [],
              asks: []
            }
          });
        }
        break;

      case ENSURE_USER:
        const { balances } = message.data;
        const ensureUserId = message.data.userId;
        for (const asset in balances) {
          await RedisManager.getInstance().syncBalance(
            ensureUserId,
            asset,
            balances[asset].available,
            balances[asset].locked
          );
        }
        console.log(`[Engine] Ensured user ${ensureUserId} balances, ${JSON.stringify(balances)}`);
        break;
    }
  }

  addOrderbook(orderbook: Orderbook) {
    this.orderbooks.push(orderbook);
  }

  /**
   * Create and execute a new order in the matching engine
   * 
   * Order Execution Flow (per ARCHITECTURE.md Section 4.2):
   * 1. Validate market and inputs
   * 2. Generate unique orderId (26-char random string per ARCHITECTURE.md line 547)
   * 3. Lock funds atomically via Redis Lua script
   * 4. Match against orderbook (with self-trade prevention per line 714-753)
   * 5. Update balances for taker and makers
   * 6. Persist order and trades to DB queue
   * 7. Publish WebSocket updates (depth, trades, orders)
   * 
   * @param market - Market symbol (e.g., "SOL_USDC")
   * @param price - Limit price as string
   * @param quantity - Order quantity as string  
   * @param side - "buy" or "sell"
   * @param userId - User ID placing the order
   * @returns Object with executedQty, fills array, and orderId
   * @throws Error if insufficient funds or invalid inputs
   */
  async createOrder(market: string, price: string, quantity: string, side: "buy" | "sell", userId: string) {
    const orderbook = this.orderbooks.find(o => o.ticker() === market);
    const marketConfig = this.getMarketConfig(market);

    if (!orderbook) {
      throw new Error(`No orderbook found for market ${market}`);
    }

    if (!marketConfig) {
      throw new Error(`Market configuration not found for ${market}`);
    }

    const { baseAsset, quoteAsset } = marketConfig;
    const numericPrice = Number(price);
    const numericQuantity = Number(quantity);

    // Validate inputs
    if (isNaN(numericPrice) || numericPrice <= 0) {
      throw new Error("Invalid price: must be a positive number");
    }
    if (isNaN(numericQuantity) || numericQuantity <= 0) {
      throw new Error("Invalid quantity: must be a positive number");
    }

    const orderId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Check and lock funds BEFORE creating the order
    await this.checkAndLockFunds(baseAsset, quoteAsset, side, userId, numericPrice, numericQuantity, orderId);

    const order: Order = {
      price: numericPrice,
      quantity: numericQuantity,
      orderId,
      filled: 0,
      side,
      userId
    };

    const { fills, executedQty } = orderbook.addOrder(order);

    // Update balances based on fills - pass orderPrice for price improvement calculation
    await this.updateBalance(userId, baseAsset, quoteAsset, side, fills, executedQty, numericPrice, orderId);

    // === DB PERSISTENCE FIRST (to guarantee order history) ===

    // 1. Persist TAKER order with correct filled status
    const takerStatus = executedQty === numericQuantity ? "filled" : (executedQty > 0 ? "partial" : "open");
    this.persistOrderToDb(orderId, userId, market, price, quantity, side, executedQty, takerStatus);

    // 2. Persist MAKER order updates (incremental fills)
    for (const fill of fills) {
      this.persistMakerFillToDb(fill.markerOrderId, fill.qty);
    }

    // 3. Create trade records
    this.createDbTrades(fills, market, userId, orderId);

    // === WEBSOCKET UPDATES ===
    this.publishWsDepthUpdates(fills, price, side, market);
    this.publishWsTrades(fills, userId, market);
    this.publishWsOrders(order, executedQty, fills, market);

    return { executedQty, fills, orderId: order.orderId };
  }

  /**
   * Persist a new order to the database
   */
  persistOrderToDb(
    orderId: string,
    oderId: string,
    market: string,
    price: string,
    quantity: string,
    side: "buy" | "sell",
    filled: number,
    status: "open" | "partial" | "filled"
  ) {
    RedisManager.getInstance().pushMessage({
      type: "ORDER_PLACED",
      data: {
        orderId,
        userId: oderId,
        market,
        price,
        quantity,
        side,
        executedQty: filled,
        status,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Persist a maker's fill update to the database (incremental)
   */
  persistMakerFillToDb(makerOrderId: string, filledQty: number) {
    RedisManager.getInstance().pushMessage({
      type: ORDER_UPDATE,
      data: {
        orderId: makerOrderId,
        executedQty: filledQty
        // No quantity field = incremental update in DB worker
      }
    });
  }


  /**
   * Check if user has sufficient funds and lock them using Redis atomic operations
   * 
   * Atomicity Guarantee (per ARCHITECTURE.md Section 4.3, lines 837-866):
   * - Uses Redis Lua script to ensure atomic check-and-lock
   * - For BUY orders: locks quote asset (e.g., USDC) = quantity * price
   * - For SELL orders: locks base asset (e.g., SOL) = quantity
   * - Fails immediately if insufficient funds (newAvailable < 0)
   * - Balance update is pushed to db_balance_updates queue for DB persistence
   * 
   * @param baseAsset - Base asset symbol (e.g., "SOL")
   * @param quoteAsset - Quote asset symbol (e.g., "USDC")
   * @param side - "buy" or "sell"
   * @param userId - User ID
   * @param price - Order price
   * @param quantity - Order quantity
   * @param orderId - Unique order ID for event tracking
   * @throws Error if insufficient funds
   */
  async checkAndLockFunds(
    baseAsset: string,
    quoteAsset: string,
    side: "buy" | "sell",
    userId: string,
    price: number,
    quantity: number,
    orderId: string
  ) {
    if (side === "buy") {
      // For buy orders, lock quote asset (e.g., USDC)
      const requiredAmount = quantity * price;

      // Update Balance: available -= required, locked += required
      const success = await RedisManager.getInstance().updateBalance(
        userId,
        quoteAsset,
        -requiredAmount,
        requiredAmount,
        "order_place",
        orderId
      );

      if (!success) {
        throw new Error(
          `Insufficient ${quoteAsset} funds. Required: ${requiredAmount.toFixed(8)}`
        );
      }

      console.log(`[Lock] User ${userId}: Locked ${requiredAmount} ${quoteAsset} for buy order`);
    } else {
      // For sell orders, lock base asset (e.g., BTC)
      // Update Balance: available -= quantity, locked += quantity
      const success = await RedisManager.getInstance().updateBalance(
        userId,
        baseAsset,
        -quantity,
        quantity,
        "order_place",
        orderId
      );

      if (!success) {
        throw new Error(
          `Insufficient ${baseAsset} funds. Required: ${quantity.toFixed(8)}`
        );
      }

      console.log(`[Lock] User ${userId}: Locked ${quantity} ${baseAsset} for sell order`);
    }
  }

  /**
   * Update balances after order fills
   * Handles both taker and maker balance updates
   */
  async updateBalance(
    userId: string,
    baseAsset: string,
    quoteAsset: string,
    side: "buy" | "sell",
    fills: Fill[],
    executedQty: number,
    orderPrice: number,
    orderId: string
  ) {
    if (side === "buy") {
      // TAKER is BUYING
      for (const fill of fills) {
        const fillPrice = Number(fill.price);
        const fillQty = fill.qty;
        const fillValue = fillQty * fillPrice;

        // === TAKER (buyer - userId) ===
        const priceDifference = orderPrice - fillPrice;
        let takerQuoteAvailableChange = 0;
        let takerQuoteLockedChange = -fillValue;

        if (priceDifference > 0) {
          const priceImprovement = priceDifference * fillQty;
          takerQuoteLockedChange -= priceImprovement;
          takerQuoteAvailableChange += priceImprovement;
        }

        await RedisManager.getInstance().updateBalance(
          userId, quoteAsset, takerQuoteAvailableChange, takerQuoteLockedChange, "trade", fill.tradeId.toString()
        );
        await RedisManager.getInstance().updateBalance(
          userId, baseAsset, fillQty, 0, "trade", fill.tradeId.toString()
        );

        // Order updates for partial fills are handled by publishWsOrders()
        // No need to publish ORDER_UPDATE separately here

        // === MAKER (seller - otherUserId) ===
        await RedisManager.getInstance().updateBalance(
          fill.otherUserId, quoteAsset, fillValue, 0, "trade", fill.tradeId.toString()
        );
        await RedisManager.getInstance().updateBalance(
          fill.otherUserId, baseAsset, 0, -fillQty, "trade", fill.tradeId.toString()
        );

        // Order updates for partial fills are handled by publishWsOrders()
        // No need to publish ORDER_UPDATE separately here

        console.log(`[Fill] BUY: Taker ${userId} bought ${fillQty} ${baseAsset} @ ${fillPrice} from Maker ${fill.otherUserId}`);
      }
    } else {
      // TAKER is SELLING
      for (const fill of fills) {
        const fillPrice = Number(fill.price);
        const fillQty = fill.qty;
        const fillValue = fillQty * fillPrice;

        // === TAKER (seller - userId) ===
        await RedisManager.getInstance().updateBalance(
          userId, baseAsset, 0, -fillQty, "trade", fill.tradeId.toString()
        );
        await RedisManager.getInstance().updateBalance(
          userId, quoteAsset, fillValue, 0, "trade", fill.tradeId.toString()
        );

        // Order updates for partial fills are handled by publishWsOrders()
        // No need to publish ORDER_UPDATE separately here

        // === MAKER (buyer - otherUserId) ===
        await RedisManager.getInstance().updateBalance(
          fill.otherUserId, quoteAsset, 0, -fillValue, "trade", fill.tradeId.toString()
        );
        await RedisManager.getInstance().updateBalance(
          fill.otherUserId, baseAsset, fillQty, 0, "trade", fill.tradeId.toString()
        );

        // Order updates for partial fills are handled by publishWsOrders()
        // No need to publish ORDER_UPDATE separately here

        console.log(`[Fill] SELL: Taker ${userId} sold ${fillQty} ${baseAsset} @ ${fillPrice} to Maker ${fill.otherUserId}`);
      }
    }
  }

  updateDbOrders(order: Order, executedQty: number, fills: Fill[], market: string) {
    RedisManager.getInstance().pushMessage({
      type: ORDER_UPDATE,
      data: {
        orderId: order.orderId,
        executedQty: executedQty,
        market: market,
        price: order.price.toString(),
        quantity: order.quantity.toString(),
        side: order.side,
      }
    });

    fills.forEach(fill => {
      RedisManager.getInstance().pushMessage({
        type: ORDER_UPDATE,
        data: {
          orderId: fill.markerOrderId,
          executedQty: fill.qty
        }
      });
    });
  }

  createDbTrades(fills: Fill[], market: string, userId: string, orderId: string) {
    fills.forEach(fill => {
      RedisManager.getInstance().pushMessage({
        type: TRADE_ADDED,
        data: {
          market: market,
          id: fill.tradeId.toString(),
          isBuyerMaker: fill.otherUserId === userId,
          price: fill.price,
          quantity: fill.qty.toString(),
          quoteQuantity: (fill.qty * Number(fill.price)).toString(),
          timestamp: Date.now(),
          userId: userId,
          status: "filled",
          orderId: orderId
        }
      });
    });
  }

  publishWsTrades(fills: Fill[], userId: string, market: string) {
    fills.forEach(fill => {
      const tradeData = {
        e: "trade" as "trade",
        t: fill.tradeId,
        m: fill.otherUserId === userId,
        p: fill.price,
        q: fill.qty.toString(),
        s: market,
        o: fill.markerOrderId,
        T: Date.now() // Ensure timestamp is present
      };

      RedisManager.getInstance().publishMessage(`trade@${market}`, {
        stream: `trade@${market}`,
        data: tradeData
      });

      // Push to Redis List and Trim to 100
      RedisManager.getInstance().pushToQueue(`trades_snapshot:${market}`, JSON.stringify(tradeData));
      RedisManager.getInstance().trimQueue(`trades_snapshot:${market}`, 100);
    });
  }

  /**
   * Publish order events to user-specific WebSocket channels
   * 
   * Event Structure (per ARCHITECTURE.md Section 3, lines 470-536):
   * 
   * 1. ORDER_PLACED - Published to taker's channel
   *    - Channel: open_orders:user:{order.userId}
   *    - Payload: orderId, executedQty, market, price, quantity, side, status, userId, timestamp
   *    - Status: "open" | "partial" | "filled" based on executedQty
   * 
   * 2. ORDER_FILL - Published to each maker's channel
   *    - Channel: open_orders:user:{makerUserId}
   *    - Payload: orderId, filledQty, price, market, side (maker's side), timestamp
   *    - Grouped by maker to send single notification per maker
   * 
   * Frontend subscribes to these channels in Orders.tsx (lines 100-175)
   * 
   * @param order - The taker's order
   * @param executedQty - Total quantity executed
   * @param fills - Array of fills with maker details
   * @param market - Market symbol
   */
  publishWsOrders(order: Order, executedQty: number, fills: Fill[], market: string) {
    // === TAKER UPDATE ===
    let takerStatus: "filled" | "partial" | "open" = "open";
    if (executedQty === order.quantity) {
      takerStatus = "filled";
    } else if (executedQty > 0) {
      takerStatus = "partial";
    }

    const takerOrderData: OrderPlacedMessage = {
      stream: `open_orders:user:${order.userId}`,
      data: {
        type: "ORDER_PLACED",
        payload: {
          orderId: order.orderId,
          executedQty: executedQty,
          market: market,
          price: order.price.toString(),
          quantity: order.quantity.toString(),
          side: order.side,
          status: takerStatus,
          userId: order.userId,
          timestamp: Date.now()
        }
      }
    };

    RedisManager.getInstance().publishMessage(`open_orders:user:${order.userId}`, takerOrderData);
    console.log(`[Engine] Published ORDER_PLACED to taker ${order.userId} for order ${order.orderId}`);

    // === MAKER UPDATES ===
    // Group fills by maker to send a single notification per maker
    const makerFillsMap = new Map<string, { orderId: string, totalFilled: number, price: string }>();

    for (const fill of fills) {
      const existing = makerFillsMap.get(fill.otherUserId);
      if (existing && existing.orderId === fill.markerOrderId) {
        existing.totalFilled += fill.qty;
      } else {
        makerFillsMap.set(fill.otherUserId, {
          orderId: fill.markerOrderId,
          totalFilled: fill.qty,
          price: fill.price
        });
      }
    }

    // Send ORDER_FILL update to each maker
    for (const [makerUserId, fillData] of makerFillsMap) {
      const makerSide: "buy" | "sell" = order.side === "buy" ? "sell" : "buy";
      const makerOrderData = {
        stream: `open_orders:user:${makerUserId}`,
        data: {
          type: "ORDER_FILL" as const,
          payload: {
            orderId: fillData.orderId,
            filledQty: fillData.totalFilled,
            price: fillData.price,
            market: market,
            side: makerSide,
            timestamp: Date.now()
          }
        }
      };
      RedisManager.getInstance().publishMessage(`open_orders:user:${makerUserId}`, makerOrderData);
      console.log(`[Engine] Published ORDER_FILL to maker ${makerUserId} for order ${fillData.orderId}`);
    }
  }

  sendUpdatedDepthAt(price: string, market: string) {
    const orderbook = this.orderbooks.find(o => o.ticker() === market);
    if (!orderbook) {
      return;
    }
    const depth = orderbook.getDepth();
    const updatedBids = depth?.bids.filter(x => x[0] === price);
    const updatedAsks = depth?.asks.filter(x => x[0] === price);

    RedisManager.getInstance().publishMessage(`depth@${market}`, {
      stream: `depth@${market}`,
      data: {
        e: "depth",
        bids: updatedBids && updatedBids.length ? updatedBids : [[price, "0"]],
        asks: updatedAsks && updatedAsks.length ? updatedAsks : [[price, "0"]],
      }
    });
  }

  publishWsDepthUpdates(fills: Fill[], price: string, side: "buy" | "sell", market: string) {
    const orderbook = this.orderbooks.find(o => o.ticker() === market);
    if (!orderbook) {
      return;
    }
    const depth = orderbook.getDepth();

    if (side === "buy") {
      const updatedAsks: [string, string][] = fills.map(f => {
        const askAtPrice = depth?.asks.find(x => x[0] === f.price);
        return askAtPrice || [f.price, "0"];
      });

      const updatedBid = depth?.bids.find(x => x[0] === price);

      console.log(`[Engine] Publishing WS depth updates to channel: depth@${market}`);
      RedisManager.getInstance().publishMessage(`depth@${market}`, {
        stream: `depth@${market}`,
        data: {
          e: "depth",
          asks: updatedAsks,
          bids: updatedBid ? [updatedBid] : [[price, "0"]],
        }
      });
    }

    if (side === "sell") {
      const updatedBids: [string, string][] = fills.map(f => {
        const bidAtPrice = depth?.bids.find(x => x[0] === f.price);
        return bidAtPrice || [f.price, "0"];
      });

      const updatedAsk = depth?.asks.find(x => x[0] === price);

      console.log(`[Engine] Publishing WS depth updates to channel: depth@${market}`);
      RedisManager.getInstance().publishMessage(`depth@${market}`, {
        stream: `depth@${market}`,
        data: {
          e: "depth",
          asks: updatedAsk ? [updatedAsk] : [[price, "0"]],
          bids: updatedBids,
        }
      });
    }

  }
}
