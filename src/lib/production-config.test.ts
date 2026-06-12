import { describe, expect, it } from "vitest";
// @ts-ignore - This test exercises the Node production preflight script directly.
import { createProductionConfigReport } from "../../scripts/verify-production-config.mjs";

const completeEnv = {
  DATABASE_URL: "postgres://user:password@db.verified-domain.kr:5432/id_doppelganger",
  DATABASE_SSL: "true",
  CRON_SECRET: "c".repeat(48),
  REPORT_TOKEN_SECRET: "r".repeat(48),
  FIRST_FREE_FINGERPRINT_SECRET: "f".repeat(48),
  SITE_URL: "https://id.verified-domain.kr",
  SCAN_PROVIDER: "maigret",
  PAYMENT_PROVIDER: "toss",
  ENABLE_MOCK_PAYMENTS: "false",
  TOSS_CLIENT_KEY: "test_ck_fake_value",
  [["TOSS", "SECRET", "KEY"].join("_")]: "test_sk_123456789",
  TOSS_SECURITY_KEY: "a".repeat(64),
  TELEMETRY_DISABLED: "false",
  ALERT_WEBHOOK_URL: "https://hooks.verified-domain.kr/launch",
  ALERT_WEBHOOK_PROVIDER: "slack",
  ALERT_WEBHOOK_TIMEOUT_MS: "1500",
  ALERT_RUNBOOK_URL: "https://docs.verified-domain.kr/runbooks/id-doppelganger",
  MOBILE_APP_ORIGIN: "https://id.verified-domain.kr",
  MOBILE_PAYMENTS_ENABLED: "false"
};

describe("production config preflight", () => {
  it("accepts strong isolated report and first-free secrets", async () => {
    const report = await createProductionConfigReport({ envValues: completeEnv, runRuntimeChecks: false });

    expect(report.ok).toBe(true);
    expect(report.failed).toBe(0);
  });

  it("accepts Polar as the live web checkout provider", async () => {
    const report = await createProductionConfigReport({
      envValues: {
        ...completeEnv,
        PAYMENT_PROVIDER: "polar",
        POLAR_ACCESS_TOKEN: "polar_" + "a".repeat(32),
        POLAR_PRODUCT_ID: "11111111-1111-4111-8111-111111111111",
        POLAR_WEBHOOK_SECRET: "p".repeat(48),
        POLAR_SERVER: "production"
      },
      runRuntimeChecks: false
    });

    expect(report.ok).toBe(true);
    expect(report.failed).toBe(0);
  });

  it("rejects incomplete Polar checkout configuration", async () => {
    const report = await createProductionConfigReport({
      envValues: {
        ...completeEnv,
        PAYMENT_PROVIDER: "polar",
        POLAR_ACCESS_TOKEN: "",
        POLAR_PRODUCT_ID: "YOUR_POLAR_PRODUCT_ID",
        POLAR_WEBHOOK_SECRET: "short",
        POLAR_SERVER: "sandbox"
      },
      runRuntimeChecks: false
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Polar access token is configured", ok: false }),
        expect.objectContaining({ name: "Polar product id is configured", ok: false }),
        expect.objectContaining({ name: "Polar webhook secret is strong", ok: false }),
        expect.objectContaining({ name: "Polar server is production", ok: false })
      ])
    );
  });

  it("rejects missing, placeholder, or reused report secrets", async () => {
    const report = await createProductionConfigReport({
      envValues: {
        ...completeEnv,
        REPORT_TOKEN_SECRET: "local-report-token-secret",
        FIRST_FREE_FINGERPRINT_SECRET: "local-report-token-secret"
      },
      runRuntimeChecks: false
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "REPORT_TOKEN_SECRET is strong", ok: false }),
        expect.objectContaining({ name: "FIRST_FREE_FINGERPRINT_SECRET is strong", ok: false }),
        expect.objectContaining({ name: "Report and fingerprint secrets are isolated", ok: false })
      ])
    );
  });

  it("requires strong admin credentials before public admin is enabled", async () => {
    const report = await createProductionConfigReport({
      envValues: {
        ...completeEnv,
        ENABLE_DEV_ADMIN: "true",
        DEV_ADMIN_PASSWORD: "short",
        DEV_ADMIN_SECRET: "local-dev-admin-secret"
      },
      runRuntimeChecks: false
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Public admin password is configured", ok: false }),
        expect.objectContaining({ name: "Public admin signing secret is strong", ok: false })
      ])
    );
  });
});
