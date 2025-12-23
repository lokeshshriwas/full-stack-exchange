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
        market: string
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
        userId: string
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
}