import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
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
  consume(key: string, settings: BetaScanQuotaSettings, now?: Date): Promise<BetaScanUsageResult>;
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
    settingsStore = new FileBetaScanSettingsStore(process.env.BETA_SCAN_SETTINGS_STORE_PATH);
  }

  return settingsStore;
}

export function getBetaScanUsageStore(): BetaScanUsageStore {
  if (!usageStore) {
    usageStore = new FileBetaScanUsageStore(process.env.BETA_SCAN_USAGE_STORE_PATH);
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

export function betaScanQuotaKey(ownerToken: string | null | undefined, requestKey: string) {
  const normalizedOwnerToken = ownerToken?.trim();
  const principal = normalizedOwnerToken ? `${normalizedOwnerToken}:${requestKey}` : requestKey;
  return createHash("sha256").update(`beta-free-scan:${principal}`).digest("hex");
}

export async function assertBetaScanQuota(
  store: BetaScanUsageStore,
  key: string,
  settings: BetaScanQuotaSettings,
  now = new Date()
): Promise<BetaScanUsageResult> {
  return store.consume(key, settings, now);
}

export async function consumeBetaScanQuota(request: Request, ownerToken: string | null | undefined) {
  const settings = await getBetaScanSettingsStore().get();
  const key = betaScanQuotaKey(ownerToken, requestIdentity(request));
  return getBetaScanUsageStore().consume(key, settings);
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

  consume(key: string, settings: BetaScanQuotaSettings, now = new Date()): Promise<BetaScanUsageResult> {
    return this.withQueue(async () => {
      const usage = await this.readAll();
      const current = usage[key];
      const resetAt = current && new Date(current.resetAt).getTime() > now.getTime()
        ? new Date(current.resetAt)
        : new Date(now.getTime() + settings.windowHours * 60 * 60 * 1000);
      const activeCount = current && new Date(current.resetAt).getTime() > now.getTime() ? current.count : 0;

      if (activeCount >= settings.freeScanLimit) {
        return {
          allowed: false,
          limit: settings.freeScanLimit,
          used: activeCount,
          remaining: 0,
          resetAt: resetAt.toISOString(),
          retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000))
        };
      }

      const nextCount = activeCount + 1;
      usage[key] = {
        count: nextCount,
        resetAt: resetAt.toISOString(),
        updatedAt: now.toISOString()
      };
      await this.writeAll(usage);

      return {
        allowed: true,
        limit: settings.freeScanLimit,
        used: nextCount,
        remaining: Math.max(0, settings.freeScanLimit - nextCount),
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

function requestIdentity(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "anonymous";
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
