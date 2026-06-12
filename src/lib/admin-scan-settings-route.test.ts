import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET, PATCH } from "../app/api/admin/scan-settings/route";
import { createDevAdminToken } from "./dev-admin";
import { FileBetaScanSettingsStore, resetBetaScanQuotaStoresForTests } from "./beta-scan-quota";

describe("admin scan settings route", () => {
  const originalEnableDevAdmin = process.env.ENABLE_DEV_ADMIN;
  const originalDevAdminPassword = process.env.DEV_ADMIN_PASSWORD;

  afterEach(() => {
    restoreEnv("ENABLE_DEV_ADMIN", originalEnableDevAdmin);
    restoreEnv("DEV_ADMIN_PASSWORD", originalDevAdminPassword);
    resetBetaScanQuotaStoresForTests(null, null);
  });

  it("requires an authenticated developer admin token", async () => {
    const response = await GET(new Request("https://id.example.com/api/admin/scan-settings"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error?.code).toBe("UNAUTHORIZED");
  });

  it("allows an administrator to update the beta free scan limit", async () => {
    process.env.ENABLE_DEV_ADMIN = "true";
    process.env.DEV_ADMIN_PASSWORD = "secret-password";
    const dir = await mkdtemp(path.join(os.tmpdir(), "admin-scan-settings-"));
    resetBetaScanQuotaStoresForTests(new FileBetaScanSettingsStore(path.join(dir, "settings.json")), null);
    const request = new Request("https://id.example.com/api/admin/scan-settings");
    const token = createDevAdminToken(request, "admin");

    const response = await PATCH(
      new Request("https://id.example.com/api/admin/scan-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-dev-admin-token": token ?? ""
        },
        body: JSON.stringify({ freeScanLimit: 9 })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings).toMatchObject({ freeScanLimit: 9 });
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
