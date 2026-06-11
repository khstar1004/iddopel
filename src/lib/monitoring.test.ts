import { describe, expect, it } from "vitest";
import {
  createMonitoringSubscription,
  generateOwnerToken,
  hashOwnerToken,
  markMonitoringRun,
  normalizeMonitoringUsernames,
  publicMonitoring,
  updateMonitoringSubscription
} from "./monitoring";

describe("monitoring", () => {
  it("normalizes unique usernames and limits monthly monitoring to three ids", () => {
    expect(normalizeMonitoringUsernames(["@khstar104", "KhStar104", "brand.name"])).toEqual(["khstar104", "brand.name"]);

    expect(() => normalizeMonitoringUsernames(["a", "b", "c", "d"])).toThrow("아이디는 3자 이상");
    expect(() => normalizeMonitoringUsernames(["one", "two", "three", "four"])).toThrow("아이디 3개까지");
  });

  it("hashes browser owner tokens without exposing them publicly", () => {
    const ownerToken = generateOwnerToken();
    const hash = hashOwnerToken(ownerToken);

    expect(ownerToken).not.toBe(hash);
    expect(hash).toHaveLength(64);
    expect(() => hashOwnerToken("short")).toThrow("소유 토큰");
  });

  it("creates, updates, and marks monthly monitoring runs", () => {
    const createdAt = new Date("2026-06-11T00:00:00Z");
    const runAt = new Date("2026-07-11T00:00:00Z");
    const subscription = createMonitoringSubscription({
      ownerTokenHash: "a".repeat(64),
      usernames: ["khstar104"],
      purpose: "SELF_CHECK",
      now: createdAt
    });

    expect(subscription.nextRunAt).toBe("2026-07-11T00:00:00.000Z");
    expect(subscription.status).toBe("ACTIVE");

    const updated = updateMonitoringSubscription(subscription, {
      usernames: ["brand", "creator"],
      purpose: "BRAND_CHECK",
      now: new Date("2026-06-12T00:00:00Z")
    });
    expect(updated.usernames).toEqual(["brand", "creator"]);
    expect(updated.purpose).toBe("BRAND_CHECK");

    const marked = markMonitoringRun(updated, {
      latestScanIds: { brand: "scan_1", creator: "scan_2" },
      now: runAt
    });
    expect(marked.lastRunAt).toBe("2026-07-11T00:00:00.000Z");
    expect(marked.nextRunAt).toBe("2026-08-11T00:00:00.000Z");
    expect(marked.latestScanIds.brand).toBe("scan_1");

    expect(publicMonitoring(marked)).not.toHaveProperty("ownerTokenHash");
  });
});
