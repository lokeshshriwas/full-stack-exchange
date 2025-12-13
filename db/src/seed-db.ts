const { Client } = require("pg");

const client = new Client({
  user: "postgres",
  host: "localhost",
  database: "exchange-platform",
  password: "020802",
  port: 5432,
});

async function initializeDB() {
  await client.connect();

  await client.query(`
        DROP TABLE IF EXISTS "users";
        CREATE TABLE "users" (
          id SERIAL PRIMARY KEY,
          full_name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
    `);
  await client.query(`
        DROP TABLE IF EXISTS "BTC_USDC_price";
        CREATE TABLE "BTC_USDC_price"(
            time            TIMESTAMP WITH TIME ZONE NOT NULL,
            price   DOUBLE PRECISION,
            volume      DOUBLE PRECISION,
            currency_code   VARCHAR (10)
        );
    `);

  await client.query(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS klines_1m AS
        SELECT
            time_bucket('1 minute', time) AS bucket,
            first(price, time) AS open,
            max(price) AS high,
            min(price) AS low,
            last(price, time) AS close,
            sum(volume) AS volume,
            currency_code
        FROM BTC_USDC_price
        GROUP BY bucket, currency_code;
    `);

  await client.query(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS klines_1h AS
        SELECT
            time_bucket('1 hour', time) AS bucket,
            first(price, time) AS open,
            max(price) AS high,
            min(price) AS low,
            last(price, time) AS close,
            sum(volume) AS volume,
            currency_code
        FROM BTC_USDC_price
        GROUP BY bucket, currency_code;
    `);

  await client.query(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS klines_1w AS
        SELECT
            time_bucket('1 week', time) AS bucket,
            first(price, time) AS open,
            max(price) AS high,
            min(price) AS low,
            last(price, time) AS close,
            sum(volume) AS volume,
            currency_code
        FROM BTC_USDC_price
        GROUP BY bucket, currency_code;
    `);

  await client.end();
  console.log("Database initialized successfully");
}

initializeDB().catch(console.error);
