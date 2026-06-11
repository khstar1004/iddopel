import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

if (process.env.DATABASE_URL?.startsWith("postgres")) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
  });

  try {
    const result = await pool.query("delete from scan_jobs where expires_at <= now()");
    console.log(`Pruned ${result.rowCount ?? 0} expired scan(s) from Postgres.`);
  } finally {
    await pool.end();
  }
} else {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const filePath = process.env.SCAN_STORE_PATH || join(root, ".data", "scans.json");
  let jobs = {};

  try {
    jobs = JSON.parse(await readFile(filePath, "utf-8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const now = Date.now();
  const before = Object.keys(jobs).length;
  const active = Object.fromEntries(
    Object.entries(jobs).filter(([, job]) => new Date(job.expiresAt).getTime() > now)
  );

  await mkdir(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(active, null, 2), "utf-8");
  await rename(tempPath, filePath);
  console.log(`Pruned ${before - Object.keys(active).length} expired scan(s) from local store.`);
}
