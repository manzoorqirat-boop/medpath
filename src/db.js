const { Pool } = require("pg");
const logger   = require("./utils/logger");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  logger.error("Unexpected database client error:", err);
});

async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  logger.debug(`Query (${Date.now() - start}ms): ${text.slice(0, 80)}`);
  return result;
}

async function getClient() {
  return pool.connect();
}

async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function testConnection() {
  try {
    await pool.query("SELECT 1");
    logger.info("PostgreSQL connected ✓");
    return true;
  } catch (err) {
    logger.error("PostgreSQL connection failed:", err.message);
    return false;
  }
}

module.exports = { query, getClient, transaction, testConnection };
