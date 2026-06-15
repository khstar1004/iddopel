import { describe, expect, it } from "vitest";
// @ts-ignore - This test exercises the Node production preflight script directly.
import { createProductionConfigReport } from "../../scripts/verify-production-config.mjs";

const envKey = (...parts: string[]) => parts.join("_");
const liveTossClientKey = ["live", "ck", "fake_value"].join("_");
const liveTossSecretKey = ["live", "sk", "123456789"].join("_");
const testTossClientKey = ["test", "ck", "fake_value"].join("_");
const testTossSecretKey = ["test", "sk", "123456789"].join("_");

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
  WEB_DETAILED_REPORT_PAYWALL_ENABLED: "true",
  MONITORING_PAYWALL_ENABLED: "true",
  [envKey("TOSS", "CLIENT", "KEY")]: liveTossClientKey,
  [envKey("TOSS", "SECRET", "KEY")]: liveTossSecretKey,
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

  it("accepts Vercel-style POSTGRES_URL for production persistence", async () => {
    const { DATABASE_URL: _databaseUrl, ...withoutDatabaseUrl } = completeEnv;
    const report = await createProductionConfigReport({
      envValues: {
        ...withoutDatabaseUrl,
        POSTGRES_URL: "postgres://user:password@db.verified-domain.kr:5432/id_doppelganger"
      },
      runRuntimeChecks: false
    });

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
        POLAR_MONTHLY_MONITORING_PRODUCT_ID: "22222222-2222-4222-8222-222222222222",
        POLAR_WEBHOOK_SECRET: "p".repeat(48),
        POLAR_SERVER: "production"
      },
      runRuntimeChecks: false
    });

    expect(report.ok).toBe(true);
    expect(report.failed).toBe(0);
  });

  it("accepts PortOne as the live web checkout provider", async () => {
    const report = await createProductionConfigReport({
      envValues: {
        ...completeEnv,
        PAYMENT_PROVIDER: "portone",
        NEXT_PUBLIC_PORTONE_STORE_ID: "store-0a47c3c4-3b2c-4037-a77b-4fd1ee0b575f",
        NEXT_PUBLIC_PORTONE_CHANNEL_KEY: "channel-key-live-12345",
        PORTONE_API_SECRET: "not-a-real-portone-api-secret"
      },
      runRuntimeChecks: false
    });

    expect(report.ok).toBe(true);
    expect(report.failed).toBe(0);
  });

  it("accepts KG Inicis as the live web checkout provider", async () => {
    const report = await createProductionConfigReport({
      envValues: {
        ...completeEnv,
        PAYMENT_PROVIDER: "inicis",
        INICIS_MID: "INIpayTest",
        INICIS_SIGN_KEY: "i".repeat(40)
      },
      runRuntimeChecks: false
    });

    expect(report.ok).toBe(true);
    expect(report.failed).toBe(0);
  });

  it("rejects Toss test keys in production preflight", async () => {
    const report = await createProductionConfigReport({
      envValues: {
        ...completeEnv,
        [envKey("TOSS", "CLIENT", "KEY")]: testTossClientKey,
        [envKey("TOSS", "SECRET", "KEY")]: testTossSecretKey
      },
      runRuntimeChecks: false
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Toss live client key is configured", ok: false }),
        expect.objectContaining({ name: "Toss live secret key is configured", ok: false })
      ])
    );
  });

  it("rejects incomplete Polar checkout configuration", async () => {
    const report = await createProductionConfigReport({
      envValues: {
        ...completeEnv,
        PAYMENT_PROVIDER: "polar",
        POLAR_ACCESS_TOKEN: "",
        POLAR_PRODUCT_ID: "YOUR_POLAR_PRODUCT_ID",
        POLAR_MONTHLY_MONITORING_PRODUCT_ID: "YOUR_POLAR_MONTHLY_MONITORING_PRODUCT_ID",
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
        expect.objectContaining({ name: "Polar monthly monitoring product id is configured", ok: false }),
        expect.objectContaining({ name: "Polar webhook secret is strong", ok: false }),
        expect.objectContaining({ name: "Polar server is production", ok: false })
      ])
    );
  });

  it("rejects incomplete PortOne checkout configuration", async () => {
    const report = await createProductionConfigReport({
      envValues: {
        ...completeEnv,
        PAYMENT_PROVIDER: "portone",
        NEXT_PUBLIC_PORTONE_STORE_ID: "YOUR_PORTONE_STORE_ID",
        NEXT_PUBLIC_PORTONE_CHANNEL_KEY: "",
        PORTONE_API_SECRET: "short"
      },
      runRuntimeChecks: false
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "PortOne store id is configured", ok: false }),
        expect.objectContaining({ name: "PortOne channel key is configured", ok: false }),
        expect.objectContaining({ name: "PortOne API secret is configured", ok: false })
      ])
    );
  });

  it("rejects incomplete KG Inicis checkout configuration", async () => {
    const report = await createProductionConfigReport({
      envValues: {
        ...completeEnv,
        PAYMENT_PROVIDER: "inicis",
        INICIS_MID: "",
        INICIS_SIGN_KEY: "YOUR_INICIS_SIGN_KEY"
      },
      runRuntimeChecks: false
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "KG Inicis MID is configured", ok: false }),
        expect.objectContaining({ name: "KG Inicis sign key is configured", ok: false })
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
