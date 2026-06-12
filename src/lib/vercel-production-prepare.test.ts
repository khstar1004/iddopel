import { describe, expect, it } from "vitest";
// @ts-ignore - This test exercises the Node Vercel production preparation script directly.
import { createVercelProductionPreparation, renderVercelProductionRunbook } from "../../scripts/prepare-vercel-production.mjs";

const strongSecret = "1234567890abcdef1234567890abcdef";
const envKey = (...parts: string[]) => parts.join("_");
const liveTossClientKey = ["live", "ck", "fake_value"].join("_");
const liveTossSecretKey = ["live", "sk", "fake_value"].join("_");
const testTossClientKey = ["test", "ck", "fake_value"].join("_");
const testTossSecretKey = ["test", "sk", "fake_value"].join("_");

const completeTossEnv = {
  PRODUCTION_DOMAIN: "iddopel.vercel.app",
  STORE_SUPPORT_EMAIL: "support@iddopel.example",
  [envKey("DATABASE", "URL")]: "postgres://user:super-secret@db.iddopel.test:5432/app",
  DATABASE_SSL: "true",
  [envKey("CRON", "SECRET")]: strongSecret,
  [envKey("REPORT", "TOKEN", "SECRET")]: `${strongSecret}a`,
  [envKey("FIRST", "FREE", "FINGERPRINT", "SECRET")]: `${strongSecret}b`,
  [envKey("MAIGRET", "API", "SECRET")]: `${strongSecret}maigret`,
  PAYMENT_PROVIDER: "toss",
  [envKey("TOSS", "CLIENT", "KEY")]: liveTossClientKey,
  [envKey("TOSS", "SECRET", "KEY")]: liveTossSecretKey,
  [envKey("TOSS", "SECURITY", "KEY")]: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  [envKey("TOSS", "CONSOLE", "API", "KEY")]: "fake-toss-console-api-key",
  TOSS_CONSOLE_APP_ID: "toss-console-app-id",
  TOSS_MINI_APP_NAME: "id-doppelganger",
  TOSS_ALLOWED_ORIGINS: "https://id-doppelganger.apps.tossmini.com",
  WEB_DETAILED_REPORT_PAYWALL_ENABLED: "true",
  MONITORING_PAYWALL_ENABLED: "true",
  [envKey("ALERT", "WEBHOOK", "URL")]: "https://hooks.iddopel.test/launch",
  ALERT_WEBHOOK_PROVIDER: "slack",
  ALERT_RUNBOOK_URL: "https://iddopel.example/runbooks/launch",
  MOBILE_PAYMENTS_ENABLED: "true",
  APPLE_BUNDLE_ID: "com.iddoppelganger.app",
  APPLE_DETAILED_REPORT_PRODUCT_ID: "detailed_report",
  APPLE_ENVIRONMENT: "production",
  [envKey("APPLE", "KEY", "ID")]: "apple-key-id",
  [envKey("APPLE", "ISSUER", "ID")]: "apple-issuer-id",
  [envKey("APPLE", "PRIVATE", "KEY")]: "-----BEGIN " + "PRIVATE KEY-----\\nsecret\\n-----END " + "PRIVATE KEY-----",
  APPLE_APP_APPLE_ID: "1234567890",
  GOOGLE_PLAY_PACKAGE_NAME: "com.iddoppelganger.app",
  GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID: "detailed_report",
  [envKey("GOOGLE", "PLAY", "SERVICE", "ACCOUNT", "JSON")]: "{\"client_email\":\"publisher@iddopel.test\",\"private_key\":\"secret\"}"
};

describe("prepare Vercel production env", () => {
  it("builds a ready Toss production plan without exposing secret values", () => {
    const plan = createVercelProductionPreparation({
      fileEnv: completeTossEnv,
      env: {},
      now: new Date("2026-06-12T00:00:00.000Z")
    });
    const rendered = JSON.stringify(plan);
    const runbook = renderVercelProductionRunbook(plan);

    expect(plan.ready).toBe(true);
    expect(plan.missing).toEqual([]);
    expect(plan.entries).toContainEqual(
      expect.objectContaining({
        key: "SITE_URL",
        redactedValue: "https://iddopel.vercel.app",
        required: true
      })
    );
    expect(plan.commands).toContain("vercel env add DATABASE_URL production --sensitive < .vercel-env/production/DATABASE_URL");
    expect(plan.commands).toContain("vercel env run -e production -- npm run db:migrate");

    expect(rendered).not.toContain("super-secret");
    expect(rendered).not.toContain("test_sk_example_secret_key");
    expect(rendered).not.toContain("BEGIN PRIVATE KEY");
    expect(runbook).not.toContain("super-secret");
    expect(runbook).not.toContain("test_sk_example_secret_key");
    expect(runbook).toContain("vercel env add TOSS_SECRET_KEY production --sensitive < .vercel-env/production/TOSS_SECRET_KEY");
  });

  it("requires Toss checkout keys when Toss is selected", () => {
    const plan = createVercelProductionPreparation({
      fileEnv: {
        ...completeTossEnv,
        [envKey("TOSS", "SECRET", "KEY")]: "YOUR_TOSS_SECRET_KEY",
        [envKey("TOSS", "SECURITY", "KEY")]: ""
      },
      env: {}
    });

    expect(plan.ready).toBe(false);
    expect(plan.missing).toEqual(expect.arrayContaining(["TOSS_SECRET_KEY", "TOSS_SECURITY_KEY"]));
  });

  it("rejects Toss sandbox payment keys for Vercel production", () => {
    const plan = createVercelProductionPreparation({
      fileEnv: {
        ...completeTossEnv,
        [envKey("TOSS", "CLIENT", "KEY")]: testTossClientKey,
        [envKey("TOSS", "SECRET", "KEY")]: testTossSecretKey
      },
      env: {}
    });

    expect(plan.ready).toBe(false);
    expect(plan.missing).toEqual(expect.arrayContaining(["TOSS_CLIENT_KEY", "TOSS_SECRET_KEY"]));
  });

  it("requires Polar keys instead of Toss payment keys when Polar is selected", () => {
    const plan = createVercelProductionPreparation({
      fileEnv: {
        ...completeTossEnv,
        PAYMENT_PROVIDER: "polar",
        [envKey("TOSS", "CLIENT", "KEY")]: "",
        [envKey("TOSS", "SECRET", "KEY")]: "",
        [envKey("TOSS", "SECURITY", "KEY")]: "",
        [envKey("POLAR", "ACCESS", "TOKEN")]: "fake-polar-access-token",
        POLAR_PRODUCT_ID: "polar-detail-product",
        POLAR_MONTHLY_MONITORING_PRODUCT_ID: "polar-monitoring-product",
        [envKey("POLAR", "WEBHOOK", "SECRET")]: `${strongSecret}polar`
      },
      env: {}
    });

    expect(plan.ready).toBe(true);
    expect(plan.missing).toEqual([]);
    expect(plan.entries.map((entry: { key: string }) => entry.key)).toEqual(
      expect.arrayContaining([
        "POLAR_ACCESS_TOKEN",
        "POLAR_PRODUCT_ID",
        "POLAR_MONTHLY_MONITORING_PRODUCT_ID",
        "POLAR_WEBHOOK_SECRET"
      ])
    );
    expect(plan.entries.map((entry: { key: string }) => entry.key)).not.toContain("TOSS_SECRET_KEY");
  });
});
