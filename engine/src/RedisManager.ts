import { DEPTH_UPDATE, TICKER_UPDATE } from "./trade/events";
import { RedisClientType, createClient } from "redis";
import { ORDER_UPDATE, TRADE_ADDED } from "./types";
import { WsMessage } from "./types/toWs";
import { MessageToApi } from "./types/toApi";

type DbMessage = {
    type: typeof TRADE_ADDED,
    data: {
        id: string,
        isBuyerMaker: boolean,
        price: string,
        quantity: string,
        quoteQuantity: string,
        timestamp: number,
        market: string,
        userId: string,
        status: "filled" | "partial" | "open",
        orderId: string
    }
} | {
    type: "ORDER_PLACED",
    data: {
        orderId: string,
        executedQty: number,
        market: string,
        price: string,
        quantity: string,
        side: "buy" | "sell",
        userId: string,
        status: "open" | "filled" | "partial",
        timestamp: number
    }
} | {
    type: "SNAPSHOT_SAVED",
    data: {
        market: string,
        bids: any[],
        asks: any[],
        lastTradeId: number
    }
} | {
    type: typeof ORDER_UPDATE,
    data: {
        orderId: string,
        executedQty: number,
        market?: string,
        price?: string,
        quantity?: string,
        side?: "buy" | "sell",
        userId?: string
    }
} | {
    type: "ORDER_CANCELLED",
    data: {
        orderId: string,
        executedQty: number,
        market: string,
        remainingQty: number
    }
}

export class RedisManager {
    private client: RedisClientType;
    private static instance: RedisManager;

    constructor() {
        this.client = createClient();
        this.client.connect();
    }

    public static getInstance() {
        if (!this.instance) {
            this.instance = new RedisManager();
        }
        return this.instance;
    }

    public pushMessage(message: DbMessage) {
        this.client.lPush("db_processor", JSON.stringify(message));
    }

    public publishMessage(channel: string, message: WsMessage) {
        this.client.publish(channel, JSON.stringify(message));
    }

    public sendToApi(clientId: string, message: MessageToApi) {
        this.client.publish(clientId, JSON.stringify(message));
    }

    public set(key: string, value: string) {
        this.client.set(key, value);
    }

    public async get(key: string) {
        return this.client.get(key);
    }

    public async pushToQueue(key: string, value: string) {
        await this.client.lPush(key, value);
    }

    public async trimQueue(key: string, maxLength: number) {
        await this.client.lTrim(key, 0, maxLength - 1);
    }


    public async getQueue(key: string) {
        return await this.client.lRange(key, 0, -1);
    }

    public async updateBalance(
        userId: string,
        asset: string,
        availableChange: number,
        lockedChange: number,
        eventType: "trade" | "order_place" | "cancel" | "deposit",
        eventId: string
    ): Promise<boolean> {
        const key = `balances:${userId}:${asset}`;
        const queueKey = "db_balance_updates";
        const script = `
            local key = KEYS[1]
            local queueKey = KEYS[2]
            
            local availableChange = tonumber(ARGV[1])
            local lockedChange = tonumber(ARGV[2])
            local userId = ARGV[3]
            local asset = ARGV[4]
            local eventType = ARGV[5]
            local eventId = ARGV[6]
            local timestamp = ARGV[7]
            
            local currentAvailable = tonumber(redis.call("HGET", key, "available") or "0")
            local currentLocked = tonumber(redis.call("HGET", key, "locked") or "0")
            
            local newAvailable = currentAvailable + availableChange
            local newLocked = currentLocked + lockedChange
            
            if newAvailable < 0 or newLocked < 0 then
                return nil
            end
            
            redis.call("HSET", key, "available", newAvailable, "locked", newLocked)
            
            local payload = cjson.encode({
                userId = userId,
                asset = asset,
                amountChange = availableChange + lockedChange,
                availableChange = availableChange,
                lockedChange = lockedChange,
                type = eventType,
                eventId = eventId,
                timestamp = timestamp
            })
            redis.call("RPUSH", queueKey, payload)
            
            return {newAvailable, newLocked}
        `;

        try {
            // @ts-ignore
            const result = await this.client.eval(script, {
                keys: [key, queueKey],
                arguments: [
                    availableChange.toString(),
                    lockedChange.toString(),
                    userId,
                    asset,
                    eventType,
                    eventId,
                    Date.now().toString()
                ]
            });
            return result !== null;
        } catch (e) {
            console.error("Redis Lua Error:", e);
            throw e;
        }
    }

    public async getBalance(userId: string, asset: string) {
        const key = `balances:${userId}:${asset}`;
        const result = await this.client.hGetAll(key);
        return {
            available: Number(result.available || 0),
            locked: Number(result.locked || 0)
        };
    }

    public async syncBalance(userId: string, asset: string, dbAvailable: number, dbLocked: number) {
        const key = `balances:${userId}:${asset}`;
        const currentBalance = await this.client.hGetAll(key);

        if (!currentBalance || Object.keys(currentBalance).length === 0) {
            await this.client.hSet(key, {
                available: dbAvailable.toString(),
                locked: dbLocked.toString()
            });
            console.log(`[Redis] Initialized balance for user ${userId} asset ${asset}: ${dbAvailable} available, ${dbLocked} locked`);
            return;
        }

        const redisAvailable = Number(currentBalance.available || 0);
        const redisLocked = Number(currentBalance.locked || 0);
        const redisTotal = redisAvailable + redisLocked;
        const dbTotal = dbAvailable + dbLocked;

        // If Redis has less funds than DB, top up the difference to available
        if (dbTotal > redisTotal) {
            const diff = dbTotal - redisTotal;
            const newAvailable = redisAvailable + diff;

            await this.client.hSet(key, "available", newAvailable.toString());
            console.log(`[Redis] Topped up balance for user ${userId} asset ${asset} by ${diff}. New Available: ${newAvailable}`);
        }
    }
}