import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DELETE, GET, POST } from "../app/api/ticket-wallet/route";
import {
  FileBetaScanLoadStore,
  FileBetaScanSettingsStore,
  FileBetaScanUsageStore,
  betaScanReferralCode,
  grantBetaScanReferralTicket,
  resetBetaScanQuotaStoresForTests
} from "./beta-scan-quota";
import { resetTicketWalletStoreForTests, FileTicketWalletStore } from "./ticket-wallet";
import { resetRateLimitsForTests } from "./rate-limit";

describe("ticket wallet route", () => {
  const originalReferralTicketsEnabled = process.env.BETA_REFERRAL_TICKETS_ENABLED;

  afterEach(() => {
    restoreEnv("BETA_REFERRAL_TICKETS_ENABLED", originalReferralTicketsEnabled);
    resetBetaScanQuotaStoresForTests(null, null);
    resetTicketWalletStoreForTests(null);
    resetRateLimitsForTests();
  });

  it("creates a wallet, sets an httpOnly session cookie, and migrates anonymous referral tickets", async () => {
    process.env.BETA_REFERRAL_TICKETS_ENABLED = "true";
    const dir = await mkdtemp(path.join(os.tmpdir(), "ticket-wallet-create-"));
    const usageStore = new FileBetaScanUsageStore(path.join(dir, "usage.json"));
    resetBetaScanQuotaStoresForTests(
      new FileBetaScanSettingsStore(path.join(dir, "settings.json")),
      usageStore,
      new FileBetaScanLoadStore(path.join(dir, "load.json"))
    );
    resetTicketWalletStoreForTests(new FileTicketWalletStore(path.join(dir, "wallets.json")));

    const anonymousReferralCode = betaScanReferralCode("anon-owner") ?? "";
    await grantBetaScanReferralTicket(usageStore, anonymousReferralCode, "friend-one");

    const response = await POST(walletRequest({ ownerToken: "anon-owner", email: "User@Example.com" }));
    const body = await response.json();
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(201);
    expect(cookie).toContain("id_doppelganger_ticket_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(body.wallet).toMatchObject({ authenticated: true, emailMasked: "u***@example.com" });
    expect(body.recoveryCode).toMatch(/^[A-Za-z0-9_-]{12,}$/);
    expect(body.tickets.bonusRemaining).toBe(1);
    expect(body.tickets.referralCode).not.toBe(anonymousReferralCode);

    const read = await GET(walletRequest({ cookie }));
    const readBody = await read.json();
    expect(readBody.wallet.emailMasked).toBe("u***@example.com");

    await rm(dir, { recursive: true, force: true });
  });

  it("requires the recovery code before reusing an existing wallet email", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ticket-wallet-login-"));
    resetBetaScanQuotaStoresForTests(
      new FileBetaScanSettingsStore(path.join(dir, "settings.json")),
      new FileBetaScanUsageStore(path.join(dir, "usage.json")),
      new FileBetaScanLoadStore(path.join(dir, "load.json"))
    );
    resetTicketWalletStoreForTests(new FileTicketWalletStore(path.join(dir, "wallets.json")));

    const created = await POST(walletRequest({ ownerToken: "anon-owner", email: "user@example.com" }));
    const createdBody = await created.json();
    const conflict = await POST(walletRequest({ ownerToken: "other-owner", email: "USER@example.com" }));
    const loggedIn = await POST(
      walletRequest({ ownerToken: "other-owner", email: "USER@example.com", recoveryCode: createdBody.recoveryCode })
    );
    const conflictBody = await conflict.json();
    const loggedInBody = await loggedIn.json();

    expect(conflict.status).toBe(409);
    expect(conflictBody.error?.code).toBe("TICKET_WALLET_RECOVERY_REQUIRED");
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.headers.get("set-cookie")).toContain("id_doppelganger_ticket_session=");
    expect(loggedInBody.wallet.emailMasked).toBe("u***@example.com");

    await rm(dir, { recursive: true, force: true });
  });

  it("clears the wallet session on logout", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ticket-wallet-logout-"));
    resetBetaScanQuotaStoresForTests(
      new FileBetaScanSettingsStore(path.join(dir, "settings.json")),
      new FileBetaScanUsageStore(path.join(dir, "usage.json")),
      new FileBetaScanLoadStore(path.join(dir, "load.json"))
    );
    resetTicketWalletStoreForTests(new FileTicketWalletStore(path.join(dir, "wallets.json")));

    const created = await POST(walletRequest({ ownerToken: "anon-owner", email: "user@example.com" }));
    const cookie = created.headers.get("set-cookie") ?? "";
    const response = await DELETE(walletRequest({ cookie }));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");

    await rm(dir, { recursive: true, force: true });
  });

  it("keeps the session cookie secure behind an https proxy", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ticket-wallet-proxy-"));
    resetBetaScanQuotaStoresForTests(
      new FileBetaScanSettingsStore(path.join(dir, "settings.json")),
      new FileBetaScanUsageStore(path.join(dir, "usage.json")),
      new FileBetaScanLoadStore(path.join(dir, "load.json"))
    );
    resetTicketWalletStoreForTests(new FileTicketWalletStore(path.join(dir, "wallets.json")));

    const response = await POST(
      walletRequest({
        ownerToken: "anon-owner",
        email: "proxy@example.com",
        forwardedProto: "https",
        url: "http://internal.example.com/api/ticket-wallet"
      })
    );

    expect(response.headers.get("set-cookie")).toContain("Secure");

    await rm(dir, { recursive: true, force: true });
  });

  it("returns Retry-After when wallet requests are rate limited", async () => {
    for (let index = 0; index < 8; index += 1) {
      await POST(walletRequest({ email: "not-an-email" }));
    }

    const response = await POST(walletRequest({ email: "not-an-email" }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(body.error?.code).toBe("RATE_LIMITED");
    expect(body.error?.details.retryAfterSeconds).toBeGreaterThan(0);
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function walletRequest(options: {
  ownerToken?: string;
  email?: string;
  recoveryCode?: string;
  cookie?: string;
  forwardedProto?: string;
  url?: string;
}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "user-agent": "TicketWalletRouteTest/1.0",
    "x-forwarded-for": "203.0.113.60"
  };
  if (options.ownerToken) headers["x-scan-owner-token"] = options.ownerToken;
  if (options.cookie) headers.cookie = options.cookie;
  if (options.forwardedProto) headers["x-forwarded-proto"] = options.forwardedProto;

  return new Request(options.url ?? "https://id.example.com/api/ticket-wallet", {
    method: options.email ? "POST" : "GET",
    headers,
    body: options.email
      ? JSON.stringify({ email: options.email, recoveryCode: options.recoveryCode })
      : undefined
  });
}
