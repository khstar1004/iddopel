import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "../app/api/admin/tickets/route";
import { FileAdminAuditLogStore, listAdminAuditEvents, resetAdminAuditLogStoreForTests } from "./admin-audit-log";
import {
  FileBetaScanLoadStore,
  FileBetaScanSettingsStore,
  FileBetaScanUsageStore,
  betaScanAccountQuotaKeys,
  betaScanReferralCode,
  getBetaScanTicketStatus,
  resetBetaScanQuotaStoresForTests
} from "./beta-scan-quota";
import { createDevAdminToken } from "./dev-admin";
import { FileTicketWalletStore, claimTicketWallet, resetTicketWalletStoreForTests } from "./ticket-wallet";

describe("admin tickets route", () => {
  const originalEnableDevAdmin = process.env.ENABLE_DEV_ADMIN;
  const originalDevAdminPassword = process.env.DEV_ADMIN_PASSWORD;

  afterEach(() => {
    restoreEnv("ENABLE_DEV_ADMIN", originalEnableDevAdmin);
    restoreEnv("DEV_ADMIN_PASSWORD", originalDevAdminPassword);
    resetBetaScanQuotaStoresForTests(null, null);
    resetTicketWalletStoreForTests(null);
    resetAdminAuditLogStoreForTests(null);
  });

  it("requires an authenticated developer admin token", async () => {
    const response = await POST(adminTicketRequest({ target: "user@example.com", amount: 1 }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error?.code).toBe("UNAUTHORIZED");
  });

  it("grants bonus tickets to a wallet found by recovery code", async () => {
    process.env.ENABLE_DEV_ADMIN = "true";
    process.env.DEV_ADMIN_PASSWORD = "secret-password";
    const dir = await mkdtemp(path.join(os.tmpdir(), "admin-tickets-recovery-"));
    const settingsStore = new FileBetaScanSettingsStore(path.join(dir, "settings.json"));
    const usageStore = new FileBetaScanUsageStore(path.join(dir, "usage.json"));
    resetBetaScanQuotaStoresForTests(settingsStore, usageStore, new FileBetaScanLoadStore(path.join(dir, "load.json")));
    resetTicketWalletStoreForTests(new FileTicketWalletStore(path.join(dir, "wallets.json")));
    resetAdminAuditLogStoreForTests(new FileAdminAuditLogStore(path.join(dir, "audit.json")));
    const wallet = await claimTicketWallet({ email: "Owner@Example.com", anonymousOwnerToken: "anon-owner" });
    const token = createDevAdminToken(new Request("https://id.example.com/admin"), "admin") ?? "";

    const response = await POST(
      adminTicketRequest(
        {
          target: wallet.recoveryCode,
          amount: 4,
          memo: "manual customer support grant"
        },
        token
      )
    );
    const body = await response.json();
    const ticketStatus = await getBetaScanTicketStatus(
      usageStore,
      betaScanAccountQuotaKeys(wallet.account.ownerToken),
      await settingsStore.get(),
      betaScanReferralCode(wallet.account.ownerToken)
    );

    expect(response.status).toBe(200);
    expect(body.target).toMatchObject({
      kind: "recoveryCode",
      emailMasked: "o***@example.com",
      referralCode: betaScanReferralCode(wallet.account.ownerToken)
    });
    expect(body.grant).toMatchObject({ amount: 4, bonusRemaining: 4 });
    expect(ticketStatus.bonusRemaining).toBe(4);
    const auditEvents = await listAdminAuditEvents();
    expect(auditEvents[0]).toMatchObject({
      action: "tickets.grant",
      changes: {
        targetKind: { before: null, after: "recoveryCode" },
        amount: { before: 0, after: 4 },
        bonusRemaining: { before: 0, after: 4 }
      }
    });

    await rm(dir, { recursive: true, force: true });
  });

  it("grants bonus tickets to a wallet found by email", async () => {
    process.env.ENABLE_DEV_ADMIN = "true";
    process.env.DEV_ADMIN_PASSWORD = "secret-password";
    const dir = await mkdtemp(path.join(os.tmpdir(), "admin-tickets-email-"));
    const settingsStore = new FileBetaScanSettingsStore(path.join(dir, "settings.json"));
    const usageStore = new FileBetaScanUsageStore(path.join(dir, "usage.json"));
    resetBetaScanQuotaStoresForTests(settingsStore, usageStore, new FileBetaScanLoadStore(path.join(dir, "load.json")));
    resetTicketWalletStoreForTests(new FileTicketWalletStore(path.join(dir, "wallets.json")));
    resetAdminAuditLogStoreForTests(new FileAdminAuditLogStore(path.join(dir, "audit.json")));
    const wallet = await claimTicketWallet({ email: "email-target@example.com", anonymousOwnerToken: "anon-owner" });
    const token = createDevAdminToken(new Request("https://id.example.com/admin"), "admin") ?? "";

    const response = await POST(adminTicketRequest({ target: " EMAIL-TARGET@example.com ", amount: 2 }, token));
    const body = await response.json();
    const ticketStatus = await getBetaScanTicketStatus(
      usageStore,
      betaScanAccountQuotaKeys(wallet.account.ownerToken),
      await settingsStore.get(),
      betaScanReferralCode(wallet.account.ownerToken)
    );

    expect(response.status).toBe(200);
    expect(body.target).toMatchObject({
      kind: "email",
      emailMasked: "e***@example.com",
      referralCode: betaScanReferralCode(wallet.account.ownerToken)
    });
    expect(ticketStatus.bonusRemaining).toBe(2);

    await rm(dir, { recursive: true, force: true });
  });

  it("grants bonus tickets directly to a referral code", async () => {
    process.env.ENABLE_DEV_ADMIN = "true";
    process.env.DEV_ADMIN_PASSWORD = "secret-password";
    const dir = await mkdtemp(path.join(os.tmpdir(), "admin-tickets-referral-"));
    const settingsStore = new FileBetaScanSettingsStore(path.join(dir, "settings.json"));
    const usageStore = new FileBetaScanUsageStore(path.join(dir, "usage.json"));
    resetBetaScanQuotaStoresForTests(settingsStore, usageStore, new FileBetaScanLoadStore(path.join(dir, "load.json")));
    resetTicketWalletStoreForTests(new FileTicketWalletStore(path.join(dir, "wallets.json")));
    resetAdminAuditLogStoreForTests(new FileAdminAuditLogStore(path.join(dir, "audit.json")));
    const referralCode = betaScanReferralCode("direct-referral-owner") ?? "";
    const token = createDevAdminToken(new Request("https://id.example.com/admin"), "admin") ?? "";

    const response = await POST(adminTicketRequest({ target: referralCode.toUpperCase(), amount: 3 }, token));
    const body = await response.json();
    const ticketStatus = await getBetaScanTicketStatus(
      usageStore,
      betaScanAccountQuotaKeys("direct-referral-owner"),
      await settingsStore.get(),
      referralCode
    );

    expect(response.status).toBe(200);
    expect(body.target).toMatchObject({
      kind: "referralCode",
      emailMasked: null,
      referralCode
    });
    expect(body.grant).toMatchObject({ amount: 3, bonusRemaining: 3 });
    expect(ticketStatus.bonusRemaining).toBe(3);

    await rm(dir, { recursive: true, force: true });
  });

  it("rejects invalid grant amounts", async () => {
    process.env.ENABLE_DEV_ADMIN = "true";
    process.env.DEV_ADMIN_PASSWORD = "secret-password";
    const token = createDevAdminToken(new Request("https://id.example.com/admin"), "admin") ?? "";

    const response = await POST(adminTicketRequest({ target: "user@example.com", amount: 0 }, token));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });
});

function adminTicketRequest(body: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "user-agent": "AdminTicketsRouteTest/1.0",
    "x-forwarded-for": "203.0.113.90"
  };
  if (token) headers["x-dev-admin-token"] = token;

  return new Request("https://id.example.com/api/admin/tickets", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
