import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FileBetaScanLoadStore,
  FileBetaScanSettingsStore,
  FileBetaScanUsageStore,
  assertBetaScanQuota,
  betaScanQuotaKey,
  betaScanQuotaKeys,
  betaScanQuotaSettings
} from "./beta-scan-quota";

describe("beta scan quota", () => {
  const originalLimit = process.env.BETA_FREE_SCAN_LIMIT;
  const originalWindowHours = process.env.BETA_FREE_SCAN_WINDOW_HOURS;
  const originalPublicScanEnabled = process.env.BETA_PUBLIC_SCAN_ENABLED;
  const originalMaxConcurrentScans = process.env.BETA_MAX_CONCURRENT_SCANS;

  afterEach(() => {
    restoreEnv("BETA_FREE_SCAN_LIMIT", originalLimit);
    restoreEnv("BETA_FREE_SCAN_WINDOW_HOURS", originalWindowHours);
    restoreEnv("BETA_PUBLIC_SCAN_ENABLED", originalPublicScanEnabled);
    restoreEnv("BETA_MAX_CONCURRENT_SCANS", originalMaxConcurrentScans);
  });

  it("defaults beta free searches to one per person", () => {
    delete process.env.BETA_FREE_SCAN_LIMIT;
    delete process.env.BETA_FREE_SCAN_WINDOW_HOURS;

    expect(betaScanQuotaSettings()).toMatchObject({
      publicScanEnabled: true,
      freeScanLimit: 1,
      windowHours: 24,
      maxConcurrentScans: 6
    });
  });

  it("stores administrator-adjusted beta search controls", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "beta-scan-settings-"));
    const store = new FileBetaScanSettingsStore(path.join(dir, "settings.json"));

    await expect(store.update({
      publicScanEnabled: false,
      freeScanLimit: 8,
      windowHours: 12,
      maxConcurrentScans: 3,
      busyRetryAfterSeconds: 45,
      scanLeaseTtlSeconds: 120
    })).resolves.toMatchObject({
      publicScanEnabled: false,
      freeScanLimit: 8,
      windowHours: 12,
      maxConcurrentScans: 3,
      busyRetryAfterSeconds: 45,
      scanLeaseTtlSeconds: 120
    });

    const persisted = JSON.parse(await readFile(path.join(dir, "settings.json"), "utf-8")) as {
      publicScanEnabled: boolean;
      freeScanLimit: number;
      maxConcurrentScans: number;
    };
    expect(persisted.publicScanEnabled).toBe(false);
    expect(persisted.freeScanLimit).toBe(8);
    expect(persisted.maxConcurrentScans).toBe(3);
    await rm(dir, { recursive: true, force: true });
  });

  it("enforces the configured per-person quota and reports remaining scans", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "beta-scan-usage-"));
    const usageStore = new FileBetaScanUsageStore(path.join(dir, "usage.json"));
    const key = betaScanQuotaKey("request", "203.0.113.1");
    const now = new Date("2026-06-12T00:00:00.000Z");

    const settings = { ...betaScanQuotaSettings(), freeScanLimit: 2, windowHours: 24 };

    await expect(assertBetaScanQuota(usageStore, key, settings, now)).resolves.toMatchObject({
      allowed: true,
      remaining: 1
    });
    await expect(assertBetaScanQuota(usageStore, key, settings, now)).resolves.toMatchObject({
      allowed: true,
      remaining: 0
    });
    await expect(assertBetaScanQuota(usageStore, key, settings, now)).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 86400
    });

    await rm(dir, { recursive: true, force: true });
  });

  it("spends both request and owner quota keys to reduce browser-token reset abuse", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "beta-scan-dual-usage-"));
    const usageStore = new FileBetaScanUsageStore(path.join(dir, "usage.json"));
    const now = new Date("2026-06-12T00:00:00.000Z");
    const requestKey = betaScanQuotaKey("request", "203.0.113.7\nMozilla/5.0");
    const firstOwnerKey = betaScanQuotaKey("owner", "owner-one");
    const secondOwnerKey = betaScanQuotaKey("owner", "owner-two");

    const settings = { ...betaScanQuotaSettings(), freeScanLimit: 1, windowHours: 24 };

    await expect(assertBetaScanQuota(usageStore, [requestKey, firstOwnerKey], settings, now)).resolves.toMatchObject({
      allowed: true,
      remaining: 0
    });
    await expect(assertBetaScanQuota(usageStore, [requestKey, secondOwnerKey], settings, now)).resolves.toMatchObject({
      allowed: false,
      remaining: 0
    });

    await rm(dir, { recursive: true, force: true });
  });

  it("builds separate quota keys for request identity and owner token", () => {
    const keys = betaScanQuotaKeys("owner-token", "203.0.113.9\nMozilla/5.0");

    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(betaScanQuotaKey("request", "203.0.113.9\nMozilla/5.0"));
    expect(keys[1]).toBe(betaScanQuotaKey("owner", "owner-token"));
  });

  it("limits concurrent beta scan load with expiring leases", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "beta-scan-load-"));
    const loadStore = new FileBetaScanLoadStore(path.join(dir, "load.json"));
    const settings = { ...betaScanQuotaSettings(), maxConcurrentScans: 1, busyRetryAfterSeconds: 17 };
    const now = new Date("2026-06-12T00:00:00.000Z");

    const first = await loadStore.acquire(settings, now);
    const second = await loadStore.acquire(settings, now);
    await first.release?.();
    const third = await loadStore.acquire(settings, now);

    expect(first).toMatchObject({ allowed: true, active: 1, limit: 1 });
    expect(second).toMatchObject({ allowed: false, active: 1, limit: 1, retryAfterSeconds: 17 });
    expect(third).toMatchObject({ allowed: true, active: 1, limit: 1 });
    await third.release?.();
    await rm(dir, { recursive: true, force: true });
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
