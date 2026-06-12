import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FileBetaScanSettingsStore,
  FileBetaScanUsageStore,
  assertBetaScanQuota,
  betaScanQuotaKey,
  betaScanQuotaSettings
} from "./beta-scan-quota";

describe("beta scan quota", () => {
  const originalLimit = process.env.BETA_FREE_SCAN_LIMIT;
  const originalWindowHours = process.env.BETA_FREE_SCAN_WINDOW_HOURS;

  afterEach(() => {
    restoreEnv("BETA_FREE_SCAN_LIMIT", originalLimit);
    restoreEnv("BETA_FREE_SCAN_WINDOW_HOURS", originalWindowHours);
  });

  it("defaults beta free searches to five per person", () => {
    delete process.env.BETA_FREE_SCAN_LIMIT;
    delete process.env.BETA_FREE_SCAN_WINDOW_HOURS;

    expect(betaScanQuotaSettings()).toMatchObject({
      freeScanLimit: 5,
      windowHours: 24
    });
  });

  it("stores the administrator-adjusted free search limit", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "beta-scan-settings-"));
    const store = new FileBetaScanSettingsStore(path.join(dir, "settings.json"));

    await expect(store.update({ freeScanLimit: 8 })).resolves.toMatchObject({ freeScanLimit: 8 });

    const persisted = JSON.parse(await readFile(path.join(dir, "settings.json"), "utf-8")) as { freeScanLimit: number };
    expect(persisted.freeScanLimit).toBe(8);
    await rm(dir, { recursive: true, force: true });
  });

  it("enforces the configured per-person quota and reports remaining scans", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "beta-scan-usage-"));
    const usageStore = new FileBetaScanUsageStore(path.join(dir, "usage.json"));
    const key = betaScanQuotaKey("owner-token", "203.0.113.1");
    const now = new Date("2026-06-12T00:00:00.000Z");

    await expect(assertBetaScanQuota(usageStore, key, { freeScanLimit: 2, windowHours: 24 }, now)).resolves.toMatchObject({
      allowed: true,
      remaining: 1
    });
    await expect(assertBetaScanQuota(usageStore, key, { freeScanLimit: 2, windowHours: 24 }, now)).resolves.toMatchObject({
      allowed: true,
      remaining: 0
    });
    await expect(assertBetaScanQuota(usageStore, key, { freeScanLimit: 2, windowHours: 24 }, now)).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 86400
    });

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
