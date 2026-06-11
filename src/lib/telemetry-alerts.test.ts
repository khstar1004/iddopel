import { describe, expect, it, vi } from "vitest";
import { buildTelemetryAlertPayload, sendTelemetryAlert, shouldSendTelemetryAlert } from "./telemetry-alerts";
import type { TelemetryLog } from "./telemetry";

const baseLog: TelemetryLog = {
  event: "id_doppelganger_telemetry",
  name: "client_error",
  path: "/reports/scan_123",
  occurredAt: "2026-06-11T00:00:00.000Z",
  receivedAt: "2026-06-11T00:00:01.000Z",
  requestId: "req_123",
  release: "2026.06.11",
  environment: "production",
  error: { message: "failed token=[redacted]" }
};

describe("shouldSendTelemetryAlert", () => {
  it("alerts on client failures and poor web vital ratings", () => {
    expect(shouldSendTelemetryAlert(baseLog)).toBe(true);
    expect(shouldSendTelemetryAlert({ ...baseLog, name: "unhandled_rejection" })).toBe(true);
    expect(
      shouldSendTelemetryAlert({
        ...baseLog,
        name: "web_vital",
        metric: { name: "LCP", value: 4600, rating: "poor" },
        error: undefined
      })
    ).toBe(true);
  });

  it("does not alert on normal telemetry", () => {
    expect(shouldSendTelemetryAlert({ ...baseLog, name: "page_view", error: undefined })).toBe(false);
    expect(
      shouldSendTelemetryAlert({
        ...baseLog,
        name: "web_vital",
        metric: { name: "CLS", value: 0.03, rating: "good" },
        error: undefined
      })
    ).toBe(false);
  });
});

describe("buildTelemetryAlertPayload", () => {
  it("builds Slack-compatible alert payloads with bounded structured context", () => {
    const payload = buildTelemetryAlertPayload(baseLog, {
      ALERT_WEBHOOK_PROVIDER: "slack",
      ALERT_RUNBOOK_URL: "https://example.com/runbooks/id-doppelganger"
    });

    expect(payload.headers["Content-Type"]).toBe("application/json");
    expect(JSON.stringify(payload.body)).toContain("ID 도플갱어");
    expect(JSON.stringify(payload.body)).toContain("req_123");
    expect(JSON.stringify(payload.body)).toContain("https://example.com/runbooks/id-doppelganger");
    expect(JSON.stringify(payload.body)).not.toContain("abc123");
  });
});

describe("sendTelemetryAlert", () => {
  it("posts alerts to the configured HTTPS webhook", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));

    const delivery = await sendTelemetryAlert(
      baseLog,
      {
        ALERT_WEBHOOK_URL: "https://alerts.example.com/hook",
        ALERT_WEBHOOK_PROVIDER: "generic",
        ALERT_WEBHOOK_TIMEOUT_MS: "500"
      },
      fetchMock
    );

    expect(delivery).toMatchObject({ attempted: true, ok: true, status: 200 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://alerts.example.com/hook",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("skips delivery when the webhook is absent or unsafe", async () => {
    const fetchMock = vi.fn();

    await expect(sendTelemetryAlert(baseLog, {}, fetchMock)).resolves.toMatchObject({ attempted: false });
    await expect(
      sendTelemetryAlert(baseLog, { ALERT_WEBHOOK_URL: "http://alerts.example.com/hook" }, fetchMock)
    ).resolves.toMatchObject({ attempted: false, reason: "unsafe webhook url" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
