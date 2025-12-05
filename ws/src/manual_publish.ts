
import { createClient } from "redis";

async function main() {
    const client = createClient();
    await client.connect();
    console.log("Connected to Redis");

    const channel = "depth@SOL_USDC";
    const message = JSON.stringify({
        e: "depth",
        b: [["100.0", "1.0"]],
        a: [["101.0", "1.0"]],
        s: "SOL_USDC"
    });

    console.log(`Publishing to ${channel}...`);
    await client.publish(channel, message);
    console.log("Published. Check WS logs.");

    await client.disconnect();
}

main();
