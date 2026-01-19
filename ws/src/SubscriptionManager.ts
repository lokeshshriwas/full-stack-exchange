import { RedisClientType, createClient } from "redis";
import { UserManager } from "./UserManager";
import { config } from "./config";

export class SubscriptionManager {
  private static instance: SubscriptionManager;
  private subscriptions: Map<string, string[]> = new Map();
  private reverseSubscriptions: Map<string, string[]> = new Map();
  private redisClient: RedisClientType;
  private redisClientKV: RedisClientType;

  private constructor() {
    this.redisClient = createClient({ url: config.redis.url });
    this.redisClient.on("error", (err) => console.log("[WS] Redis Client Error", err));
    this.redisClient.on("connect", () => console.log("[WS] Redis Client Connected"));
    this.redisClient.connect();

    this.redisClientKV = createClient({ url: config.redis.url });
    this.redisClientKV.on("error", (err) => console.log("[WS] Redis KV Client Error", err));
    this.redisClientKV.on("connect", () => console.log("[WS] Redis KV Client Connected"));
    this.redisClientKV.connect();
  }

  public static getInstance() {
    if (!this.instance) {
      this.instance = new SubscriptionManager();
    }
    return this.instance;
  }

  public async subscribe(userId: string, subscription: string, authenticatedUserId: string | null = null) {
    console.log(`[WS] User ${userId} (authenticated as ${authenticatedUserId || 'anonymous'}) subscribing to ${subscription}`);
    if (this.subscriptions.get(userId)?.includes(subscription)) {
      return;
    }

    this.subscriptions.set(
      userId,
      (this.subscriptions.get(userId) || []).concat(subscription)
    );
    this.reverseSubscriptions.set(
      subscription,
      (this.reverseSubscriptions.get(subscription) || []).concat(userId)
    );
    if (this.reverseSubscriptions.get(subscription)?.length === 1) {
      console.log(`[WS] Subscribing to Redis channel: ${subscription}`);
      this.redisClient.subscribe(subscription, this.redisCallbackHandler);
    }

    if (subscription.startsWith("depth@")) {
      const market = subscription.split("@")[1];
      const snapshot = await this.redisClientKV.get(`depth_snapshot:${market}`);
      console.log(`[WS] Depth snapshot for ${market}: ${snapshot ? 'FOUND' : 'NOT FOUND'}`);
      if (snapshot) {
        const parsedSnapshot = JSON.parse(snapshot);
        console.log(`[WS] Sending depth snapshot to user ${userId}: ${parsedSnapshot.bids?.length || 0} bids, ${parsedSnapshot.asks?.length || 0} asks`);
        UserManager.getInstance().getUser(userId)?.emit({
          stream: subscription,
          data: {
            e: "depth",
            bids: parsedSnapshot.bids,
            asks: parsedSnapshot.asks,
            isSnapshot: true  // Flag to help frontend distinguish initial load
          }
        } as any);
      }
    }

    if (subscription.startsWith("trade@")) {
      const market = subscription.split("@")[1];
      const tradesStrings = await this.redisClientKV.lRange(`trades_snapshot:${market}`, 0, -1);
      console.log(`[WS] Trades snapshot for ${market}: ${tradesStrings?.length || 0} trades found`);

      if (tradesStrings && tradesStrings.length > 0) {
        const trades = tradesStrings.map(t => JSON.parse(t));
        console.log(`[WS] Sending ${trades.length} trades snapshot to user ${userId}`);

        UserManager.getInstance().getUser(userId)?.emit({
          stream: subscription,
          data: {
            e: "trade",
            trades: trades.map((t: any) => ({
              e: "trade",
              t: t.t,
              m: t.m,
              p: t.p,
              q: t.q,
              s: t.s, // market
              T: t.T
            })),
            isSnapshot: true  // Flag to help frontend distinguish initial load
          }
        } as any);
      }
    }

    // Handle open_orders subscription - no snapshot needed initially
    // Orders will stream as they are created/updated/cancelled
    if (subscription.startsWith("open_orders:user:")) {
      console.log(`[WS] User ${authenticatedUserId} subscribed to open orders stream`);
      // Future: could send current open orders snapshot here if needed
    }
  }

  private redisCallbackHandler = (message: string, channel: string) => {
    console.log(`[WS] Received message from Redis on channel: ${channel} and ${message}`);
    const parsedMessage = JSON.parse(message);
    this.reverseSubscriptions
      .get(channel)
      ?.forEach((s) =>
        UserManager.getInstance().getUser(s)?.emit(parsedMessage)
      );
  };

  public unsubscribe(userId: string, subscription: string) {
    const subscriptions = this.subscriptions.get(userId);
    if (subscriptions) {
      this.subscriptions.set(
        userId,
        subscriptions.filter((s) => s !== subscription)
      );
    }
    const reverseSubscriptions = this.reverseSubscriptions.get(subscription);
    if (reverseSubscriptions) {
      this.reverseSubscriptions.set(
        subscription,
        reverseSubscriptions.filter((s) => s !== userId)
      );
      if (this.reverseSubscriptions.get(subscription)?.length === 0) {
        this.reverseSubscriptions.delete(subscription);
        this.redisClient.unsubscribe(subscription);
      }
    }
  }

  public userLeft(userId: string) {
    console.log("user left " + userId);
    this.subscriptions.get(userId)?.forEach((s) => this.unsubscribe(userId, s));
  }

  getSubscriptions(userId: string) {
    return this.subscriptions.get(userId) || [];
  }
}
