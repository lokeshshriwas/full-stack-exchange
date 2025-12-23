const { Client } = require("pg");

const client = new Client({
  user: "postgres",
  host: "localhost",
  database: "exchange-platform",
  password: "020802",
  port: 5432,
});

async function verify() {
  console.log("Connecting to DB...");
  await client.connect();
  console.log("Connected. Querying...");
  const res = await client.query(
    "SELECT market, created_at, last_trade_id FROM orderbook_snapshots"
  );
  console.log("Snapshots found:", res.rows.length);
  res.rows.forEach((r) => console.log(r));
  await client.end();
}

verify().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});
