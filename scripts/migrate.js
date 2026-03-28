require("dotenv").config();
const fs   = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:lkyPnnqpIMbAViDTXmVUEJSclBOlGydv@gondola.proxy.rlwy.net:32399/railway",
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  console.log("Running migrations...");
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`);

    const migrDir = path.join(__dirname, "../migrations");
    const files   = fs.readdirSync(migrDir).filter(f => f.endsWith(".sql")).sort();

    for (const file of files) {
      const { rows } = await client.query(
        "SELECT 1 FROM _migrations WHERE filename=$1", [file]);
      if (rows.length) { console.log(`  Already applied: ${file}`); continue; }

      const sql = fs.readFileSync(path.join(migrDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations(filename) VALUES($1)", [file]);
        await client.query("COMMIT");
        console.log(`  Applied: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`  FAILED: ${file}`, err.message);
        process.exit(1);
      }
    }
    console.log("All migrations complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => { console.error(err); process.exit(1); });