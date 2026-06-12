import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { defaultFileStorePath } from "./file-store-path";

export interface BetaScanQuotaSettings {
  publicScanEnabled: boolean;
  freeScanLimit: number;
  windowHours: number;
  maxConcurrentScans: number;
  busyRetryAfterSeconds: number;
  scanLeaseTtlSeconds: number;
  updatedAt?: string;
}

export type BetaScanSettingsUpdate = Partial<
  Pick<
    BetaScanQuotaSettings,
    | "publicScanEnabled"
    | "freeScanLimit"
    | "windowHours"
    | "maxConcurrentScans"
    | "busyRetryAfterSeconds"
    | "scanLeaseTtlSeconds"
  >
>;

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
  update(input: BetaScanSettingsUpdate): Promise<BetaScanQuotaSettings>;
}

interface BetaScanUsageStore {
  consume(keys: string | string[], settings: BetaScanQuotaSettings, now?: Date): Promise<BetaScanUsageResult>;
}

interface BetaScanLoadLease {
  allowed: boolean;
  active: number;
  limit: number;
  retryAfterSeconds: number;
  release?: () => Promise<void>;
}

interface BetaScanLoadRecord {
  leases: Record<string, { expiresAt: string; createdAt: string }>;
}

interface BetaScanLoadStore {
  acquire(settings: BetaScanQuotaSettings, now?: Date): Promise<BetaScanLoadLease>;
}

let settingsStore: BetaScanSettingsStore | null = null;
let usageStore: BetaScanUsageStore | null = null;
let loadStore: BetaScanLoadStore | null = null;

export function betaScanQuotaSettings(env: Record<string, string | undefined> = process.env): BetaScanQuotaSettings {
  return {
    publicScanEnabled: parseBoolean(env.BETA_PUBLIC_SCAN_ENABLED, true),
    freeScanLimit: clampInteger(env.BETA_FREE_SCAN_LIMIT, 5, 0, 1000),
    windowHours: clampInteger(env.BETA_FREE_SCAN_WINDOW_HOURS, 24, 1, 24 * 30),
    maxConcurrentScans: clampInteger(env.BETA_MAX_CONCURRENT_SCANS, 6, 1, 50),
    busyRetryAfterSeconds: clampInteger(env.BETA_SCAN_BUSY_RETRY_AFTER_SECONDS, 30, 1, 3600),
    scanLeaseTtlSeconds: clampInteger(env.BETA_SCAN_LEASE_TTL_SECONDS, 90, 10, 600)
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

export function getBetaScanLoadStore(): BetaScanLoadStore {
  if (!loadStore) {
    const databaseUrl = process.env.DATABASE_URL;
    loadStore = databaseUrl?.startsWith("postgres")
      ? new PostgresBetaScanLoadStore(databaseUrl)
      : new FileBetaScanLoadStore(process.env.BETA_SCAN_LOAD_STORE_PATH);
  }

  return loadStore;
}

export function resetBetaScanQuotaStoresForTests(
  nextSettingsStore: BetaScanSettingsStore | null,
  nextUsageStore: BetaScanUsageStore | null,
  nextLoadStore: BetaScanLoadStore | null = null
) {
  settingsStore = nextSettingsStore;
  usageStore = nextUsageStore;
  loadStore = nextLoadStore;
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
  settings: Partial<BetaScanQuotaSettings>,
  now = new Date()
): Promise<BetaScanUsageResult> {
  return store.consume(key, { ...betaScanQuotaSettings(), ...settings }, now);
}

export async function consumeBetaScanQuota(
  request: Request,
  ownerToken: string | null | undefined,
  settings?: BetaScanQuotaSettings
) {
  const activeSettings = settings ?? await getBetaScanSettingsStore().get();
  const keys = betaScanQuotaKeys(ownerToken, requestIdentity(request));
  return getBetaScanUsageStore().consume(keys, activeSettings);
}

export function acquireBetaScanLoadSlot(settings: BetaScanQuotaSettings) {
  return getBetaScanLoadStore().acquire(settings);
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

  update(input: BetaScanSettingsUpdate): Promise<BetaScanQuotaSettings> {
    return this.withQueue(async () => {
      const current = await this.read();
      const next = applyBetaScanSettingsUpdate({ ...betaScanQuotaSettings(), ...current }, input);
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
          publicScanEnabled: typeof parsed.publicScanEnabled === "boolean" ? parsed.publicScanEnabled : undefined,
          freeScanLimit:
            typeof parsed.freeScanLimit === "number" ? normalizeFreeScanLimit(parsed.freeScanLimit) : undefined,
          windowHours:
            typeof parsed.windowHours === "number" ? normalizeWindowHours(parsed.windowHours) : undefined,
          maxConcurrentScans:
            typeof parsed.maxConcurrentScans === "number"
              ? normalizeMaxConcurrentScans(parsed.maxConcurrentScans)
              : undefined,
          busyRetryAfterSeconds:
            typeof parsed.busyRetryAfterSeconds === "number"
              ? normalizeBusyRetryAfterSeconds(parsed.busyRetryAfterSeconds)
              : undefined,
          scanLeaseTtlSeconds:
            typeof parsed.scanLeaseTtlSeconds === "number"
              ? normalizeScanLeaseTtlSeconds(parsed.scanLeaseTtlSeconds)
              : undefined,
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

export class FileBetaScanLoadStore implements BetaScanLoadStore {
  private readonly filePath: string;
  private queue = Promise.resolve();

  constructor(filePath = defaultFileStorePath("beta-scan-load.json")) {
    this.filePath = filePath;
  }

  acquire(settings: BetaScanQuotaSettings, now = new Date()): Promise<BetaScanLoadLease> {
    return this.withQueue(async () => {
      const load = await this.read();
      const currentTime = now.getTime();
      const activeLeases = Object.entries(load.leases).filter(([, lease]) => {
        return new Date(lease.expiresAt).getTime() > currentTime;
      });
      load.leases = Object.fromEntries(activeLeases);

      if (activeLeases.length >= settings.maxConcurrentScans) {
        await this.write(load);
        return {
          allowed: false,
          active: activeLeases.length,
          limit: settings.maxConcurrentScans,
          retryAfterSeconds: settings.busyRetryAfterSeconds
        };
      }

      const leaseId = randomUUID();
      load.leases[leaseId] = {
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + settings.scanLeaseTtlSeconds * 1000).toISOString()
      };
      await this.write(load);

      return {
        allowed: true,
        active: activeLeases.length + 1,
        limit: settings.maxConcurrentScans,
        retryAfterSeconds: settings.busyRetryAfterSeconds,
        release: () => this.release(leaseId)
      };
    });
  }

  private release(leaseId: string): Promise<void> {
    return this.withQueue(async () => {
      const load = await this.read();
      delete load.leases[leaseId];
      await this.write(load);
    });
  }

  private async read(): Promise<BetaScanLoadRecord> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      try {
        const parsed = JSON.parse(raw) as Partial<BetaScanLoadRecord>;
        return { leases: parsed.leases && typeof parsed.leases === "object" ? parsed.leases : {} };
      } catch (parseError) {
        if (parseError instanceof SyntaxError) {
          await backupCorruptFile(this.filePath);
          return { leases: {} };
        }
        throw parseError;
      }
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
      if (code === "ENOENT") return { leases: {} };
      throw error;
    }
  }

  private write(load: BetaScanLoadRecord): Promise<void> {
    return atomicWriteJson(this.filePath, load);
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
  private readonly ready: Promise<void>;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
    });
    this.ready = ensurePostgresBetaScanTables(this.pool);
  }

  async get(): Promise<BetaScanQuotaSettings> {
    await this.ready;
    const defaults = betaScanQuotaSettings();
    const result = await this.pool.query(
      `select public_scan_enabled, free_scan_limit, window_hours, max_concurrent_scans,
              busy_retry_after_seconds, scan_lease_ttl_seconds, updated_at
       from beta_scan_settings
       where id = 'default'
       limit 1`
    );
    const row = result.rows[0];
    if (!row) return defaults;

    return {
      publicScanEnabled: typeof row.public_scan_enabled === "boolean" ? row.public_scan_enabled : defaults.publicScanEnabled,
      freeScanLimit: normalizeFreeScanLimit(Number(row.free_scan_limit)),
      windowHours: clampInteger(String(row.window_hours), defaults.windowHours, 1, 24 * 30),
      maxConcurrentScans: normalizeMaxConcurrentScans(Number(row.max_concurrent_scans)),
      busyRetryAfterSeconds: normalizeBusyRetryAfterSeconds(Number(row.busy_retry_after_seconds)),
      scanLeaseTtlSeconds: normalizeScanLeaseTtlSeconds(Number(row.scan_lease_ttl_seconds)),
      updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : undefined
    };
  }

  async update(input: BetaScanSettingsUpdate): Promise<BetaScanQuotaSettings> {
    await this.ready;
    const next = applyBetaScanSettingsUpdate(await this.get(), input);
    const result = await this.pool.query(
      `insert into beta_scan_settings (
         id, public_scan_enabled, free_scan_limit, window_hours, max_concurrent_scans,
         busy_retry_after_seconds, scan_lease_ttl_seconds, updated_at
       )
       values ('default', $1, $2, $3, $4, $5, $6, $7)
       on conflict (id) do update set
         public_scan_enabled = excluded.public_scan_enabled,
         free_scan_limit = excluded.free_scan_limit,
         window_hours = excluded.window_hours,
         max_concurrent_scans = excluded.max_concurrent_scans,
         busy_retry_after_seconds = excluded.busy_retry_after_seconds,
         scan_lease_ttl_seconds = excluded.scan_lease_ttl_seconds,
         updated_at = excluded.updated_at
       returning public_scan_enabled, free_scan_limit, window_hours, max_concurrent_scans,
                 busy_retry_after_seconds, scan_lease_ttl_seconds, updated_at`,
      [
        next.publicScanEnabled,
        next.freeScanLimit,
        next.windowHours,
        next.maxConcurrentScans,
        next.busyRetryAfterSeconds,
        next.scanLeaseTtlSeconds,
        next.updatedAt
      ]
    );
    const row = result.rows[0];
    return {
      publicScanEnabled: Boolean(row.public_scan_enabled),
      freeScanLimit: normalizeFreeScanLimit(Number(row.free_scan_limit)),
      windowHours: normalizeWindowHours(Number(row.window_hours)),
      maxConcurrentScans: normalizeMaxConcurrentScans(Number(row.max_concurrent_scans)),
      busyRetryAfterSeconds: normalizeBusyRetryAfterSeconds(Number(row.busy_retry_after_seconds)),
      scanLeaseTtlSeconds: normalizeScanLeaseTtlSeconds(Number(row.scan_lease_ttl_seconds)),
      updatedAt: new Date(String(row.updated_at)).toISOString()
    };
  }
}

class PostgresBetaScanUsageStore implements BetaScanUsageStore {
  private readonly pool: Pool;
  private readonly ready: Promise<void>;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
    });
    this.ready = ensurePostgresBetaScanTables(this.pool);
  }

  async consume(keys: string | string[], settings: BetaScanQuotaSettings, now = new Date()): Promise<BetaScanUsageResult> {
    await this.ready;
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

class PostgresBetaScanLoadStore implements BetaScanLoadStore {
  private readonly pool: Pool;
  private readonly ready: Promise<void>;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
    });
    this.ready = ensurePostgresBetaScanTables(this.pool);
  }

  async acquire(settings: BetaScanQuotaSettings, now = new Date()): Promise<BetaScanLoadLease> {
    await this.ready;
    const leaseId = randomUUID();
    const expiresAt = new Date(now.getTime() + settings.scanLeaseTtlSeconds * 1000).toISOString();
    const client = await this.pool.connect();

    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(hashtext('id-doppelganger-beta-scan-load'))");
      await client.query("delete from beta_scan_leases where expires_at <= $1", [now.toISOString()]);
      const countResult = await client.query("select count(*)::int as active from beta_scan_leases");
      const active = Number(countResult.rows[0]?.active ?? 0);

      if (active >= settings.maxConcurrentScans) {
        await client.query("commit");
        return {
          allowed: false,
          active,
          limit: settings.maxConcurrentScans,
          retryAfterSeconds: settings.busyRetryAfterSeconds
        };
      }

      await client.query(
        `insert into beta_scan_leases (lease_id, created_at, expires_at)
         values ($1, $2, $3)`,
        [leaseId, now.toISOString(), expiresAt]
      );
      await client.query("commit");

      return {
        allowed: true,
        active: active + 1,
        limit: settings.maxConcurrentScans,
        retryAfterSeconds: settings.busyRetryAfterSeconds,
        release: () => this.release(leaseId)
      };
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async release(leaseId: string) {
    await this.ready;
    await this.pool.query("delete from beta_scan_leases where lease_id = $1", [leaseId]);
  }
}

function applyBetaScanSettingsUpdate(
  current: BetaScanQuotaSettings,
  input: BetaScanSettingsUpdate
): BetaScanQuotaSettings {
  const next: BetaScanQuotaSettings = {
    ...current,
    updatedAt: new Date().toISOString()
  };

  if (input.publicScanEnabled !== undefined) next.publicScanEnabled = input.publicScanEnabled;
  if (input.freeScanLimit !== undefined) next.freeScanLimit = normalizeFreeScanLimit(input.freeScanLimit);
  if (input.windowHours !== undefined) next.windowHours = normalizeWindowHours(input.windowHours);
  if (input.maxConcurrentScans !== undefined) {
    next.maxConcurrentScans = normalizeMaxConcurrentScans(input.maxConcurrentScans);
  }
  if (input.busyRetryAfterSeconds !== undefined) {
    next.busyRetryAfterSeconds = normalizeBusyRetryAfterSeconds(input.busyRetryAfterSeconds);
  }
  if (input.scanLeaseTtlSeconds !== undefined) {
    next.scanLeaseTtlSeconds = normalizeScanLeaseTtlSeconds(input.scanLeaseTtlSeconds);
  }

  return next;
}

async function ensurePostgresBetaScanTables(pool: Pool) {
  await pool.query(`
    create table if not exists beta_scan_settings (
      id text primary key,
      public_scan_enabled boolean not null default true,
      free_scan_limit integer not null check (free_scan_limit >= 0 and free_scan_limit <= 1000),
      window_hours integer not null check (window_hours >= 1 and window_hours <= 720),
      max_concurrent_scans integer not null default 6 check (max_concurrent_scans >= 1 and max_concurrent_scans <= 50),
      busy_retry_after_seconds integer not null default 30 check (busy_retry_after_seconds >= 1 and busy_retry_after_seconds <= 3600),
      scan_lease_ttl_seconds integer not null default 90 check (scan_lease_ttl_seconds >= 10 and scan_lease_ttl_seconds <= 600),
      updated_at timestamptz not null
    );

    alter table beta_scan_settings
      add column if not exists public_scan_enabled boolean not null default true,
      add column if not exists max_concurrent_scans integer not null default 6,
      add column if not exists busy_retry_after_seconds integer not null default 30,
      add column if not exists scan_lease_ttl_seconds integer not null default 90;

    create table if not exists beta_scan_usage (
      quota_key text primary key,
      count integer not null check (count >= 0),
      reset_at timestamptz not null,
      updated_at timestamptz not null
    );

    create index if not exists beta_scan_usage_reset_at_idx on beta_scan_usage (reset_at);

    create table if not exists beta_scan_leases (
      lease_id text primary key,
      created_at timestamptz not null,
      expires_at timestamptz not null
    );

    create index if not exists beta_scan_leases_expires_at_idx on beta_scan_leases (expires_at);
  `);
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

function normalizeWindowHours(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 24 * 30) {
    throw new Error("FREE_SCAN_WINDOW_INVALID");
  }

  return value;
}

function normalizeMaxConcurrentScans(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 50) {
    throw new Error("MAX_CONCURRENT_SCANS_INVALID");
  }

  return value;
}

function normalizeBusyRetryAfterSeconds(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 3600) {
    throw new Error("BUSY_RETRY_AFTER_INVALID");
  }

  return value;
}

function normalizeScanLeaseTtlSeconds(value: number) {
  if (!Number.isInteger(value) || value < 10 || value > 600) {
    throw new Error("SCAN_LEASE_TTL_INVALID");
  }

  return value;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  return fallback;
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
