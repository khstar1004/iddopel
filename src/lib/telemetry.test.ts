import { describe, expect, it } from "vitest";
import { buildTelemetryLog, parseTelemetryPayload, redactTelemetryText } from "./telemetry";

describe("parseTelemetryPayload", () => {
  it("keeps page view telemetry bounded and strips query strings from paths", () => {
    expect(
      parseTelemetryPayload(
        {
          name: "page_view",
          path: "/reports/scan_123?token=secret",
          occurredAt: "2026-06-11T00:00:00.000Z"
        },
        new Date("2026-06-11T00:00:01.000Z")
      )
    ).toEqual({
      name: "page_view",
      path: "/reports/scan_123",
      occurredAt: "2026-06-11T00:00:00.000Z"
    });
  });

  it("rejects unsupported telemetry event names", () => {
    expect(() => parseTelemetryPayload({ name: "raw_body_dump", path: "/" })).toThrow("Unsupported telemetry event name.");
  });

  it("accepts bounded web vital metrics", () => {
    expect(
      parseTelemetryPayload({
        name: "web_vital",
        path: "/",
        metric: { name: "LCP", value: 1234.56789, rating: "good" }
      }).metric
    ).toEqual({ name: "LCP", value: 1234.568, rating: "good" });
  });

  it("redacts sensitive values from client error messages", () => {
    const event = parseTelemetryPayload({
      name: "client_error",
      path: "/",
      error: { message: "failed for me@example.com token=abc123" }
    });

    expect(event.error?.message).toContain("[redacted-email]");
    expect(event.error?.message).toContain("token=[redacted]");
    expect(event.error?.message).not.toContain("abc123");
  });
});

describe("buildTelemetryLog", () => {
  it("adds stable operation metadata without raw request bodies", () => {
    const log = buildTelemetryLog(
      { name: "page_view", path: "/", occurredAt: "2026-06-11T00:00:00.000Z" },
      { NODE_ENV: "production", RELEASE_VERSION: "2026.06.11" },
      "req_123",
      new Date("2026-06-11T00:00:01.000Z")
    );

    expect(log).toMatchObject({
      event: "id_doppelganger_telemetry",
      requestId: "req_123",
      environment: "production",
      release: "2026.06.11"
    });
  });
});

describe("redactTelemetryText", () => {
  it("redacts phone numbers and resident-number-like values", () => {
    expect(redactTelemetryText("010-1234-5678 990101-1234567")).toBe("[redacted-phone] [redacted-id]");
  });
});
