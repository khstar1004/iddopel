import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { resolvePostgresUrl } from "./postgres-env.mjs";

const { Pool } = pg;
const databaseUrl = resolvePostgresUrl();

if (!databaseUrl) {
  console.error("DATABASE_URL or POSTGRES_URL is required for Postgres migration.");
  process.exit(1);
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const schema = await readFile(join(root, "db", "schema.sql"), "utf-8");
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
});

try {
  await pool.query(schema);
  console.log("Postgres schema is ready.");
} finally {
  await pool.end();
}
