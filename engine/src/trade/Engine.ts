import fs from "fs";
import { RedisManager } from "../RedisManager";
import { ORDER_UPDATE, TRADE_ADDED } from "../types/index";
import { CANCEL_ORDER, CREATE_ORDER, GET_DEPTH, GET_OPEN_ORDERS, MessageFromApi, ON_RAMP } from "../types/fromApi";
import { Fill, Order, Orderbook } from "./Orderbook";
import axios from "axios";
import { Ticker } from "../types/toApi";

//TODO: Avoid floats everywhere, use a decimal similar to the PayTM project for every currency
export const BASE_CURRENCY = "INR";

interface UserBalance {
  [key: string]: {
    available: number;
    locked: number;
  }
}

interface MarketConfig {
  baseAsset: string;
  quoteAsset: string;
  ticker: string;
}

export class Engine {
  private orderbooks: Orderbook[] = [];
  private balances: Map<string, UserBalance> = new Map();
  private supportedMarkets: Map<string, MarketConfig> = new Map();
  static initializeMarkets: boolean = false;

  constructor() {
    // Initialization moved to init() method
  }

  async init() {
    // Initialize supported markets
    if (!Engine.initializeMarkets) {
      await this.initializeSupportedMarkets();
      Engine.initializeMarkets = true;
    }

    let snapshot = null;
    try {
      if (process.env.WITH_SNAPSHOT) {
        snapshot = fs.readFileSync("./snapshot.json");
      }
    } catch (e) {
      console.log("No snapshot found");
    }

    if (snapshot) {
      const snapshotSnapshot = JSON.parse(snapshot.toString());
      this.orderbooks = snapshotSnapshot.orderbooks.map((o: any) =>
        new Orderbook(o.baseAsset, o.bids, o.asks, o.lastTradeId, o.currentPrice, o.quoteAsset)
      );
      this.balances = new Map(snapshotSnapshot.balances);

      // Restore supported markets if saved
      if (snapshotSnapshot.supportedMarkets) {
        this.supportedMarkets = new Map(snapshotSnapshot.supportedMarkets);
      }
    } else {
      // Initialize default orderbooks for all supported markets
      this.initializeOrderbooks();
      this.setBaseBalances();
    }

    setInterval(() => {
      this.saveSnapshot();
    }, 1000 * 3);
  }

  /**
   * Initialize supported markets
   * Add new markets here as needed
   */
  private async initializeSupportedMarkets() { // Make async
    try {
      const fetchMarkets = await axios.get<Ticker[]>("http://localhost:8080/api/v1/tickers"); // await response
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

  /**
   * Initialize orderbooks for all supported markets
   */
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

  /**
   * Add a new market dynamically
   */
  addMarket(baseAsset: string, quoteAsset: string): boolean {
    const ticker = `${baseAsset}_${quoteAsset}`;

    if (this.supportedMarkets.has(ticker)) {
      console.log(`Market ${ticker} already exists`);
      return false;
    }

    // Add to supported markets
    this.supportedMarkets.set(ticker, { baseAsset, quoteAsset, ticker });

    // Create orderbook
    const orderbook = new Orderbook(baseAsset, [], [], 0, 0, quoteAsset);
    this.orderbooks.push(orderbook);

    console.log(`Added new market: ${ticker}`);
    return true;
  }

  /**
   * Get all supported markets
   */
  getSupportedMarkets(): string[] {
    return Array.from(this.supportedMarkets.keys());
  }

  /**
   * Check if a market is supported
   */
  isMarketSupported(market: string): boolean {
    return this.supportedMarkets.has(market);
  }

  /**
   * Get market configuration
   */
  getMarketConfig(market: string): MarketConfig | undefined {
    return this.supportedMarkets.get(market);
  }

  saveSnapshot() {
    const snapshotSnapshot = {
      orderbooks: this.orderbooks.map(o => o.getSnapshot()),
      balances: Array.from(this.balances.entries()),
      supportedMarkets: Array.from(this.supportedMarkets.entries())
    };
    fs.writeFileSync("./snapshot.json", JSON.stringify(snapshotSnapshot));
  }

  process({ message, clientId }: { message: MessageFromApi, clientId: string }) {
    switch (message.type) {
      case CREATE_ORDER:
        try {
          const market = message.data.market;

          // Validate market
          if (!this.isMarketSupported(market)) {
            const [baseAsset, quoteAsset] = market.split("_");
            if (baseAsset && quoteAsset) {
              this.addMarket(baseAsset, quoteAsset);
            } else {
              throw new Error(`Market ${market} is not supported`);
            }
          }

          const { executedQty, fills, orderId } = this.createOrder(
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
        } catch (e) {
          console.log("Error creating order:", e);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: {
              orderId: "",
              executedQty: 0,
              remainingQty: 0
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
            const leftQuantity = (order.quantity - order.filled) * order.price;

            this.ensureUserBalance(order.userId, marketConfig.quoteAsset);
            //@ts-ignore
            this.balances.get(order.userId)[marketConfig.quoteAsset].available += leftQuantity;
            //@ts-ignore
            this.balances.get(order.userId)[marketConfig.quoteAsset].locked -= leftQuantity;

            if (price) {
              this.sendUpdatedDepthAt(price.toString(), cancelMarket);
            }
          } else {
            const price = cancelOrderbook.cancelAsk(order);
            const leftQuantity = order.quantity - order.filled;

            this.ensureUserBalance(order.userId, marketConfig.baseAsset);
            //@ts-ignore
            this.balances.get(order.userId)[marketConfig.baseAsset].available += leftQuantity;
            //@ts-ignore
            this.balances.get(order.userId)[marketConfig.baseAsset].locked -= leftQuantity;

            if (price) {
              this.sendUpdatedDepthAt(price.toString(), cancelMarket);
            }
          }

          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: {
              orderId,
              executedQty: 0,
              remainingQty: 0
            }
          });

        } catch (e) {
          console.log("Error while cancelling order:", e);
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
        const asset = message.data.asset || BASE_CURRENCY; // Support different assets
        this.onRamp(userId, amount, asset);
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
    }
  }

  addOrderbook(orderbook: Orderbook) {
    this.orderbooks.push(orderbook);
  }

  createOrder(market: string, price: string, quantity: string, side: "buy" | "sell", userId: string) {
    const orderbook = this.orderbooks.find(o => o.ticker() === market);
    const marketConfig = this.getMarketConfig(market);

    if (!orderbook) {
      throw new Error(`No orderbook found for market ${market}`);
    }

    if (!marketConfig) {
      throw new Error(`Market configuration not found for ${market}`);
    }

    const { baseAsset, quoteAsset } = marketConfig;

    // Ensure user has balance entries for both assets
    this.ensureUserBalance(userId, baseAsset);
    this.ensureUserBalance(userId, quoteAsset);

    this.checkAndLockFunds(baseAsset, quoteAsset, side, userId, price, quantity);

    const order: Order = {
      price: Number(price),
      quantity: Number(quantity),
      orderId: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
      filled: 0,
      side,
      userId
    };

    const { fills, executedQty } = orderbook.addOrder(order);
    this.updateBalance(userId, baseAsset, quoteAsset, side, fills, executedQty);

    this.createDbTrades(fills, market, userId);
    this.updateDbOrders(order, executedQty, fills, market);
    this.publisWsDepthUpdates(fills, price, side, market);
    this.publishWsTrades(fills, userId, market);

    return { executedQty, fills, orderId: order.orderId };
  }

  /**
   * Ensure user has balance entry for a specific asset
   */
  private ensureUserBalance(userId: string, asset: string) {
    if (!this.balances.has(userId)) {
      this.balances.set(userId, {});
    }

    const userBalance = this.balances.get(userId)!;
    if (!userBalance[asset]) {
      userBalance[asset] = {
        available: 0,
        locked: 0
      };
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
      RedisManager.getInstance().publishMessage(`trade@${market}`, {
        stream: `trade@${market}`,
        data: {
          e: "trade",
          t: fill.tradeId,
          m: fill.otherUserId === userId,
          p: fill.price,
          q: fill.qty.toString(),
          s: market,
          o: fill.markerOrderId
        }
      });
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
      // If no bids at this price, send [price, "0"] to indicate removal
      bids: updatedBids && updatedBids.length ? updatedBids : [[price, "0"]],
      // If no asks at this price, send [price, "0"] to indicate removal
      asks: updatedAsks && updatedAsks.length ? updatedAsks : [[price, "0"]],
    }
  });
}

publisWsDepthUpdates(fills: Fill[], price: string, side: "buy" | "sell", market: string) {
  const orderbook = this.orderbooks.find(o => o.ticker() === market);
  if (!orderbook) {
    return;
  }
  const depth = orderbook.getDepth();

  if (side === "buy") {
    // When buying, asks get filled
    const updatedAsks: [string, string][] = fills.map(f => {
      const askAtPrice = depth?.asks.find(x => x[0] === f.price);
      // If no quantity left at this price, send "0" to indicate removal
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
    // When selling, bids get filled
    const updatedBids: [string, string][] = fills.map(f => {
      const bidAtPrice = depth?.bids.find(x => x[0] === f.price);
      // If no quantity left at this price, send "0" to indicate removal
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

  updateBalance(userId: string, baseAsset: string, quoteAsset: string, side: "buy" | "sell", fills: Fill[], executedQty: number) {
    if (side === "buy") {
      fills.forEach(fill => {
        this.ensureUserBalance(fill.otherUserId, quoteAsset);
        this.ensureUserBalance(fill.otherUserId, baseAsset);

        // Update quote asset balance
        //@ts-ignore
        this.balances.get(fill.otherUserId)[quoteAsset].available += (fill.qty * fill.price);
        //@ts-ignore
        this.balances.get(userId)[quoteAsset].locked -= (fill.qty * fill.price);

        // Update base asset balance
        //@ts-ignore
        this.balances.get(fill.otherUserId)[baseAsset].locked -= fill.qty;
        //@ts-ignore
        this.balances.get(userId)[baseAsset].available += fill.qty;
      });
    } else {
      fills.forEach(fill => {
        this.ensureUserBalance(fill.otherUserId, quoteAsset);
        this.ensureUserBalance(fill.otherUserId, baseAsset);

        // Update quote asset balance
        //@ts-ignore
        this.balances.get(fill.otherUserId)[quoteAsset].locked -= (fill.qty * fill.price);
        //@ts-ignore
        this.balances.get(userId)[quoteAsset].available += (fill.qty * fill.price);

        // Update base asset balance
        //@ts-ignore
        this.balances.get(fill.otherUserId)[baseAsset].available += fill.qty;
        //@ts-ignore
        this.balances.get(userId)[baseAsset].locked -= fill.qty;
      });
    }
  }

  checkAndLockFunds(baseAsset: string, quoteAsset: string, side: "buy" | "sell", userId: string, price: string, quantity: string) {
    if (side === "buy") {
      if ((this.balances.get(userId)?.[quoteAsset]?.available || 0) < Number(quantity) * Number(price)) {
        throw new Error(`Insufficient ${quoteAsset} funds`);
      }
      //@ts-ignore
      this.balances.get(userId)[quoteAsset].available -= (Number(quantity) * Number(price));
      //@ts-ignore
      this.balances.get(userId)[quoteAsset].locked += (Number(quantity) * Number(price));
    } else {
      if ((this.balances.get(userId)?.[baseAsset]?.available || 0) < Number(quantity)) {
        throw new Error(`Insufficient ${baseAsset} funds`);
      }
      //@ts-ignore
      this.balances.get(userId)[baseAsset].available -= Number(quantity);
      //@ts-ignore
      this.balances.get(userId)[baseAsset].locked += Number(quantity);
    }
  }

  onRamp(userId: string, amount: number, asset: string = BASE_CURRENCY) {
    const userBalance = this.balances.get(userId);
    if (!userBalance) {
      this.balances.set(userId, {
        [asset]: {
          available: amount,
          locked: 0
        }
      });
    } else {
      if (!userBalance[asset]) {
        userBalance[asset] = {
          available: amount,
          locked: 0
        };
      } else {
        userBalance[asset].available += amount;
      }
    }
  }

  /**
   * Set base balances for initial users with all supported assets
   */
  setBaseBalances() {
    const testUsers = ["1", "2", "5"];
    const initialAmount = 10000000;

    // Collect all unique assets from all markets
    const allAssets = new Set<string>();
    allAssets.add(BASE_CURRENCY);

    this.supportedMarkets.forEach(config => {
      allAssets.add(config.baseAsset);
      allAssets.add(config.quoteAsset);
    });

    // Initialize balances for test users
    testUsers.forEach(userId => {
      const balances: UserBalance = {};

      allAssets.forEach(asset => {
        balances[asset] = {
          available: initialAmount,
          locked: 0
        };
      });

      this.balances.set(userId, balances);
    });

    console.log(`Initialized balances for ${testUsers.length} users with ${allAssets.size} assets`);
  }

  /**
   * Get user balance for a specific asset
   */
  getUserBalance(userId: string, asset?: string): UserBalance | { available: number; locked: number } | null {
    const userBalance = this.balances.get(userId);
    if (!userBalance) return null;

    if (asset) {
      return userBalance[asset] || null;
    }

    return userBalance;
  }
}