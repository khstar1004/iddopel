import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { defaultFileStorePath } from "./file-store-path";
import { resolvePostgresUrl } from "./postgres-env";

export interface BetaScanQuotaSettings {
  publicScanEnabled: boolean;
  freeScanLimit: number;
  windowHours: number;
  freeScanLifetime: boolean;
  referralTicketsEnabled: boolean;
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

export type BetaScanTicketSource = "base" | "referral";
export type BetaScanReferralGrantReason = "INVALID_REFERRAL" | "SELF_REFERRAL" | "ALREADY_GRANTED";

export interface BetaScanTicketStatus {
  limit: number;
  used: number;
  baseRemaining: number;
  bonusRemaining: number;
  remaining: number;
  resetAt: string;
  lifetime: boolean;
  referralCode: string | null;
  retryAfterSeconds?: number;
}

interface BetaScanUsageResult extends BetaScanTicketStatus {
  allowed: boolean;
  ticketSource?: BetaScanTicketSource;
}

export interface BetaScanReferralGrantResult {
  granted: boolean;
  reason?: BetaScanReferralGrantReason;
  bonusRemaining: number;
}

export type BetaScanBonusGrantReason = "INVALID_REFERRAL" | "INVALID_AMOUNT";

export interface BetaScanBonusGrantResult {
  granted: boolean;
  reason?: BetaScanBonusGrantReason;
  amount: number;
  bonusRemaining: number;
  previousBonusRemaining: number;
  referralCode: string | null;
}

export interface BetaScanReferralTransferResult {
  transferred: number;
  fromBonusRemaining: number;
  toBonusRemaining: number;
}

interface BetaScanSettingsStore {
  get(): Promise<BetaScanQuotaSettings>;
  update(input: BetaScanSettingsUpdate): Promise<BetaScanQuotaSettings>;
}

interface BetaScanUsageStore {
  consume(
    keys: string | string[],
    settings: BetaScanQuotaSettings,
    now?: Date,
    referralCode?: string | null
  ): Promise<BetaScanUsageResult>;
  status(
    keys: string | string[],
    settings: BetaScanQuotaSettings,
    now?: Date,
    referralCode?: string | null
  ): Promise<BetaScanTicketStatus>;
  grantReferralTicket(referralCode: string | null, recipientKey: string, now?: Date): Promise<BetaScanReferralGrantResult>;
  grantBonusTickets(referralCode: string | null, amount: number, now?: Date): Promise<BetaScanBonusGrantResult>;
  transferReferralTickets(
    fromReferralCode: string | null,
    toReferralCode: string | null,
    now?: Date
  ): Promise<BetaScanReferralTransferResult>;
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
    freeScanLimit: clampInteger(env.BETA_FREE_SCAN_LIMIT, 1, 0, 1000),
    windowHours: clampInteger(env.BETA_FREE_SCAN_WINDOW_HOURS, 24, 1, 24 * 30),
    freeScanLifetime: parseBoolean(env.BETA_FREE_SCAN_LIFETIME, true),
    referralTicketsEnabled: parseBoolean(env.BETA_REFERRAL_TICKETS_ENABLED, false),
    maxConcurrentScans: clampInteger(env.BETA_MAX_CONCURRENT_SCANS, 6, 1, 50),
    busyRetryAfterSeconds: clampInteger(env.BETA_SCAN_BUSY_RETRY_AFTER_SECONDS, 30, 1, 3600),
    scanLeaseTtlSeconds: clampInteger(env.BETA_SCAN_LEASE_TTL_SECONDS, 90, 10, 600)
  };
}

export function getBetaScanSettingsStore(): BetaScanSettingsStore {
  if (!settingsStore) {
    const databaseUrl = resolvePostgresUrl();
    settingsStore = databaseUrl
      ? new PostgresBetaScanSettingsStore(databaseUrl)
      : new FileBetaScanSettingsStore(process.env.BETA_SCAN_SETTINGS_STORE_PATH);
  }

  return settingsStore;
}

export function getBetaScanUsageStore(): BetaScanUsageStore {
  if (!usageStore) {
    const databaseUrl = resolvePostgresUrl();
    usageStore = databaseUrl
      ? new PostgresBetaScanUsageStore(databaseUrl)
      : new FileBetaScanUsageStore(process.env.BETA_SCAN_USAGE_STORE_PATH);
  }

  return usageStore;
}

export function getBetaScanLoadStore(): BetaScanLoadStore {
  if (!loadStore) {
    const databaseUrl = resolvePostgresUrl();
    loadStore = databaseUrl
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

export function betaScanAccountQuotaKeys(ownerToken: string | null | undefined) {
  const normalizedOwnerToken = ownerToken?.trim().slice(0, 256);
  return normalizedOwnerToken ? [betaScanQuotaKey("owner", normalizedOwnerToken)] : [];
}

export function betaScanReferralCode(ownerToken: string | null | undefined) {
  const normalizedOwnerToken = ownerToken?.trim().slice(0, 256);
  if (!normalizedOwnerToken) return null;

  return createHash("sha256").update(`beta-scan-referral:${normalizedOwnerToken}`).digest("hex").slice(0, 24);
}

export function betaScanReferralRecipientKey(ownerToken: string | null | undefined, requestKey: string) {
  const normalizedOwnerToken = ownerToken?.trim().slice(0, 256) || "anonymous";
  return createHash("sha256")
    .update(`beta-scan-referral-recipient:${normalizedOwnerToken}\n${requestKey.trim().slice(0, 512)}`)
    .digest("hex");
}

export async function assertBetaScanQuota(
  store: BetaScanUsageStore,
  key: string | string[],
  settings: Partial<BetaScanQuotaSettings>,
  now = new Date(),
  referralCode?: string | null
): Promise<BetaScanUsageResult> {
  return store.consume(key, { ...betaScanQuotaSettings(), ...settings }, now, referralCode);
}

export async function getBetaScanTicketStatus(
  store: BetaScanUsageStore,
  key: string | string[],
  settings: Partial<BetaScanQuotaSettings>,
  referralCode?: string | null,
  now = new Date()
): Promise<BetaScanTicketStatus> {
  return store.status(key, { ...betaScanQuotaSettings(), ...settings }, now, referralCode);
}

export function grantBetaScanReferralTicket(
  store: BetaScanUsageStore,
  referralCode: string | null,
  recipientKey: string,
  now = new Date()
) {
  return store.grantReferralTicket(referralCode, recipientKey, now);
}

export function grantBetaScanBonusTickets(
  store: BetaScanUsageStore,
  referralCode: string | null,
  amount: number,
  now = new Date()
) {
  return store.grantBonusTickets(referralCode, amount, now);
}

export function transferBetaScanReferralTickets(
  store: BetaScanUsageStore,
  fromReferralCode: string | null,
  toReferralCode: string | null,
  now = new Date()
) {
  return store.transferReferralTickets(fromReferralCode, toReferralCode, now);
}

export async function consumeBetaScanQuota(
  request: Request,
  ownerToken: string | null | undefined,
  settings?: BetaScanQuotaSettings,
  options: { accountScoped?: boolean } = {}
) {
  const activeSettings = settings ?? await getBetaScanSettingsStore().get();
  const keys = options.accountScoped ? betaScanAccountQuotaKeys(ownerToken) : betaScanQuotaKeys(ownerToken, requestIdentity(request));
  return getBetaScanUsageStore().consume(keys, activeSettings, new Date(), betaScanReferralCode(ownerToken));
}

export async function getBetaScanTicketStatusForRequest(
  request: Request,
  ownerToken: string | null | undefined,
  settings?: BetaScanQuotaSettings,
  options: { accountScoped?: boolean } = {}
) {
  const activeSettings = settings ?? await getBetaScanSettingsStore().get();
  const requestKey = requestIdentity(request);
  const keys = options.accountScoped ? betaScanAccountQuotaKeys(ownerToken) : betaScanQuotaKeys(ownerToken, requestKey);
  return getBetaScanUsageStore().status(keys, activeSettings, new Date(), betaScanReferralCode(ownerToken));
}

export async function grantBetaScanReferralTicketForRequest(
  request: Request,
  ownerToken: string | null | undefined,
  referralCode: string | null | undefined,
  settings?: BetaScanQuotaSettings,
  options: { accountScoped?: boolean } = {}
) {
  const activeSettings = settings ?? await getBetaScanSettingsStore().get();
  const ownReferralCode = betaScanReferralCode(ownerToken);
  const normalizedReferralCode = normalizeReferralCode(referralCode);
  const requestKey = requestIdentity(request);
  const keys = options.accountScoped ? betaScanAccountQuotaKeys(ownerToken) : betaScanQuotaKeys(ownerToken, requestKey);
  const status = () => getBetaScanUsageStore().status(keys, activeSettings, new Date(), ownReferralCode);

  if (!activeSettings.referralTicketsEnabled) {
    return {
      referral: { granted: false, reason: "INVALID_REFERRAL" as const, bonusRemaining: 0 },
      tickets: await status()
    };
  }

  if (!normalizedReferralCode) {
    return {
      referral: { granted: false, reason: "INVALID_REFERRAL" as const, bonusRemaining: 0 },
      tickets: await status()
    };
  }

  if (normalizedReferralCode === ownReferralCode) {
    const tickets = await status();
    return {
      referral: { granted: false, reason: "SELF_REFERRAL" as const, bonusRemaining: tickets.bonusRemaining },
      tickets
    };
  }

  const recipientKey = betaScanReferralRecipientKey(ownerToken, requestKey);
  const referral = await getBetaScanUsageStore().grantReferralTicket(normalizedReferralCode, recipientKey);
  return {
    referral,
    tickets: await status()
  };
}

export function normalizeBetaScanReferralCode(value: string | null | undefined) {
  return normalizeReferralCode(value);
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

  consume(
    keys: string | string[],
    settings: BetaScanQuotaSettings,
    now = new Date(),
    referralCode?: string | null
  ): Promise<BetaScanUsageResult> {
    return this.withQueue(async () => {
      const quotaKeys = [...new Set(Array.isArray(keys) ? keys : [keys])];
      const usage = await this.readAll();
      const normalizedReferralCode = normalizeReferralCode(referralCode);
      const windows = quotaWindowsFor(usage, quotaKeys, settings, now);
      const base = baseTicketStatusFor(windows, settings, normalizedReferralCode, now, usage);

      if (base.baseRemaining > 0) {
        let used = 0;
        let resetAt = windows[0]?.resetAt ?? resetAtForWindow(settings, now);

        for (const window of windows) {
          const nextCount = window.activeCount + 1;
          used = Math.max(used, nextCount);
          if (window.resetAt.getTime() < resetAt.getTime()) resetAt = window.resetAt;
          usage[window.key] = {
            count: nextCount,
            resetAt: window.resetAt.toISOString(),
            updatedAt: now.toISOString()
          };
        }
        await this.writeAll(usage);

        const nextStatus = ticketStatusFor(
          windows.map((window) => ({ ...window, activeCount: window.activeCount + 1 })),
          settings,
          normalizedReferralCode,
          now,
          usage
        );

        return {
          ...nextStatus,
          allowed: true,
          used,
          resetAt: resetAt.toISOString(),
          ticketSource: "base"
        };
      }

      if (settings.referralTicketsEnabled && normalizedReferralCode && base.bonusRemaining > 0) {
        const bonusKey = referralBonusKey(normalizedReferralCode);
        usage[bonusKey] = {
          count: base.bonusRemaining - 1,
          resetAt: referralTicketResetAt(),
          updatedAt: now.toISOString()
        };
        await this.writeAll(usage);

        const nextStatus = ticketStatusFor(windows, settings, normalizedReferralCode, now, usage);

        return {
          ...nextStatus,
          allowed: true,
          ticketSource: "referral"
        };
      }

      return {
        ...base,
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((new Date(base.resetAt).getTime() - now.getTime()) / 1000))
      };
    });
  }

  status(
    keys: string | string[],
    settings: BetaScanQuotaSettings,
    now = new Date(),
    referralCode?: string | null
  ): Promise<BetaScanTicketStatus> {
    return this.withQueue(async () => {
      const quotaKeys = [...new Set(Array.isArray(keys) ? keys : [keys])];
      const usage = await this.readAll();
      const windows = quotaWindowsFor(usage, quotaKeys, settings, now);
      return ticketStatusFor(windows, settings, normalizeReferralCode(referralCode), now, usage);
    });
  }

  grantReferralTicket(referralCode: string | null, recipientKey: string, now = new Date()) {
    return this.withQueue(async () => {
      const normalizedReferralCode = normalizeReferralCode(referralCode);
      if (!normalizedReferralCode || !recipientKey) {
        return { granted: false, reason: "INVALID_REFERRAL" as const, bonusRemaining: 0 };
      }

      const usage = await this.readAll();
      const redemptionKey = referralRedemptionKey(normalizedReferralCode, recipientKey);
      const bonusKey = referralBonusKey(normalizedReferralCode);
      const alreadyGranted = activeCountFor(usage[redemptionKey], now) > 0;
      const bonusRemaining = activeCountFor(usage[bonusKey], now);

      if (alreadyGranted) {
        return { granted: false, reason: "ALREADY_GRANTED" as const, bonusRemaining };
      }

      usage[redemptionKey] = {
        count: 1,
        resetAt: referralTicketResetAt(),
        updatedAt: now.toISOString()
      };
      usage[bonusKey] = {
        count: bonusRemaining + 1,
        resetAt: referralTicketResetAt(),
        updatedAt: now.toISOString()
      };
      await this.writeAll(usage);

      return { granted: true, bonusRemaining: bonusRemaining + 1 };
    });
  }

  grantBonusTickets(referralCode: string | null, amount: number, now = new Date()) {
    return this.withQueue(async () => {
      const normalizedReferralCode = normalizeReferralCode(referralCode);
      const normalizedAmount = normalizeBonusGrantAmount(amount);

      if (!normalizedReferralCode) {
        return {
          granted: false,
          reason: "INVALID_REFERRAL" as const,
          amount: normalizedAmount,
          bonusRemaining: 0,
          previousBonusRemaining: 0,
          referralCode: null
        };
      }

      if (normalizedAmount <= 0) {
        const usage = await this.readAll();
        const bonusRemaining = activeCountFor(usage[referralBonusKey(normalizedReferralCode)], now);
        return {
          granted: false,
          reason: "INVALID_AMOUNT" as const,
          amount: normalizedAmount,
          bonusRemaining,
          previousBonusRemaining: bonusRemaining,
          referralCode: normalizedReferralCode
        };
      }

      const usage = await this.readAll();
      const bonusKey = referralBonusKey(normalizedReferralCode);
      const bonusRemaining = activeCountFor(usage[bonusKey], now);
      const nextBonusRemaining = bonusRemaining + normalizedAmount;
      usage[bonusKey] = {
        count: nextBonusRemaining,
        resetAt: referralTicketResetAt(),
        updatedAt: now.toISOString()
      };
      await this.writeAll(usage);

      return {
        granted: true,
        amount: normalizedAmount,
        bonusRemaining: nextBonusRemaining,
        previousBonusRemaining: bonusRemaining,
        referralCode: normalizedReferralCode
      };
    });
  }

  transferReferralTickets(fromReferralCode: string | null, toReferralCode: string | null, now = new Date()) {
    return this.withQueue(async () => {
      const from = normalizeReferralCode(fromReferralCode);
      const to = normalizeReferralCode(toReferralCode);
      if (!from || !to || from === to) {
        const usage = await this.readAll();
        const current = to ? activeCountFor(usage[referralBonusKey(to)], now) : 0;
        return { transferred: 0, fromBonusRemaining: 0, toBonusRemaining: current };
      }

      const usage = await this.readAll();
      const fromKey = referralBonusKey(from);
      const toKey = referralBonusKey(to);
      const fromRemaining = activeCountFor(usage[fromKey], now);
      const toRemaining = activeCountFor(usage[toKey], now);

      if (fromRemaining <= 0) {
        return { transferred: 0, fromBonusRemaining: 0, toBonusRemaining: toRemaining };
      }

      usage[fromKey] = {
        count: 0,
        resetAt: referralTicketResetAt(),
        updatedAt: now.toISOString()
      };
      usage[toKey] = {
        count: toRemaining + fromRemaining,
        resetAt: referralTicketResetAt(),
        updatedAt: now.toISOString()
      };
      await this.writeAll(usage);

      return { transferred: fromRemaining, fromBonusRemaining: 0, toBonusRemaining: toRemaining + fromRemaining };
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
      freeScanLifetime: defaults.freeScanLifetime,
      referralTicketsEnabled: defaults.referralTicketsEnabled,
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
      freeScanLifetime: next.freeScanLifetime,
      referralTicketsEnabled: next.referralTicketsEnabled,
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

  async consume(
    keys: string | string[],
    settings: BetaScanQuotaSettings,
    now = new Date(),
    referralCode?: string | null
  ): Promise<BetaScanUsageResult> {
    await this.ready;
    const quotaKeys = [...new Set(Array.isArray(keys) ? keys : [keys])];
    const normalizedReferralCode = normalizeReferralCode(referralCode);
    const bonusKey = normalizedReferralCode ? referralBonusKey(normalizedReferralCode) : null;
    const client = await this.pool.connect();

    try {
      await client.query("begin");
      const trackedKeys = bonusKey ? [...quotaKeys, bonusKey] : quotaKeys;
      const existing = await client.query(
        `select quota_key, count, reset_at
         from beta_scan_usage
         where quota_key = any($1::text[])
         for update`,
        [trackedKeys]
      );
      const usage = usageRecordsFromRows(existing.rows);
      const windows = quotaWindowsFor(usage, quotaKeys, settings, now);
      const base = ticketStatusFor(windows, settings, normalizedReferralCode, now, usage);

      if (base.baseRemaining > 0) {
        let used = 0;
        let resetAt = windows[0]?.resetAt ?? resetAtForWindow(settings, now);

        for (const window of windows) {
          const nextCount = window.activeCount + 1;
          used = Math.max(used, nextCount);
          if (window.resetAt.getTime() < resetAt.getTime()) resetAt = window.resetAt;
          await upsertUsageRecord(client, window.key, nextCount, window.resetAt.toISOString(), now);
          usage[window.key] = {
            count: nextCount,
            resetAt: window.resetAt.toISOString(),
            updatedAt: now.toISOString()
          };
        }

        await client.query("commit");
        const nextStatus = ticketStatusFor(
          windows.map((window) => ({ ...window, activeCount: window.activeCount + 1 })),
          settings,
          normalizedReferralCode,
          now,
          usage
        );
        return {
          ...nextStatus,
          allowed: true,
          used,
          resetAt: resetAt.toISOString(),
          ticketSource: "base"
        };
      }

      if (settings.referralTicketsEnabled && normalizedReferralCode && base.bonusRemaining > 0) {
        await upsertUsageRecord(client, referralBonusKey(normalizedReferralCode), base.bonusRemaining - 1, referralTicketResetAt(), now);
        usage[referralBonusKey(normalizedReferralCode)] = {
          count: base.bonusRemaining - 1,
          resetAt: referralTicketResetAt(),
          updatedAt: now.toISOString()
        };
        await client.query("commit");
        return {
          ...ticketStatusFor(windows, settings, normalizedReferralCode, now, usage),
          allowed: true,
          ticketSource: "referral"
        };
      }

      await client.query("commit");
      return {
        ...base,
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((new Date(base.resetAt).getTime() - now.getTime()) / 1000))
      };
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async status(
    keys: string | string[],
    settings: BetaScanQuotaSettings,
    now = new Date(),
    referralCode?: string | null
  ): Promise<BetaScanTicketStatus> {
    await this.ready;
    const quotaKeys = [...new Set(Array.isArray(keys) ? keys : [keys])];
    const normalizedReferralCode = normalizeReferralCode(referralCode);
    const trackedKeys = normalizedReferralCode ? [...quotaKeys, referralBonusKey(normalizedReferralCode)] : quotaKeys;
    const result = await this.pool.query(
      `select quota_key, count, reset_at, updated_at
       from beta_scan_usage
       where quota_key = any($1::text[])`,
      [trackedKeys]
    );
    const usage = usageRecordsFromRows(result.rows);
    return ticketStatusFor(quotaWindowsFor(usage, quotaKeys, settings, now), settings, normalizedReferralCode, now, usage);
  }

  async grantReferralTicket(referralCode: string | null, recipientKey: string, now = new Date()) {
    await this.ready;
    const normalizedReferralCode = normalizeReferralCode(referralCode);
    if (!normalizedReferralCode || !recipientKey) {
      return { granted: false, reason: "INVALID_REFERRAL" as const, bonusRemaining: 0 };
    }

    const bonusKey = referralBonusKey(normalizedReferralCode);
    const redemptionKey = referralRedemptionKey(normalizedReferralCode, recipientKey);
    const client = await this.pool.connect();

    try {
      await client.query("begin");
      const existing = await client.query(
        `select quota_key, count, reset_at
         from beta_scan_usage
         where quota_key = any($1::text[])
         for update`,
        [[bonusKey, redemptionKey]]
      );
      const usage = usageRecordsFromRows(existing.rows);
      const bonusRemaining = activeCountFor(usage[bonusKey], now);

      if (activeCountFor(usage[redemptionKey], now) > 0) {
        await client.query("commit");
        return { granted: false, reason: "ALREADY_GRANTED" as const, bonusRemaining };
      }

      await upsertUsageRecord(client, redemptionKey, 1, referralTicketResetAt(), now);
      await upsertUsageRecord(client, bonusKey, bonusRemaining + 1, referralTicketResetAt(), now);
      await client.query("commit");
      return { granted: true, bonusRemaining: bonusRemaining + 1 };
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async grantBonusTickets(referralCode: string | null, amount: number, now = new Date()) {
    await this.ready;
    const normalizedReferralCode = normalizeReferralCode(referralCode);
    const normalizedAmount = normalizeBonusGrantAmount(amount);

    if (!normalizedReferralCode) {
      return {
        granted: false,
        reason: "INVALID_REFERRAL" as const,
        amount: normalizedAmount,
        bonusRemaining: 0,
        previousBonusRemaining: 0,
        referralCode: null
      };
    }

    const bonusKey = referralBonusKey(normalizedReferralCode);
    const client = await this.pool.connect();

    try {
      await client.query("begin");
      const existing = await client.query(
        `select quota_key, count, reset_at
         from beta_scan_usage
         where quota_key = $1
         for update`,
        [bonusKey]
      );
      const usage = usageRecordsFromRows(existing.rows);
      const bonusRemaining = activeCountFor(usage[bonusKey], now);

      if (normalizedAmount <= 0) {
        await client.query("commit");
        return {
          granted: false,
          reason: "INVALID_AMOUNT" as const,
          amount: normalizedAmount,
          bonusRemaining,
          previousBonusRemaining: bonusRemaining,
          referralCode: normalizedReferralCode
        };
      }

      const nextBonusRemaining = bonusRemaining + normalizedAmount;
      await upsertUsageRecord(client, bonusKey, nextBonusRemaining, referralTicketResetAt(), now);
      await client.query("commit");
      return {
        granted: true,
        amount: normalizedAmount,
        bonusRemaining: nextBonusRemaining,
        previousBonusRemaining: bonusRemaining,
        referralCode: normalizedReferralCode
      };
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async transferReferralTickets(fromReferralCode: string | null, toReferralCode: string | null, now = new Date()) {
    await this.ready;
    const from = normalizeReferralCode(fromReferralCode);
    const to = normalizeReferralCode(toReferralCode);
    if (!from || !to || from === to) {
      const toRemaining = to
        ? activeCountFor(
            usageRecordsFromRows((await this.pool.query(
              `select quota_key, count, reset_at, updated_at from beta_scan_usage where quota_key = $1`,
              [referralBonusKey(to)]
            )).rows)[referralBonusKey(to)],
            now
          )
        : 0;
      return { transferred: 0, fromBonusRemaining: 0, toBonusRemaining: toRemaining };
    }

    const fromKey = referralBonusKey(from);
    const toKey = referralBonusKey(to);
    const client = await this.pool.connect();

    try {
      await client.query("begin");
      const existing = await client.query(
        `select quota_key, count, reset_at, updated_at
         from beta_scan_usage
         where quota_key = any($1::text[])
         for update`,
        [[fromKey, toKey]]
      );
      const usage = usageRecordsFromRows(existing.rows);
      const fromRemaining = activeCountFor(usage[fromKey], now);
      const toRemaining = activeCountFor(usage[toKey], now);

      if (fromRemaining <= 0) {
        await client.query("commit");
        return { transferred: 0, fromBonusRemaining: 0, toBonusRemaining: toRemaining };
      }

      await upsertUsageRecord(client, fromKey, 0, referralTicketResetAt(), now);
      await upsertUsageRecord(client, toKey, toRemaining + fromRemaining, referralTicketResetAt(), now);
      await client.query("commit");
      return { transferred: fromRemaining, fromBonusRemaining: 0, toBonusRemaining: toRemaining + fromRemaining };
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

interface QuotaWindow {
  key: string;
  resetAt: Date;
  activeCount: number;
}

function quotaWindowsFor(
  usage: Record<string, BetaScanUsageRecord>,
  quotaKeys: string[],
  settings: BetaScanQuotaSettings,
  now: Date
): QuotaWindow[] {
  return quotaKeys.map((key) => {
    const current = usage[key];
    const isActive = Boolean(
      current && (settings.freeScanLifetime ? current.count > 0 : new Date(current.resetAt).getTime() > now.getTime())
    );
    const resetAt = isActive && !settings.freeScanLifetime ? new Date(current.resetAt) : resetAtForWindow(settings, now);
    const activeCount = isActive ? current.count : 0;
    return { key, resetAt, activeCount };
  });
}

function ticketStatusFor(
  windows: QuotaWindow[],
  settings: BetaScanQuotaSettings,
  referralCode: string | null,
  now: Date,
  usage: Record<string, BetaScanUsageRecord>
): BetaScanTicketStatus {
  return baseTicketStatusFor(windows, settings, referralCode, now, usage);
}

function baseTicketStatusFor(
  windows: QuotaWindow[],
  settings: BetaScanQuotaSettings,
  referralCode: string | null,
  now: Date,
  usage: Record<string, BetaScanUsageRecord>
): BetaScanTicketStatus {
  const resetAt = earliestResetAt(windows, settings, now);
  const baseRemaining = settings.freeScanLimit <= 0
    ? 0
    : windows.reduce(
        (remaining, window) => Math.min(remaining, Math.max(0, settings.freeScanLimit - window.activeCount)),
        settings.freeScanLimit
      );
  const used = windows.reduce((max, window) => Math.max(max, window.activeCount), 0);
  const bonusRemaining = settings.referralTicketsEnabled && referralCode
    ? activeCountFor(usage[referralBonusKey(referralCode)], now)
    : 0;
  const remaining = baseRemaining + bonusRemaining;

  return {
    limit: settings.freeScanLimit,
    used,
    baseRemaining,
    bonusRemaining,
    remaining,
    resetAt: resetAt.toISOString(),
    lifetime: settings.freeScanLifetime,
    referralCode: settings.referralTicketsEnabled ? referralCode : null,
    retryAfterSeconds:
      remaining > 0 || settings.freeScanLifetime
        ? undefined
        : Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000))
  };
}

function earliestResetAt(windows: QuotaWindow[], settings: BetaScanQuotaSettings, now: Date) {
  return windows.reduce((earliest, window) => {
    return window.resetAt.getTime() < earliest.getTime() ? window.resetAt : earliest;
  }, resetAtForWindow(settings, now));
}

function resetAtForWindow(settings: BetaScanQuotaSettings, now: Date) {
  if (settings.freeScanLifetime) return new Date("9999-12-31T23:59:59.999Z");
  return new Date(now.getTime() + settings.windowHours * 60 * 60 * 1000);
}

function activeCountFor(record: BetaScanUsageRecord | undefined, now: Date) {
  if (!record) return 0;
  if (new Date(record.resetAt).getTime() <= now.getTime()) return 0;
  return Math.max(0, Number(record.count) || 0);
}

function normalizeReferralCode(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return /^[a-f0-9]{24}$/.test(normalized) ? normalized : null;
}

function normalizeBonusGrantAmount(value: number) {
  return Number.isInteger(value) && value > 0 && value <= 1000 ? value : 0;
}

function referralBonusKey(referralCode: string) {
  return `beta-ticket-bonus:${referralCode}`;
}

function referralRedemptionKey(referralCode: string, recipientKey: string) {
  return `beta-ticket-redemption:${referralCode}:${recipientKey.slice(0, 128)}`;
}

function referralTicketResetAt() {
  return "2126-01-01T00:00:00.000Z";
}

function usageRecordsFromRows(rows: Array<Record<string, unknown>>): Record<string, BetaScanUsageRecord> {
  const usage: Record<string, BetaScanUsageRecord> = {};

  for (const row of rows) {
    const key = String(row.quota_key ?? "");
    if (!key) continue;
    usage[key] = {
      count: Number(row.count ?? 0),
      resetAt: row.reset_at ? new Date(String(row.reset_at)).toISOString() : new Date(0).toISOString(),
      updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date(0).toISOString()
    };
  }

  return usage;
}

function upsertUsageRecord(
  client: { query: (queryText: string, values?: unknown[]) => Promise<unknown> },
  key: string,
  count: number,
  resetAt: string,
  now: Date
) {
  return client.query(
    `insert into beta_scan_usage (quota_key, count, reset_at, updated_at)
     values ($1, $2, $3, $4)
     on conflict (quota_key) do update set
       count = excluded.count,
       reset_at = excluded.reset_at,
       updated_at = excluded.updated_at`,
    [key, count, resetAt, now.toISOString()]
  );
}

function requestIdentity(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "anonymous";
  const userAgent = (request.headers.get("user-agent") ?? "unknown-agent").trim().replace(/\s+/g, " ").slice(0, 160);
  const acceptLanguage = (request.headers.get("accept-language") ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const platform = (request.headers.get("sec-ch-ua-platform") ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  return `${ip}\n${userAgent}\n${acceptLanguage}\n${platform}`;
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
