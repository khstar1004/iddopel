import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for Postgres migration.");
  process.exit(1);
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const schema = await readFile(join(root, "db", "schema.sql"), "utf-8");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
});

try {
  await pool.query(schema);
  console.log("Postgres schema is ready.");
} finally {
  await pool.end();
}
