import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { defaultFileStorePath } from "./file-store-path";
import { resolvePostgresUrl } from "./postgres-env";
import type { MonitoringSubscription } from "./types";

export interface MonitoringRepository {
  upsert(subscription: MonitoringSubscription): Promise<MonitoringSubscription>;
  getByOwnerTokenHash(ownerTokenHash: string): Promise<MonitoringSubscription | null>;
  getById(monitoringId: string): Promise<MonitoringSubscription | null>;
  markDeleted(monitoringId: string, ownerTokenHash: string, now?: Date): Promise<MonitoringSubscription | null>;
  listDue(now?: Date, limit?: number): Promise<MonitoringSubscription[]>;
}

let monitoringRepository: MonitoringRepository | null = null;

export function getMonitoringRepository(): MonitoringRepository {
  if (monitoringRepository) return monitoringRepository;

  const databaseUrl = resolvePostgresUrl();
  monitoringRepository = databaseUrl
    ? new PostgresMonitoringRepository(databaseUrl)
    : new FileMonitoringRepository(process.env.MONITORING_STORE_PATH);

  return monitoringRepository;
}

export function resetMonitoringRepositoryForTests(nextRepository: MonitoringRepository | null) {
  monitoringRepository = nextRepository;
}

export class FileMonitoringRepository implements MonitoringRepository {
  private readonly filePath: string;
  private queue = Promise.resolve();

  constructor(filePath = defaultFileStorePath("monitoring.json")) {
    this.filePath = filePath;
  }

  async upsert(subscription: MonitoringSubscription): Promise<MonitoringSubscription> {
    return this.withQueue(async () => {
      const subscriptions = await this.readAll();
      const existing = Object.values(subscriptions).find(
        (item) => item.ownerTokenHash === subscription.ownerTokenHash && item.status !== "DELETED"
      );
      const next = existing ? { ...subscription, monitoringId: existing.monitoringId, createdAt: existing.createdAt } : subscription;
      subscriptions[next.monitoringId] = next;
      await this.writeAll(subscriptions);
      return next;
    });
  }

  async getByOwnerTokenHash(ownerTokenHash: string): Promise<MonitoringSubscription | null> {
    return this.withQueue(async () => {
      const subscriptions = await this.readAll();
      return (
        Object.values(subscriptions).find((item) => item.ownerTokenHash === ownerTokenHash && item.status !== "DELETED") ?? null
      );
    });
  }

  async getById(monitoringId: string): Promise<MonitoringSubscription | null> {
    return this.withQueue(async () => {
      const subscriptions = await this.readAll();
      const subscription = subscriptions[monitoringId] ?? null;
      return subscription?.status === "DELETED" ? null : subscription;
    });
  }

  async markDeleted(monitoringId: string, ownerTokenHash: string, now = new Date()): Promise<MonitoringSubscription | null> {
    return this.withQueue(async () => {
      const subscriptions = await this.readAll();
      const subscription = subscriptions[monitoringId];
      if (!subscription || subscription.ownerTokenHash !== ownerTokenHash || subscription.status === "DELETED") return null;

      const next: MonitoringSubscription = {
        ...subscription,
        status: "DELETED",
        updatedAt: now.toISOString()
      };
      subscriptions[monitoringId] = next;
      await this.writeAll(subscriptions);
      return next;
    });
  }

  async listDue(now = new Date(), limit = 10): Promise<MonitoringSubscription[]> {
    return this.withQueue(async () => {
      const subscriptions = await this.readAll();
      return Object.values(subscriptions)
        .filter((item) => item.status === "ACTIVE" && new Date(item.nextRunAt).getTime() <= now.getTime())
        .sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())
        .slice(0, limit);
    });
  }

  private async readAll(): Promise<Record<string, MonitoringSubscription>> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      try {
        return JSON.parse(raw) as Record<string, MonitoringSubscription>;
      } catch (parseError) {
        if (parseError instanceof SyntaxError) {
          await this.backupCorruptFile();
          return {};
        }
        throw parseError;
      }
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
      if (code === "ENOENT") return {};
      throw error;
    }
  }

  private async backupCorruptFile() {
    const suffix = new Date().toISOString().replace(/[:.]/g, "-");
    await rename(this.filePath, `${this.filePath}.corrupt-${suffix}`).catch(() => undefined);
  }

  private async withQueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation, operation);
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private async writeAll(subscriptions: Record<string, MonitoringSubscription>) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await writeFile(tempPath, JSON.stringify(subscriptions, null, 2), "utf-8");
    try {
      await rename(tempPath, this.filePath);
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}

class PostgresMonitoringRepository implements MonitoringRepository {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
    });
  }

  async upsert(subscription: MonitoringSubscription): Promise<MonitoringSubscription> {
    await this.pool.query(
      `insert into monitoring_subscriptions (
        id, owner_token_hash, usernames, purpose, cadence, status, latest_scan_ids,
        created_at, updated_at, last_run_at, next_run_at
      ) values ($1,$2,$3::jsonb,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)
      on conflict (owner_token_hash) where status <> 'DELETED' do update set
        usernames = excluded.usernames,
        purpose = excluded.purpose,
        cadence = excluded.cadence,
        status = excluded.status,
        latest_scan_ids = excluded.latest_scan_ids,
        updated_at = excluded.updated_at,
        last_run_at = excluded.last_run_at,
        next_run_at = excluded.next_run_at
      returning *`,
      subscriptionToParams(subscription)
    );
    const existing = await this.getByOwnerTokenHash(subscription.ownerTokenHash);
    return existing ?? subscription;
  }

  async getByOwnerTokenHash(ownerTokenHash: string): Promise<MonitoringSubscription | null> {
    const result = await this.pool.query(
      `select * from monitoring_subscriptions where owner_token_hash = $1 and status <> 'DELETED' limit 1`,
      [ownerTokenHash]
    );
    return result.rows[0] ? mapMonitoringRow(result.rows[0]) : null;
  }

  async getById(monitoringId: string): Promise<MonitoringSubscription | null> {
    const result = await this.pool.query(
      `select * from monitoring_subscriptions where id = $1 and status <> 'DELETED' limit 1`,
      [monitoringId]
    );
    return result.rows[0] ? mapMonitoringRow(result.rows[0]) : null;
  }

  async markDeleted(monitoringId: string, ownerTokenHash: string, now = new Date()): Promise<MonitoringSubscription | null> {
    const result = await this.pool.query(
      `update monitoring_subscriptions
       set status = 'DELETED', updated_at = $3
       where id = $1 and owner_token_hash = $2 and status <> 'DELETED'
       returning *`,
      [monitoringId, ownerTokenHash, now.toISOString()]
    );
    return result.rows[0] ? mapMonitoringRow(result.rows[0]) : null;
  }

  async listDue(now = new Date(), limit = 10): Promise<MonitoringSubscription[]> {
    const result = await this.pool.query(
      `select * from monitoring_subscriptions
       where status = 'ACTIVE' and next_run_at <= $1
       order by next_run_at asc
       limit $2`,
      [now.toISOString(), limit]
    );
    return result.rows.map(mapMonitoringRow);
  }
}

function subscriptionToParams(subscription: MonitoringSubscription) {
  return [
    subscription.monitoringId,
    subscription.ownerTokenHash,
    JSON.stringify(subscription.usernames),
    subscription.purpose,
    subscription.cadence,
    subscription.status,
    JSON.stringify(subscription.latestScanIds),
    subscription.createdAt,
    subscription.updatedAt,
    subscription.lastRunAt,
    subscription.nextRunAt
  ];
}

function mapMonitoringRow(row: Record<string, unknown>): MonitoringSubscription {
  return {
    monitoringId: String(row.id),
    ownerTokenHash: String(row.owner_token_hash),
    usernames: row.usernames as string[],
    purpose: row.purpose as MonitoringSubscription["purpose"],
    cadence: row.cadence as MonitoringSubscription["cadence"],
    status: row.status as MonitoringSubscription["status"],
    latestScanIds: row.latest_scan_ids as Record<string, string>,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    lastRunAt: row.last_run_at ? new Date(String(row.last_run_at)).toISOString() : null,
    nextRunAt: new Date(String(row.next_run_at)).toISOString()
  };
}
