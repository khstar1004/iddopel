import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET, POST } from "../app/api/scan-tickets/route";
import {
  FileBetaScanLoadStore,
  FileBetaScanSettingsStore,
  FileBetaScanUsageStore,
  betaScanReferralCode,
  resetBetaScanQuotaStoresForTests
} from "./beta-scan-quota";

describe("scan tickets route", () => {
  afterEach(() => {
    resetBetaScanQuotaStoresForTests(null, null);
  });

  it("returns the current ticket balance and a referral code", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "scan-tickets-status-"));
    resetBetaScanQuotaStoresForTests(
      new FileBetaScanSettingsStore(path.join(dir, "settings.json")),
      new FileBetaScanUsageStore(path.join(dir, "usage.json")),
      new FileBetaScanLoadStore(path.join(dir, "load.json"))
    );

    const response = await GET(ticketRequest({ ownerToken: "ticket-owner" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tickets).toMatchObject({
      remaining: 1,
      baseRemaining: 1,
      bonusRemaining: 0,
      referralCode: betaScanReferralCode("ticket-owner")
    });
    await rm(dir, { recursive: true, force: true });
  });

  it("credits the referrer once when a new browser opens the referral link", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "scan-tickets-referral-"));
    resetBetaScanQuotaStoresForTests(
      new FileBetaScanSettingsStore(path.join(dir, "settings.json")),
      new FileBetaScanUsageStore(path.join(dir, "usage.json")),
      new FileBetaScanLoadStore(path.join(dir, "load.json"))
    );

    const referralCode = betaScanReferralCode("referrer-owner") ?? "";
    const first = await POST(ticketRequest({ ownerToken: "friend-owner", referralCode }));
    const duplicate = await POST(ticketRequest({ ownerToken: "friend-owner", referralCode }));
    const referrerStatus = await GET(ticketRequest({ ownerToken: "referrer-owner" }));
    const firstBody = await first.json();
    const duplicateBody = await duplicate.json();
    const referrerBody = await referrerStatus.json();

    expect(first.status).toBe(200);
    expect(firstBody.referral).toMatchObject({ granted: true });
    expect(duplicateBody.referral).toMatchObject({ granted: false, reason: "ALREADY_GRANTED" });
    expect(referrerBody.tickets.bonusRemaining).toBe(1);
    expect(referrerBody.tickets.remaining).toBe(2);
    await rm(dir, { recursive: true, force: true });
  });
});

function ticketRequest(options: { ownerToken: string; referralCode?: string }) {
  return new Request("https://id.example.com/api/scan-tickets", {
    method: options.referralCode ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      "user-agent": "TicketRouteTest/1.0",
      "x-forwarded-for": "203.0.113.30",
      "x-scan-owner-token": options.ownerToken
    },
    body: options.referralCode ? JSON.stringify({ referralCode: options.referralCode }) : undefined
  });
}
