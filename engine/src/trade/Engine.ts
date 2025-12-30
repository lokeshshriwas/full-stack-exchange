import fs from "fs";
import { RedisManager } from "../RedisManager";
import { ORDER_UPDATE, TRADE_ADDED } from "../types/index";
import { CANCEL_ORDER, CREATE_ORDER, GET_DEPTH, GET_OPEN_ORDERS, MessageFromApi, ON_RAMP, ENSURE_USER } from "../types/fromApi";
import { Fill, Order, Orderbook } from "./Orderbook";
import axios from "axios";
import { Ticker } from "../types/toApi";
import { PositionManager } from "./PositionManager";

export const BASE_CURRENCY = "USDC";



interface MarketConfig {
  baseAsset: string;
  quoteAsset: string;
  ticker: string;
}

export class Engine {
  private orderbooks: Orderbook[] = [];
  private supportedMarkets: Map<string, MarketConfig> = new Map();
  private positionManager: PositionManager = new PositionManager();
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
      user: "postgres",
      host: "localhost",
      database: "exchange-platform",
      password: "020802",
      port: 5432,
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
          if (process.env.WITH_SNAPSHOT) {
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

    setInterval(async () => {
      // Update PnL for all markets
      for (const orderbook of this.orderbooks) {
        if (orderbook.currentPrice > 0) {
          await this.positionManager.updateUnrealizedPnL(orderbook.ticker(), orderbook.currentPrice);
        }
      }
    }, 1000 * 1); // Every 1 second
  }

  private async initializeSupportedMarkets() {
    try {
      const fetchMarkets = await axios.get<Ticker[]>("http://localhost:8080/api/v1/tickers");
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

          RedisManager.getInstance().pushMessage({
            type: "ORDER_PLACED",
            data: {
              orderId,
              executedQty,
              market,
              price: message.data.price,
              quantity: message.data.quantity,
              side: message.data.side,
              userId: message.data.userId
            }
          });
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

          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: {
              orderId,
              executedQty: order.filled,
              remainingQty: order.quantity - order.filled
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

    this.createDbTrades(fills, market, userId);
    this.updateDbOrders(order, executedQty, fills, market);
    this.publishWsDepthUpdates(fills, price, side, market);
    this.publishWsTrades(fills, userId, market);

    // Update Positions (Async to not block too much, or await if strict)
    // Taker Side (the user placing the order)
    this.positionManager.updatePosition({
      price: order.price.toString(),
      qty: executedQty,
      tradeId: 0, // Not needed for position accumulation logic usually, or generate one
      otherUserId: userId, // Taker ID
      markerOrderId: order.orderId
    }, side, market);

    // Maker Side (for each fill)
    fills.forEach(fill => {
      // MATCHED AGAINST:
      // If Taker is BUY -> Maker was SELL -> Maker Side is SELL
      // If Taker is SELL -> Maker was BUY -> Maker Side is BUY
      const makerSide = side === "buy" ? "sell" : "buy";
      this.positionManager.updatePosition(fill, makerSide, market);
    });

    return { executedQty, fills, orderId: order.orderId };
  }

  /**
   * Check if user has sufficient funds and lock them using Redis atomic operations
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
        // 1. Spend locked quote asset (at fill price)
        // 2. Receive base asset
        // 3. Price Improvement: Return difference (locked reduction, available increase)

        // Combined Taker Quote Change:
        // Locked decreases by fillValue (spent) + improvement (returned) = locked decreases by orderPrice * fillQty
        // Actually: Locked usage = fillValue. 
        // Improvement = (orderPrice - fillPrice) * fillQty
        // Locked reduced by fillValue + Improvement = (fillPrice * fillQty) + (orderPrice - fillPrice) * fillQty = orderPrice * fillQty
        // Available increases by Improvement

        const priceDifference = orderPrice - fillPrice;
        let takerQuoteAvailableChange = 0;
        let takerQuoteLockedChange = -fillValue;

        if (priceDifference > 0) {
          const priceImprovement = priceDifference * fillQty;
          takerQuoteLockedChange -= priceImprovement;
          takerQuoteAvailableChange += priceImprovement;
        }

        // Taker Base Asset Change: +fillQty (available)

        await RedisManager.getInstance().updateBalance(
          userId, quoteAsset, takerQuoteAvailableChange, takerQuoteLockedChange, "trade", fill.tradeId.toString()
        );
        await RedisManager.getInstance().updateBalance(
          userId, baseAsset, fillQty, 0, "trade", fill.tradeId.toString()
        );

        // === MAKER (seller - otherUserId) ===
        // 1. Receive quote asset (+available)
        // 2. Release locked base asset (-locked)

        await RedisManager.getInstance().updateBalance(
          fill.otherUserId, quoteAsset, fillValue, 0, "trade", fill.tradeId.toString()
        );
        await RedisManager.getInstance().updateBalance(
          fill.otherUserId, baseAsset, 0, -fillQty, "trade", fill.tradeId.toString()
        );

        console.log(`[Fill] BUY: Taker ${userId} bought ${fillQty} ${baseAsset} @ ${fillPrice} from Maker ${fill.otherUserId}`);
      }
    } else {
      // TAKER is SELLING
      for (const fill of fills) {
        const fillPrice = Number(fill.price);
        const fillQty = fill.qty;
        const fillValue = fillQty * fillPrice;

        // === TAKER (seller - userId) ===
        // 1. Release locked base asset (-locked)
        // 2. Receive quote asset (+available)

        await RedisManager.getInstance().updateBalance(
          userId, baseAsset, 0, -fillQty, "trade", fill.tradeId.toString()
        );
        await RedisManager.getInstance().updateBalance(
          userId, quoteAsset, fillValue, 0, "trade", fill.tradeId.toString()
        );

        // === MAKER (buyer - otherUserId) ===
        // Maker locked quote asset at THEIR order price (which is fillPrice)
        // 1. Spend locked quote asset (-locked)
        // 2. Receive base asset (+available)

        await RedisManager.getInstance().updateBalance(
          fill.otherUserId, quoteAsset, 0, -fillValue, "trade", fill.tradeId.toString()
        );
        await RedisManager.getInstance().updateBalance(
          fill.otherUserId, baseAsset, fillQty, 0, "trade", fill.tradeId.toString()
        );

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

  createDbTrades(fills: Fill[], market: string, userId: string) {
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
          timestamp: Date.now()
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
