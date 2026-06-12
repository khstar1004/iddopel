import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../app/api/admin/overview/route";
import { FileAdminAuditLogStore, recordAdminAuditEvent, resetAdminAuditLogStoreForTests } from "./admin-audit-log";
import { FileBetaScanSettingsStore, resetBetaScanQuotaStoresForTests } from "./beta-scan-quota";
import { createDevAdminToken } from "./dev-admin";

describe("admin overview route", () => {
  const originalEnableDevAdmin = process.env.ENABLE_DEV_ADMIN;
  const originalDevAdminPassword = process.env.DEV_ADMIN_PASSWORD;
  const originalDevAdminSecret = process.env.DEV_ADMIN_SECRET;
  const originalPaymentProvider = process.env.PAYMENT_PROVIDER;
  const originalScanProvider = process.env.SCAN_PROVIDER;
  let dir: string | null = null;

  afterEach(async () => {
    restoreEnv("ENABLE_DEV_ADMIN", originalEnableDevAdmin);
    restoreEnv("DEV_ADMIN_PASSWORD", originalDevAdminPassword);
    restoreEnv("DEV_ADMIN_SECRET", originalDevAdminSecret);
    restoreEnv("PAYMENT_PROVIDER", originalPaymentProvider);
    restoreEnv("SCAN_PROVIDER", originalScanProvider);
    resetBetaScanQuotaStoresForTests(null, null);
    resetAdminAuditLogStoreForTests(null);
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = null;
  });

  it("requires an authenticated developer admin token", async () => {
    const response = await GET(new Request("https://id.example.com/api/admin/overview"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error?.code).toBe("UNAUTHORIZED");
  });

  it("returns launch checks and recent audit events for administrators", async () => {
    process.env.ENABLE_DEV_ADMIN = "true";
    process.env.DEV_ADMIN_PASSWORD = "secret-password";
    process.env.DEV_ADMIN_SECRET = "a-stable-secret-for-admin-tests";
    process.env.SCAN_PROVIDER = "maigret";
    process.env.PAYMENT_PROVIDER = "toss";
    dir = await mkdtemp(path.join(os.tmpdir(), "admin-overview-"));
    resetBetaScanQuotaStoresForTests(new FileBetaScanSettingsStore(path.join(dir, "settings.json")), null);
    resetAdminAuditLogStoreForTests(new FileAdminAuditLogStore(path.join(dir, "audit.json")));
    const request = new Request("https://id.example.com/api/admin/overview");
    const token = createDevAdminToken(request, "admin");
    await recordAdminAuditEvent(request, {
      action: "scan_settings.update",
      changes: {
        freeScanLimit: { before: 1, after: 8 }
      }
    });

    const response = await GET(
      new Request("https://id.example.com/api/admin/overview", {
        headers: { "x-dev-admin-token": token ?? "" }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings.freeScanLimit).toBe(1);
    expect(body.runtime).toMatchObject({
      enabled: true,
      loginConfigured: true,
      scanProvider: "maigret",
      paymentProvider: "toss"
    });
    expect(body.recommendations.length).toBeGreaterThan(0);
    expect(body.recentAuditEvents[0]).toMatchObject({
      action: "scan_settings.update",
      changes: {
        freeScanLimit: { before: 1, after: 8 }
      }
    });
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
