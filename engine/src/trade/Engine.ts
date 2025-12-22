import fs from "fs";
import { RedisManager } from "../RedisManager";
import { ORDER_UPDATE, TRADE_ADDED } from "../types/index";
import { CANCEL_ORDER, CREATE_ORDER, GET_DEPTH, GET_OPEN_ORDERS, MessageFromApi, ON_RAMP, ENSURE_USER } from "../types/fromApi";
import { Fill, Order, Orderbook } from "./Orderbook";
import axios from "axios";
import { Ticker } from "../types/toApi";

export const BASE_CURRENCY = "USDC";

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
        new Orderbook(o.baseAsset, o.bids, o.asks, o.lastTradeId, o.currentPrice, o.quoteAsset, o.trades)
      );
      this.balances = new Map(snapshotSnapshot.balances);

      if (snapshotSnapshot.supportedMarkets) {
        this.supportedMarkets = new Map(snapshotSnapshot.supportedMarkets);
      }
    } else {
      this.initializeOrderbooks();
      this.setBaseBalances();
    }

    setInterval(() => {
      this.saveSnapshot();
    }, 1000 * 3);
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
      balances: Array.from(this.balances.entries()),
      supportedMarkets: Array.from(this.supportedMarkets.entries())
    };
    fs.writeFileSync("./snapshot.json", JSON.stringify(snapshotSnapshot));

    this.orderbooks.forEach(o => {
      RedisManager.getInstance().set(`orderbook_snapshot:${o.ticker()}`, JSON.stringify(o.getSnapshot()));
      RedisManager.getInstance().set(`depth_snapshot:${o.ticker()}`, JSON.stringify(o.getDepth()));
      RedisManager.getInstance().set(`trades_snapshot:${o.ticker()}`, JSON.stringify(o.trades));
    });
  }

  process({ message, clientId }: { message: MessageFromApi, clientId: string }) {
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
        } catch (e: any) {
          console.log("Error creating order:", e.message);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: {
              orderId: "",
              executedQty: 0,
              remainingQty: 0,
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

          const userBalance = this.balances.get(order.userId);
          if (!userBalance) {
            throw new Error("User balance not found");
          }

          if (order.side === "buy") {
            const price = cancelOrderbook.cancelBid(order);
            const remainingQty = order.quantity - order.filled;
            const amountToUnlock = remainingQty * order.price;

            this.ensureUserBalance(order.userId, marketConfig.quoteAsset);

            const quoteBalance = userBalance[marketConfig.quoteAsset];
            if (quoteBalance.locked < amountToUnlock) {
              console.warn(`[Cancel] Locked amount mismatch. Expected: ${amountToUnlock}, Actual: ${quoteBalance.locked}`);
              // Unlock whatever is locked to avoid negative balance
              quoteBalance.available += quoteBalance.locked;
              quoteBalance.locked = 0;
            } else {
              quoteBalance.available += amountToUnlock;
              quoteBalance.locked -= amountToUnlock;
            }

            if (price) {
              this.sendUpdatedDepthAt(price.toString(), cancelMarket);
            }
          } else {
            const price = cancelOrderbook.cancelAsk(order);
            const remainingQty = order.quantity - order.filled;

            this.ensureUserBalance(order.userId, marketConfig.baseAsset);

            const baseBalance = userBalance[marketConfig.baseAsset];
            if (baseBalance.locked < remainingQty) {
              console.warn(`[Cancel] Locked amount mismatch. Expected: ${remainingQty}, Actual: ${baseBalance.locked}`);
              baseBalance.available += baseBalance.locked;
              baseBalance.locked = 0;
            } else {
              baseBalance.available += remainingQty;
              baseBalance.locked -= remainingQty;
            }

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
              remainingQty: 0
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
        this.onRamp(userId, amount, asset);
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
        const ensureUserId = message.data.userId;
        const ensureBalances = message.data.balances;
        if (!this.balances.has(ensureUserId)) {
          console.log(`[Engine] Syncing user ${ensureUserId} from API`);
          this.balances.set(ensureUserId, ensureBalances);
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
    const numericPrice = Number(price);
    const numericQuantity = Number(quantity);

    // Validate inputs
    if (isNaN(numericPrice) || numericPrice <= 0) {
      throw new Error("Invalid price: must be a positive number");
    }
    if (isNaN(numericQuantity) || numericQuantity <= 0) {
      throw new Error("Invalid quantity: must be a positive number");
    }

    // Ensure user has balance entries for both assets
    this.ensureUserBalance(userId, baseAsset);
    this.ensureUserBalance(userId, quoteAsset);

    // Check and lock funds BEFORE creating the order
    this.checkAndLockFunds(baseAsset, quoteAsset, side, userId, numericPrice, numericQuantity);

    const order: Order = {
      price: numericPrice,
      quantity: numericQuantity,
      orderId: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
      filled: 0,
      side,
      userId
    };

    const { fills, executedQty } = orderbook.addOrder(order);

    // Update balances based on fills - pass orderPrice for price improvement calculation
    this.updateBalance(userId, baseAsset, quoteAsset, side, fills, executedQty, numericPrice);

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

  /**
   * Check if user has sufficient funds and lock them
   */
  checkAndLockFunds(
    baseAsset: string,
    quoteAsset: string,
    side: "buy" | "sell",
    userId: string,
    price: number,
    quantity: number
  ) {
    const userBalance = this.balances.get(userId);
    if (!userBalance) {
      throw new Error("User balance not found");
    }

    if (side === "buy") {
      // For buy orders, lock quote asset (e.g., USDC)
      const requiredAmount = quantity * price;
      const quoteBalance = userBalance[quoteAsset];

      if (!quoteBalance) {
        throw new Error(`No ${quoteAsset} balance found`);
      }

      if (quoteBalance.available < requiredAmount) {
        throw new Error(
          `Insufficient ${quoteAsset} funds. Required: ${requiredAmount.toFixed(8)}, Available: ${quoteBalance.available.toFixed(8)}`
        );
      }

      quoteBalance.available -= requiredAmount;
      quoteBalance.locked += requiredAmount;

      console.log(`[Lock] User ${userId}: Locked ${requiredAmount} ${quoteAsset} for buy order`);
    } else {
      // For sell orders, lock base asset (e.g., BTC)
      const baseBalance = userBalance[baseAsset];

      if (!baseBalance) {
        throw new Error(`No ${baseAsset} balance found`);
      }

      if (baseBalance.available < quantity) {
        throw new Error(
          `Insufficient ${baseAsset} funds. Required: ${quantity.toFixed(8)}, Available: ${baseBalance.available.toFixed(8)}`
        );
      }

      baseBalance.available -= quantity;
      baseBalance.locked += quantity;

      console.log(`[Lock] User ${userId}: Locked ${quantity} ${baseAsset} for sell order`);
    }
  }

  /**
   * Update balances after order fills
   * Handles both taker and maker balance updates
   */
  updateBalance(
    userId: string,
    baseAsset: string,
    quoteAsset: string,
    side: "buy" | "sell",
    fills: Fill[],
    executedQty: number,
    orderPrice: number
  ) {
    const userBalance = this.balances.get(userId);
    if (!userBalance) {
      console.error(`[UpdateBalance] User balance not found for ${userId}`);
      return;
    }

    if (side === "buy") {
      // TAKER is BUYING
      // - Taker locked quote asset at orderPrice
      // - Taker receives base asset
      // - Maker (seller) receives quote asset
      // - Maker releases locked base asset

      fills.forEach(fill => {
        const fillPrice = Number(fill.price);
        const fillQty = fill.qty;
        const fillValue = fillQty * fillPrice;

        // Ensure other user has balance entries
        this.ensureUserBalance(fill.otherUserId, quoteAsset);
        this.ensureUserBalance(fill.otherUserId, baseAsset);

        const otherUserBalance = this.balances.get(fill.otherUserId)!;

        // === TAKER (buyer - userId) ===
        // 1. Spend locked quote asset (at fill price, not order price)
        userBalance[quoteAsset].locked -= fillValue;

        // 2. Receive base asset
        userBalance[baseAsset].available += fillQty;

        // 3. Return price improvement (if filled at better price)
        const priceDifference = orderPrice - fillPrice;
        if (priceDifference > 0) {
          const priceImprovement = priceDifference * fillQty;
          userBalance[quoteAsset].locked -= priceImprovement;
          userBalance[quoteAsset].available += priceImprovement;
          console.log(`[PriceImprovement] User ${userId}: Returned ${priceImprovement} ${quoteAsset} (filled at ${fillPrice} vs order at ${orderPrice})`);
        }

        // === MAKER (seller - otherUserId) ===
        // 1. Receive quote asset
        otherUserBalance[quoteAsset].available += fillValue;

        // 2. Release locked base asset
        otherUserBalance[baseAsset].locked -= fillQty;

        console.log(`[Fill] BUY: Taker ${userId} bought ${fillQty} ${baseAsset} @ ${fillPrice} from Maker ${fill.otherUserId}`);
      });
    } else {
      // TAKER is SELLING
      // - Taker locked base asset
      // - Taker receives quote asset
      // - Maker (buyer) spends locked quote asset
      // - Maker receives base asset

      fills.forEach(fill => {
        const fillPrice = Number(fill.price);
        const fillQty = fill.qty;
        const fillValue = fillQty * fillPrice;

        // Ensure other user has balance entries
        this.ensureUserBalance(fill.otherUserId, quoteAsset);
        this.ensureUserBalance(fill.otherUserId, baseAsset);

        const otherUserBalance = this.balances.get(fill.otherUserId)!;

        // === TAKER (seller - userId) ===
        // 1. Release locked base asset
        userBalance[baseAsset].locked -= fillQty;

        // 2. Receive quote asset
        userBalance[quoteAsset].available += fillValue;

        // === MAKER (buyer - otherUserId) ===
        // The maker locked quote asset at THEIR order price (which is the fill price)
        // 1. Spend locked quote asset
        otherUserBalance[quoteAsset].locked -= fillValue;

        // 2. Receive base asset
        otherUserBalance[baseAsset].available += fillQty;

        console.log(`[Fill] SELL: Taker ${userId} sold ${fillQty} ${baseAsset} @ ${fillPrice} to Maker ${fill.otherUserId}`);
      });
    }

    // Log final balances for debugging
    console.log(`[Balance] User ${userId} after fills:`, {
      [baseAsset]: userBalance[baseAsset],
      [quoteAsset]: userBalance[quoteAsset]
    });
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
        bids: updatedBids && updatedBids.length ? updatedBids : [[price, "0"]],
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

  onRamp(userId: string, amount: number, asset: string = BASE_CURRENCY) {
    if (isNaN(amount) || amount <= 0) {
      console.error(`[OnRamp] Invalid amount: ${amount}`);
      return;
    }

    this.ensureUserBalance(userId, asset);
    const userBalance = this.balances.get(userId)!;
    userBalance[asset].available += amount;

    console.log(`[OnRamp] User ${userId}: Added ${amount} ${asset}. New available: ${userBalance[asset].available}`);
  }

  setBaseBalances() {
    const allAssets = new Set<string>();
    allAssets.add(BASE_CURRENCY);

    this.supportedMarkets.forEach(config => {
      allAssets.add(config.baseAsset);
      allAssets.add(config.quoteAsset);
    });
  }

  /**
   * Get user balance for a specific asset or all assets
   */
  getUserBalance(userId: string, asset?: string): UserBalance | { available: number; locked: number } | null {
    const userBalance = this.balances.get(userId);
    if (!userBalance) return null;

    if (asset) {
      return userBalance[asset] || { available: 0, locked: 0 };
    }

    return userBalance;
  }

  /**
   * Debug method to print all balances
   */
  printBalances() {
    console.log("=== Current Balances ===");
    this.balances.forEach((balance, userId) => {
      console.log(`User ${userId}:`, balance);
    });
    console.log("========================");
  }
}