import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { defaultFileStorePath } from "./file-store-path";

export interface BetaScanQuotaSettings {
  freeScanLimit: number;
  windowHours: number;
  updatedAt?: string;
}

interface BetaScanUsageRecord {
  count: number;
  resetAt: string;
  updatedAt: string;
}

interface BetaScanUsageResult {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
  retryAfterSeconds?: number;
}

interface BetaScanSettingsStore {
  get(): Promise<BetaScanQuotaSettings>;
  update(input: { freeScanLimit: number }): Promise<BetaScanQuotaSettings>;
}

interface BetaScanUsageStore {
  consume(keys: string | string[], settings: BetaScanQuotaSettings, now?: Date): Promise<BetaScanUsageResult>;
}

let settingsStore: BetaScanSettingsStore | null = null;
let usageStore: BetaScanUsageStore | null = null;

export function betaScanQuotaSettings(env: Record<string, string | undefined> = process.env): BetaScanQuotaSettings {
  return {
    freeScanLimit: clampInteger(env.BETA_FREE_SCAN_LIMIT, 5, 0, 1000),
    windowHours: clampInteger(env.BETA_FREE_SCAN_WINDOW_HOURS, 24, 1, 24 * 30)
  };
}

export function getBetaScanSettingsStore(): BetaScanSettingsStore {
  if (!settingsStore) {
    const databaseUrl = process.env.DATABASE_URL;
    settingsStore = databaseUrl?.startsWith("postgres")
      ? new PostgresBetaScanSettingsStore(databaseUrl)
      : new FileBetaScanSettingsStore(process.env.BETA_SCAN_SETTINGS_STORE_PATH);
  }

  return settingsStore;
}

export function getBetaScanUsageStore(): BetaScanUsageStore {
  if (!usageStore) {
    const databaseUrl = process.env.DATABASE_URL;
    usageStore = databaseUrl?.startsWith("postgres")
      ? new PostgresBetaScanUsageStore(databaseUrl)
      : new FileBetaScanUsageStore(process.env.BETA_SCAN_USAGE_STORE_PATH);
  }

  return usageStore;
}

export function resetBetaScanQuotaStoresForTests(
  nextSettingsStore: BetaScanSettingsStore | null,
  nextUsageStore: BetaScanUsageStore | null
) {
  settingsStore = nextSettingsStore;
  usageStore = nextUsageStore;
}

export function betaScanQuotaKey(scope: "request" | "owner", value: string) {
  const principal = `${scope}:${value.trim().slice(0, 256)}`;
  return createHash("sha256").update(`beta-free-scan:${principal}`).digest("hex");
}

export function betaScanQuotaKeys(ownerToken: string | null | undefined, requestKey: string) {
  const normalizedOwnerToken = ownerToken?.trim().slice(0, 256);
  const keys = [betaScanQuotaKey("request", requestKey)];

  if (normalizedOwnerToken) {
    keys.push(betaScanQuotaKey("owner", normalizedOwnerToken));
  }

  return [...new Set(keys)];
}

export async function assertBetaScanQuota(
  store: BetaScanUsageStore,
  key: string | string[],
  settings: BetaScanQuotaSettings,
  now = new Date()
): Promise<BetaScanUsageResult> {
  return store.consume(key, settings, now);
}

export async function consumeBetaScanQuota(request: Request, ownerToken: string | null | undefined) {
  const settings = await getBetaScanSettingsStore().get();
  const keys = betaScanQuotaKeys(ownerToken, requestIdentity(request));
  return getBetaScanUsageStore().consume(keys, settings);
}

export class FileBetaScanSettingsStore implements BetaScanSettingsStore {
  private readonly filePath: string;
  private queue = Promise.resolve();

  constructor(filePath = defaultFileStorePath("beta-scan-settings.json")) {
    this.filePath = filePath;
  }

  get(): Promise<BetaScanQuotaSettings> {
    return this.withQueue(async () => {
      const persisted = await this.read();
      return {
        ...betaScanQuotaSettings(),
        ...persisted
      };
    });
  }

  update(input: { freeScanLimit: number }): Promise<BetaScanQuotaSettings> {
    return this.withQueue(async () => {
      const current = await this.read();
      const next: BetaScanQuotaSettings = {
        ...betaScanQuotaSettings(),
        ...current,
        freeScanLimit: normalizeFreeScanLimit(input.freeScanLimit),
        updatedAt: new Date().toISOString()
      };
      await this.write(next);
      return next;
    });
  }

  private async read(): Promise<Partial<BetaScanQuotaSettings>> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      try {
        const parsed = JSON.parse(raw) as Partial<BetaScanQuotaSettings>;
        return {
          freeScanLimit:
            typeof parsed.freeScanLimit === "number" ? normalizeFreeScanLimit(parsed.freeScanLimit) : undefined,
          updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined
        };
      } catch (parseError) {
        if (parseError instanceof SyntaxError) {
          await backupCorruptFile(this.filePath);
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

  private write(settings: BetaScanQuotaSettings): Promise<void> {
    return atomicWriteJson(this.filePath, settings);
  }

  private async withQueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation, operation);
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }
}

export class FileBetaScanUsageStore implements BetaScanUsageStore {
  private readonly filePath: string;
  private queue = Promise.resolve();

  constructor(filePath = defaultFileStorePath("beta-scan-usage.json")) {
    this.filePath = filePath;
  }

  consume(keys: string | string[], settings: BetaScanQuotaSettings, now = new Date()): Promise<BetaScanUsageResult> {
    return this.withQueue(async () => {
      const quotaKeys = [...new Set(Array.isArray(keys) ? keys : [keys])];
      const usage = await this.readAll();
      const windows: Array<{ key: string; resetAt: Date; activeCount: number }> = quotaKeys.map((key) => {
        const current = usage[key];
        const isActive = current && new Date(current.resetAt).getTime() > now.getTime();
        const resetAt = isActive
          ? new Date(current.resetAt)
          : new Date(now.getTime() + settings.windowHours * 60 * 60 * 1000);
        const activeCount = isActive ? current.count : 0;
        return { key, resetAt, activeCount };
      });
      const exhausted = windows.find((window) => window.activeCount >= settings.freeScanLimit);

      if (exhausted) {
        return {
          allowed: false,
          limit: settings.freeScanLimit,
          used: exhausted.activeCount,
          remaining: 0,
          resetAt: exhausted.resetAt.toISOString(),
          retryAfterSeconds: Math.max(1, Math.ceil((exhausted.resetAt.getTime() - now.getTime()) / 1000))
        };
      }

      let used = 0;
      let remaining = settings.freeScanLimit;
      let resetAt = windows[0]?.resetAt ?? new Date(now.getTime() + settings.windowHours * 60 * 60 * 1000);

      for (const window of windows) {
        const nextCount = window.activeCount + 1;
        used = Math.max(used, nextCount);
        remaining = Math.min(remaining, Math.max(0, settings.freeScanLimit - nextCount));
        if (window.resetAt.getTime() < resetAt.getTime()) resetAt = window.resetAt;
        usage[window.key] = {
          count: nextCount,
          resetAt: window.resetAt.toISOString(),
          updatedAt: now.toISOString()
        };
      }
      await this.writeAll(usage);

      return {
        allowed: true,
        limit: settings.freeScanLimit,
        used,
        remaining,
        resetAt: resetAt.toISOString()
      };
    });
  }

  private async readAll(): Promise<Record<string, BetaScanUsageRecord>> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      try {
        return JSON.parse(raw) as Record<string, BetaScanUsageRecord>;
      } catch (parseError) {
        if (parseError instanceof SyntaxError) {
          await backupCorruptFile(this.filePath);
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

  private writeAll(usage: Record<string, BetaScanUsageRecord>): Promise<void> {
    return atomicWriteJson(this.filePath, usage);
  }

  private async withQueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation, operation);
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }
}

class PostgresBetaScanSettingsStore implements BetaScanSettingsStore {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
    });
  }

  async get(): Promise<BetaScanQuotaSettings> {
    const defaults = betaScanQuotaSettings();
    const result = await this.pool.query(
      `select free_scan_limit, window_hours, updated_at
       from beta_scan_settings
       where id = 'default'
       limit 1`
    );
    const row = result.rows[0];
    if (!row) return defaults;

    return {
      freeScanLimit: normalizeFreeScanLimit(Number(row.free_scan_limit)),
      windowHours: clampInteger(String(row.window_hours), defaults.windowHours, 1, 24 * 30),
      updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : undefined
    };
  }

  async update(input: { freeScanLimit: number }): Promise<BetaScanQuotaSettings> {
    const defaults = betaScanQuotaSettings();
    const result = await this.pool.query(
      `insert into beta_scan_settings (id, free_scan_limit, window_hours, updated_at)
       values ('default', $1, $2, now())
       on conflict (id) do update set
         free_scan_limit = excluded.free_scan_limit,
         window_hours = excluded.window_hours,
         updated_at = excluded.updated_at
       returning free_scan_limit, window_hours, updated_at`,
      [normalizeFreeScanLimit(input.freeScanLimit), defaults.windowHours]
    );
    const row = result.rows[0];
    return {
      freeScanLimit: normalizeFreeScanLimit(Number(row.free_scan_limit)),
      windowHours: clampInteger(String(row.window_hours), defaults.windowHours, 1, 24 * 30),
      updatedAt: new Date(String(row.updated_at)).toISOString()
    };
  }
}

class PostgresBetaScanUsageStore implements BetaScanUsageStore {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
    });
  }

  async consume(keys: string | string[], settings: BetaScanQuotaSettings, now = new Date()): Promise<BetaScanUsageResult> {
    const quotaKeys = [...new Set(Array.isArray(keys) ? keys : [keys])];
    const client = await this.pool.connect();

    try {
      await client.query("begin");
      const existing = await client.query(
        `select quota_key, count, reset_at
         from beta_scan_usage
         where quota_key = any($1::text[])
         for update`,
        [quotaKeys]
      );
      const usageByKey = new Map(existing.rows.map((row) => [String(row.quota_key), row]));
      const windows: Array<{ key: string; resetAt: Date; activeCount: number }> = quotaKeys.map((key) => {
        const current = usageByKey.get(key);
        const resetAtValue = current?.reset_at ? new Date(String(current.reset_at)) : null;
        const isActive = resetAtValue ? resetAtValue.getTime() > now.getTime() : false;
        const resetAt: Date = isActive && resetAtValue
          ? resetAtValue
          : new Date(now.getTime() + settings.windowHours * 60 * 60 * 1000);
        const activeCount = isActive ? Number(current?.count ?? 0) : 0;
        return { key, resetAt, activeCount };
      });
      const exhausted = windows.find((window) => window.activeCount >= settings.freeScanLimit);

      if (exhausted) {
        await client.query("rollback");
        return {
          allowed: false,
          limit: settings.freeScanLimit,
          used: exhausted.activeCount,
          remaining: 0,
          resetAt: exhausted.resetAt.toISOString(),
          retryAfterSeconds: Math.max(1, Math.ceil((exhausted.resetAt.getTime() - now.getTime()) / 1000))
        };
      }

      let used = 0;
      let remaining = settings.freeScanLimit;
      let resetAt = windows[0]?.resetAt ?? new Date(now.getTime() + settings.windowHours * 60 * 60 * 1000);

      for (const window of windows) {
        const nextCount = window.activeCount + 1;
        used = Math.max(used, nextCount);
        remaining = Math.min(remaining, Math.max(0, settings.freeScanLimit - nextCount));
        if (window.resetAt.getTime() < resetAt.getTime()) resetAt = window.resetAt;
        await client.query(
          `insert into beta_scan_usage (quota_key, count, reset_at, updated_at)
           values ($1, $2, $3, $4)
           on conflict (quota_key) do update set
             count = excluded.count,
             reset_at = excluded.reset_at,
             updated_at = excluded.updated_at`,
          [window.key, nextCount, window.resetAt.toISOString(), now.toISOString()]
        );
      }

      await client.query("commit");
      return {
        allowed: true,
        limit: settings.freeScanLimit,
        used,
        remaining,
        resetAt: resetAt.toISOString()
      };
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

function requestIdentity(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "anonymous";
  const userAgent = (request.headers.get("user-agent") ?? "unknown-agent").trim().replace(/\s+/g, " ").slice(0, 160);
  return `${ip}\n${userAgent}`;
}

function normalizeFreeScanLimit(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 1000) {
    throw new Error("FREE_SCAN_LIMIT_INVALID");
  }

  return value;
}

function clampInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function backupCorruptFile(filePath: string) {
  const suffix = new Date().toISOString().replace(/[:.]/g, "-");
  await rename(filePath, `${filePath}.corrupt-${suffix}`).catch(() => undefined);
}

async function atomicWriteJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tempPath, JSON.stringify(value, null, 2), "utf-8");
  try {
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}
