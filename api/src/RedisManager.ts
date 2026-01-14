
import { RedisClientType, createClient } from "redis";
import { MessageFromOrderbook } from "./types";
import { MessageToEngine } from "./types/to";
import { config } from "./config";

export class RedisManager {
    private client: RedisClientType;
    private publisher: RedisClientType;
    private static instance: RedisManager;

    private constructor() {
        const redisUrl = config.redis.url;
        console.log(`[API RedisManager] Connecting to Redis at: ${redisUrl}`);

        this.client = createClient({ url: redisUrl });
        this.client.connect();
        this.publisher = createClient({ url: redisUrl });
        this.publisher.connect();
    }

    public static getInstance() {
        if (!this.instance) {
            this.instance = new RedisManager();
        }
        return this.instance;
    }

    public getRandomClientId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    public sendAndAwait(message: MessageToEngine) {
        return new Promise<MessageFromOrderbook>((resolve) => {
            const id = this.getRandomClientId();
            this.client.subscribe(id, (message) => {
                this.client.unsubscribe(id);
                resolve(JSON.parse(message));
            }).then(() => {
                this.publisher.lPush("messages", JSON.stringify({ clientId: id, message }));
            });
        });
    }

    public pushMessage(message: MessageToEngine) {
        const id = this.getRandomClientId();
        this.publisher.lPush("messages", JSON.stringify({ clientId: id, message }));
    }

}