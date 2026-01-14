import { createClient, } from "redis";
import { Engine } from "./trade/Engine";
import { config } from "./config";


async function main() {
    const engine = new Engine();
    await engine.init();

    console.log(`[Engine] Connecting to Redis at: ${config.redis.url}`);
    const redisClient = createClient({ url: config.redis.url });
    await redisClient.connect();
    console.log("[Engine] Connected to Redis");

    while (true) {
        const response = await redisClient.rPop("messages" as string)
        if (!response) {

        } else {
            await engine.process(JSON.parse(response));
        }
    }

}

main();