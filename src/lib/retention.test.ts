import { describe, expect, it } from "vitest";
import { expiresAtForMonitoring, expiresAtForNonMember, expiresAtForPaidReport, isExpired } from "./retention";

describe("retention policy", () => {
  it("sets non-member scans to expire after 24 hours", () => {
    expect(expiresAtForNonMember(new Date("2026-06-11T00:00:00.000Z"))).toBe("2026-06-12T00:00:00.000Z");
  });

  it("sets paid reports to expire after 90 days", () => {
    expect(expiresAtForPaidReport(new Date("2026-06-11T00:00:00.000Z"))).toBe("2026-09-09T00:00:00.000Z");
  });

  it("sets monitoring scans to expire after 40 days", () => {
    expect(expiresAtForMonitoring(new Date("2026-06-11T00:00:00.000Z"))).toBe("2026-07-21T00:00:00.000Z");
  });

  it("treats scans as expired at or after their expiry timestamp", () => {
    const expiresAt = "2026-06-12T00:00:00.000Z";

    expect(isExpired(expiresAt, new Date("2026-06-11T23:59:59.999Z"))).toBe(false);
    expect(isExpired(expiresAt, new Date("2026-06-12T00:00:00.000Z"))).toBe(true);
  });
});
