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
    -- Drop tables in dependency order
    DROP TABLE IF EXISTS spot_positions;
    DROP TABLE IF EXISTS balances;
    DROP TABLE IF EXISTS markets;
    DROP TABLE IF EXISTS assets;
    DROP TABLE IF EXISTS users;

    -- USERS
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- ASSETS
    CREATE TABLE assets (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(20) UNIQUE NOT NULL,
      decimals INT NOT NULL
    );

    -- MARKETS (SPOT ONLY)
    CREATE TABLE markets (
      id SERIAL PRIMARY KEY,
      base_asset_id INT NOT NULL REFERENCES assets(id),
      quote_asset_id INT NOT NULL REFERENCES assets(id),
      symbol VARCHAR(30) UNIQUE NOT NULL
    );

    -- USER BALANCES (HOLDINGS)
    CREATE TABLE balances (
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      asset_id INT NOT NULL REFERENCES assets(id),
      available NUMERIC(36,18) DEFAULT 0,
      locked NUMERIC(36,18) DEFAULT 0,
      PRIMARY KEY (user_id, asset_id)
    );

    -- USER SPOT POSITIONS (MARKET-WISE)
    CREATE TABLE spot_positions (
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      market_id INT NOT NULL REFERENCES markets(id),
      base_quantity NUMERIC(36,18) DEFAULT 0,
      avg_buy_price NUMERIC(36,18),
      updated_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, market_id)
    );
  `);

  await client.end();
  console.log("Database initialized successfully");
}

initializeDB().catch(console.error);
