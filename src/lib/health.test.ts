import { describe, expect, it } from "vitest";
import { buildHealthStatus } from "./health";

describe("buildHealthStatus", () => {
  it("reports launch-critical runtime configuration without exposing secrets", () => {
    const status = buildHealthStatus(
      {
        DATABASE_URL: "postgres://user:password@example.com/db",
        PAYMENT_PROVIDER: "toss",
        SCAN_PROVIDER: "maigret",
        TOSS_SECRET_KEY: "dummy-secret-should-not-leak"
      },
      new Date("2026-06-11T00:00:00.000Z")
    );

    expect(status).toEqual({
      ok: true,
      service: "id-doppelganger",
      timestamp: "2026-06-11T00:00:00.000Z",
      storage: "postgres",
      scanProvider: "maigret",
      paymentProvider: "toss"
    });
    expect(JSON.stringify(status)).not.toContain("dummy-secret-should-not-leak");
    expect(JSON.stringify(status)).not.toContain("password");
  });
});
