import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { POST as POST_TICKET_WALLET } from "../app/api/ticket-wallet/route";
import { POST } from "../app/api/scans/route";
import {
  FileBetaScanLoadStore,
  FileBetaScanSettingsStore,
  FileBetaScanUsageStore,
  resetBetaScanQuotaStoresForTests
} from "./beta-scan-quota";
import { resetScanRepositoryForTests, type ScanRepository } from "./repository";
import { hashScanTicketAccessOwner } from "./scan-ticket-access";
import { FileTicketWalletStore, resetTicketWalletStoreForTests } from "./ticket-wallet";
import type { ScanJob } from "./types";

describe("scan route beta free quota", () => {
  const originalScanProvider = process.env.SCAN_PROVIDER;
  const originalBetaLimit = process.env.BETA_FREE_SCAN_LIMIT;
  const originalBetaWindow = process.env.BETA_FREE_SCAN_WINDOW_HOURS;

  afterEach(() => {
    restoreEnv("SCAN_PROVIDER", originalScanProvider);
    restoreEnv("BETA_FREE_SCAN_LIMIT", originalBetaLimit);
    restoreEnv("BETA_FREE_SCAN_WINDOW_HOURS", originalBetaWindow);
    resetScanRepositoryForTests(null);
    resetBetaScanQuotaStoresForTests(null, null);
    resetTicketWalletStoreForTests(null);
  });

  it("creates a paywalled scan after the free ticket quota is used", async () => {
    process.env.SCAN_PROVIDER = "mock";
    process.env.BETA_FREE_SCAN_LIMIT = "1";
    process.env.BETA_FREE_SCAN_WINDOW_HOURS = "24";
    const dir = await mkdtemp(path.join(os.tmpdir(), "scan-route-quota-"));
    const repository = new MemoryScanRepository();
    resetScanRepositoryForTests(repository);
    resetBetaScanQuotaStoresForTests(
      new FileBetaScanSettingsStore(path.join(dir, "settings.json")),
      new FileBetaScanUsageStore(path.join(dir, "usage.json")),
      new FileBetaScanLoadStore(path.join(dir, "load.json"))
    );

    const first = await POST(scanRequest("firstquota", { ownerToken: "same-owner-token" }));
    const second = await POST(scanRequest("secondquota", { ownerToken: "same-owner-token" }));
    const secondBody = await second.json();
    const secondScan = await repository.get(secondBody.scanId);

    expect(first.status).toBe(201);
    expect(first.headers.get("x-beta-free-scans-remaining")).toBe("0");
    expect(second.status).toBe(201);
    expect(second.headers.get("x-beta-free-scans-remaining")).toBe("0");
    expect(second.headers.get("x-beta-free-ticket-referral-code")).toBeTruthy();
    expect(secondBody.freePreviewLocked).toBe(true);
    expect(secondBody.freePreviewLockReason).toBe("BETA_FREE_SCAN_LIMITED");
    expect(secondBody.previewResults).toEqual([]);
    expect(secondScan?.ticketAccessOwnerTokenHash).toBeNull();
    expect(repository.size).toBe(2);
    await rm(dir, { recursive: true, force: true });
  });

  it("stores full-result ticket access for the owner that spent the free ticket", async () => {
    process.env.SCAN_PROVIDER = "mock";
    process.env.BETA_FREE_SCAN_LIMIT = "2";
    process.env.BETA_FREE_SCAN_WINDOW_HOURS = "24";
    const dir = await mkdtemp(path.join(os.tmpdir(), "scan-route-ticket-access-"));
    const repository = new MemoryScanRepository();
    resetScanRepositoryForTests(repository);
    resetBetaScanQuotaStoresForTests(
      new FileBetaScanSettingsStore(path.join(dir, "settings.json")),
      new FileBetaScanUsageStore(path.join(dir, "usage.json")),
      new FileBetaScanLoadStore(path.join(dir, "load.json"))
    );

    const ownerToken = "ticket-access-owner";
    const response = await POST(scanRequest("ticketaccess", { ownerToken }));
    const body = await response.json();
    const storedScan = await repository.get(body.scanId);

    expect(response.status).toBe(201);
    expect(storedScan?.ticketAccessOwnerTokenHash).toBe(hashScanTicketAccessOwner(ownerToken));
    await rm(dir, { recursive: true, force: true });
  });

  it("marks no-ticket scans as paywalled across owner token requests", async () => {
    process.env.SCAN_PROVIDER = "mock";
    process.env.BETA_FREE_SCAN_LIMIT = "1";
    process.env.BETA_FREE_SCAN_WINDOW_HOURS = "24";
    const dir = await mkdtemp(path.join(os.tmpdir(), "scan-route-owner-quota-"));
    resetScanRepositoryForTests(new MemoryScanRepository());
    resetBetaScanQuotaStoresForTests(
      new FileBetaScanSettingsStore(path.join(dir, "settings.json")),
      new FileBetaScanUsageStore(path.join(dir, "usage.json")),
      new FileBetaScanLoadStore(path.join(dir, "load.json"))
    );

    const first = await POST(scanRequest("firstownerquota", { ip: "203.0.113.21", ownerToken: "same-owner-token" }));
    const second = await POST(scanRequest("secondownerquota", { ip: "203.0.113.22", ownerToken: "same-owner-token" }));
    const secondBody = await second.json();

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(secondBody.freePreviewLocked).toBe(true);
    expect(secondBody.freePreviewLockReason).toBe("BETA_FREE_SCAN_LIMITED");
    expect(secondBody.previewResults).toEqual([]);
    await rm(dir, { recursive: true, force: true });
  });

  it("blocks public beta scans when the administrator disables search", async () => {
    process.env.SCAN_PROVIDER = "mock";
    const dir = await mkdtemp(path.join(os.tmpdir(), "scan-route-disabled-"));
    const settingsStore = new FileBetaScanSettingsStore(path.join(dir, "settings.json"));
    await settingsStore.update({ publicScanEnabled: false });
    resetScanRepositoryForTests(new MemoryScanRepository());
    resetBetaScanQuotaStoresForTests(
      settingsStore,
      new FileBetaScanUsageStore(path.join(dir, "usage.json")),
      new FileBetaScanLoadStore(path.join(dir, "load.json"))
    );

    const response = await POST(scanRequest("disabledscan"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error?.code).toBe("BETA_SCAN_DISABLED");
    await rm(dir, { recursive: true, force: true });
  });

  it("uses the logged-in ticket wallet instead of the anonymous browser token", async () => {
    process.env.SCAN_PROVIDER = "mock";
    process.env.BETA_FREE_SCAN_LIMIT = "1";
    process.env.BETA_FREE_SCAN_WINDOW_HOURS = "24";
    const dir = await mkdtemp(path.join(os.tmpdir(), "scan-route-wallet-quota-"));
    resetScanRepositoryForTests(new MemoryScanRepository());
    resetBetaScanQuotaStoresForTests(
      new FileBetaScanSettingsStore(path.join(dir, "settings.json")),
      new FileBetaScanUsageStore(path.join(dir, "usage.json")),
      new FileBetaScanLoadStore(path.join(dir, "load.json"))
    );
    resetTicketWalletStoreForTests(new FileTicketWalletStore(path.join(dir, "wallets.json")));

    const wallet = await POST_TICKET_WALLET(walletRequest({ ownerToken: "anon-before-login", email: "wallet@example.com" }));
    const cookie = wallet.headers.get("set-cookie") ?? "";
    const first = await POST(scanRequest("walletquotaone", { ownerToken: "browser-a", cookie }));
    const second = await POST(scanRequest("walletquotatwo", { ownerToken: "browser-b", cookie, ip: "203.0.113.62" }));
    const secondBody = await second.json();

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(secondBody.freePreviewLocked).toBe(true);
    expect(secondBody.freePreviewLockReason).toBe("BETA_FREE_SCAN_LIMITED");
    expect(secondBody.previewResults).toEqual([]);

    await rm(dir, { recursive: true, force: true });
  });

  it("returns a busy response when the beta scan concurrency limit is reached", async () => {
    process.env.SCAN_PROVIDER = "mock";
    const dir = await mkdtemp(path.join(os.tmpdir(), "scan-route-busy-"));
    const settingsStore = new FileBetaScanSettingsStore(path.join(dir, "settings.json"));
    const loadStore = new FileBetaScanLoadStore(path.join(dir, "load.json"));
    const settings = await settingsStore.update({ maxConcurrentScans: 1, busyRetryAfterSeconds: 9 });
    const lease = await loadStore.acquire(settings);
    resetScanRepositoryForTests(new MemoryScanRepository());
    resetBetaScanQuotaStoresForTests(
      settingsStore,
      new FileBetaScanUsageStore(path.join(dir, "usage.json")),
      loadStore
    );

    const response = await POST(scanRequest("busyscan"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("9");
    expect(body.error?.code).toBe("BETA_SCAN_BUSY");
    await lease.release?.();
    await rm(dir, { recursive: true, force: true });
  });
});

function scanRequest(username: string, options: { ip?: string; ownerToken?: string; cookie?: string } = {}) {
  return new Request("https://id.example.com/api/scans", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "user-agent": "QuotaTest/1.0",
      "x-forwarded-for": options.ip ?? "203.0.113.20",
      "x-scan-owner-token": options.ownerToken ?? "owner-token",
      ...(options.cookie ? { cookie: options.cookie } : {})
    },
    body: JSON.stringify({ username, purpose: "SELF_CHECK", mode: "quick" })
  });
}

function walletRequest(options: { ownerToken: string; email: string }) {
  return new Request("https://id.example.com/api/ticket-wallet", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "user-agent": "QuotaTest/1.0",
      "x-forwarded-for": "203.0.113.61",
      "x-scan-owner-token": options.ownerToken
    },
    body: JSON.stringify({ email: options.email })
  });
}

class MemoryScanRepository implements ScanRepository {
  private scans = new Map<string, ScanJob>();

  get size() {
    return this.scans.size;
  }

  async create(job: ScanJob) {
    this.scans.set(job.scanId, job);
    return job;
  }

  async get(scanId: string) {
    return this.scans.get(scanId) ?? null;
  }

  async delete(scanId: string) {
    this.scans.delete(scanId);
  }

  async extendExpiration(scanId: string, expiresAt: string) {
    const scan = this.scans.get(scanId);
    if (scan) this.scans.set(scanId, { ...scan, expiresAt });
  }

  async pruneExpired() {
    return 0;
  }
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
