import { RedisClientType, createClient } from "redis";
import { UserManager } from "./UserManager";

export class SubscriptionManager {
  private static instance: SubscriptionManager;
  private subscriptions: Map<string, string[]> = new Map();
  private reverseSubscriptions: Map<string, string[]> = new Map();
  private redisClient: RedisClientType;
  private redisClientKV: RedisClientType;

  private constructor() {
    this.redisClient = createClient();
    this.redisClient.on("error", (err) => console.log("[WS] Redis Client Error", err));
    this.redisClient.on("connect", () => console.log("[WS] Redis Client Connected"));
    this.redisClient.connect();

    this.redisClientKV = createClient();
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

  public async subscribe(userId: string, subscription: string) {
    console.log(`[WS] User ${userId} subscribing to ${subscription}`);
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
      if (snapshot) {
        const parsedSnapshot = JSON.parse(snapshot);
        UserManager.getInstance().getUser(userId)?.emit({
          stream: subscription,
          data: {
            e: "depth",
            bids: parsedSnapshot.bids,
            asks: parsedSnapshot.asks
          }
        } as any);
      }
    }

    if (subscription.startsWith("trade@")) {
      const market = subscription.split("@")[1];
      const snapshot = await this.redisClientKV.get(`trades_snapshot:${market}`);
      if (snapshot) {
        const parsedSnapshot = JSON.parse(snapshot);
        UserManager.getInstance().getUser(userId)?.emit({
          stream: subscription,
          data: {
            e: "trade",
            trades: parsedSnapshot.map((t: any) => ({
              e: "trade",
              t: t.tradeId,
              m: t.isBuyerMaker,
              p: t.price,
              q: t.quantity.toString(),
              s: market,
              T: t.timestamp
            }))
          }
        } as any);
      }
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
