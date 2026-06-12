import { describe, expect, it } from "vitest";
// @ts-ignore - This test exercises the Node launch preparation script directly.
import { createProductionReleasePreparation, normalizeProductionOrigin, renderDeployEnv, renderProductionLaunchRunbook } from "../../scripts/prepare-production-release.mjs";

const existingFiles = {
  "store-assets/apple-app-store.json": JSON.stringify({
    privacyPolicyUrl: "https://YOUR_PRODUCTION_DOMAIN/privacy",
    supportUrl: "https://YOUR_PRODUCTION_DOMAIN/responsible-use",
    marketingUrl: "https://YOUR_PRODUCTION_DOMAIN/"
  }),
  "store-assets/google-play-listing.json": JSON.stringify({
    privacyPolicyUrl: "https://YOUR_PRODUCTION_DOMAIN/privacy",
    contactEmail: "support@YOUR_DOMAIN"
  }),
  "store-assets/privacy-declarations.json": JSON.stringify({
    privacyPolicyUrl: "https://YOUR_PRODUCTION_DOMAIN/privacy",
    supportUrl: "https://YOUR_PRODUCTION_DOMAIN/responsible-use"
  })
};

const envKey = (...parts: string[]) => parts.join("_");
const liveTossClientKey = ["live", "ck", "fake_value"].join("_");
const liveTossSecretKey = ["live", "sk", "123456789"].join("_");
const testTossClientKey = ["test", "ck", "fake_value"].join("_");
const testTossSecretKey = ["test", "sk", "123456789"].join("_");

const completeEnv = {
  PRODUCTION_DOMAIN: "id.verified-domain.kr",
  STORE_SUPPORT_EMAIL: "support@verified-domain.kr",
  [envKey("TOSS", "CLIENT", "KEY")]: liveTossClientKey,
  [envKey("TOSS", "SECRET", "KEY")]: liveTossSecretKey,
  TOSS_SECURITY_KEY: "a".repeat(64),
  TOSS_CONSOLE_API_KEY: "toss-console-api-key-value",
  TOSS_CONSOLE_APP_ID: "toss-console-app",
  TOSS_MINI_APP_NAME: "id-doppelganger",
  TOSS_ALLOWED_ORIGINS: "https://id-doppelganger.apps.tossmini.com,https://id-doppelganger.private-apps.tossmini.com",
  MOBILE_PAYMENTS_ENABLED: "true",
  APPLE_BUNDLE_ID: "com.iddoppelganger.app",
  APPLE_DETAILED_REPORT_PRODUCT_ID: "detailed_report",
  APPLE_ENVIRONMENT: "production",
  GOOGLE_PLAY_PACKAGE_NAME: "com.iddoppelganger.app",
  GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID: "detailed_report",
  ALERT_WEBHOOK_URL: "https://hooks.verified-domain.kr/launch",
  ALERT_WEBHOOK_PROVIDER: "slack",
  ALERT_RUNBOOK_URL: "https://docs.verified-domain.kr/runbooks/id-doppelganger"
};

const polarEnv = {
  PAYMENT_PROVIDER: "polar",
  POLAR_ACCESS_TOKEN: "polar_" + "a".repeat(32),
  POLAR_PRODUCT_ID: "11111111-1111-4111-8111-111111111111",
  POLAR_MONTHLY_MONITORING_PRODUCT_ID: "22222222-2222-4222-8222-222222222222",
  POLAR_WEBHOOK_SECRET: "p".repeat(48),
  POLAR_SERVER: "production"
};

describe("normalizeProductionOrigin", () => {
  it("normalizes bare production domains to HTTPS origins", () => {
    expect(normalizeProductionOrigin("id.example.com/path?ignored=1")).toEqual({
      origin: "https://id.example.com",
      hostname: "id.example.com"
    });
  });

  it("rejects localhost and non-HTTPS origins", () => {
    expect(() => normalizeProductionOrigin("http://id.example.com")).toThrow("must use HTTPS");
    expect(() => normalizeProductionOrigin("https://localhost:3000")).toThrow("must not be localhost");
  });
});

describe("createProductionReleasePreparation", () => {
  it("builds final deploy, store, and native file updates when release inputs are complete", () => {
    const preparation = createProductionReleasePreparation({
      env: completeEnv,
      existingFiles,
      now: new Date("2026-06-11T00:00:00.000Z"),
      randomBytes: () => Buffer.from("abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ12")
    });

    expect(preparation.ready).toBe(true);
    expect(preparation.missing).toEqual([]);
    expect(preparation.fileUpdates.map((update: { path: string }) => update.path)).toContain("deploy/compose/.env");
    expect(preparation.fileUpdates.map((update: { path: string }) => update.path)).toContain(
      "deploy/compose/PRODUCTION_LAUNCH_RUNBOOK.md"
    );
    expect(preparation.fileUpdates.map((update: { path: string }) => update.path)).toContain("native-web/app-config.js");
    const deployEnv = preparation.fileUpdates.find((update: { path: string }) => update.path === "deploy/compose/.env")?.content ?? "";
    expect(deployEnv).toContain("DOMAIN=id.verified-domain.kr");
    expect(deployEnv).toContain("REPORT_TOKEN_SECRET=");
    expect(deployEnv).toContain("FIRST_FREE_FINGERPRINT_SECRET=");
    expect(preparation.fileUpdates.find((update: { path: string }) => update.path === "store-assets/google-play-listing.json")?.content).toContain(
      "support@verified-domain.kr"
    );
    expect(preparation.fileUpdates.map((update: { content: string }) => update.content).join("\n")).not.toContain("YOUR_PRODUCTION_DOMAIN");
  });

  it("reports missing external values instead of inventing console credentials", () => {
    const preparation = createProductionReleasePreparation({
      env: { PRODUCTION_DOMAIN: "id.example.com" },
      existingFiles
    });

    expect(preparation.ready).toBe(false);
    expect(preparation.missing).toEqual(
      expect.arrayContaining([
        "STORE_SUPPORT_EMAIL",
        "TOSS_CLIENT_KEY",
        "TOSS_SECRET_KEY",
        "TOSS_SECURITY_KEY",
        "TOSS_CONSOLE_API_KEY",
        "TOSS_CONSOLE_APP_ID",
        "TOSS_MINI_APP_NAME"
      ])
    );
  });

  it("rejects Toss sandbox payment keys before writing release files", () => {
    const preparation = createProductionReleasePreparation({
      env: {
        ...completeEnv,
        [envKey("TOSS", "CLIENT", "KEY")]: testTossClientKey,
        [envKey("TOSS", "SECRET", "KEY")]: testTossSecretKey
      },
      existingFiles
    });

    expect(preparation.ready).toBe(false);
    expect(preparation.missing).toEqual(expect.arrayContaining(["TOSS_CLIENT_KEY", "TOSS_SECRET_KEY"]));
  });

  it("requires Polar checkout values instead of Toss payment keys when Polar is selected", () => {
    const preparation = createProductionReleasePreparation({
      env: {
        ...completeEnv,
        PAYMENT_PROVIDER: "polar",
        TOSS_CLIENT_KEY: "",
        TOSS_SECRET_KEY: "",
        TOSS_SECURITY_KEY: ""
      },
      existingFiles
    });

    expect(preparation.ready).toBe(false);
    expect(preparation.missing).toEqual(
      expect.arrayContaining([
        "POLAR_ACCESS_TOKEN",
        "POLAR_PRODUCT_ID",
        "POLAR_MONTHLY_MONITORING_PRODUCT_ID",
        "POLAR_WEBHOOK_SECRET"
      ])
    );
    expect(preparation.missing).not.toContain("TOSS_CLIENT_KEY");
    expect(preparation.missing).not.toContain("TOSS_SECRET_KEY");
    expect(preparation.missing).not.toContain("TOSS_SECURITY_KEY");
  });

  it("renders Polar checkout env for production Compose", () => {
    const preparation = createProductionReleasePreparation({
      env: {
        ...completeEnv,
        ...polarEnv,
        TOSS_CLIENT_KEY: "",
        TOSS_SECRET_KEY: "",
        TOSS_SECURITY_KEY: ""
      },
      existingFiles,
      now: new Date("2026-06-11T00:00:00.000Z"),
      randomBytes: () => Buffer.from("abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ12")
    });
    const deployEnv = preparation.fileUpdates.find((update: { path: string }) => update.path === "deploy/compose/.env")?.content ?? "";

    expect(preparation.ready).toBe(true);
    expect(deployEnv).toContain("PAYMENT_PROVIDER=polar");
    expect(deployEnv).toContain(`POLAR_ACCESS_TOKEN=${polarEnv.POLAR_ACCESS_TOKEN}`);
    expect(deployEnv).toContain(`POLAR_PRODUCT_ID=${polarEnv.POLAR_PRODUCT_ID}`);
    expect(deployEnv).toContain(`POLAR_MONTHLY_MONITORING_PRODUCT_ID=${polarEnv.POLAR_MONTHLY_MONITORING_PRODUCT_ID}`);
    expect(deployEnv).toContain(`POLAR_WEBHOOK_SECRET=${polarEnv.POLAR_WEBHOOK_SECRET}`);
    expect(deployEnv).toContain("POLAR_SERVER=production");
    expect(deployEnv).toContain("TOSS_CLIENT_KEY=");
  });

  it("requires native paid reports to be enabled for production preparation", () => {
    const preparation = createProductionReleasePreparation({
      env: { ...completeEnv, MOBILE_PAYMENTS_ENABLED: "false" },
      existingFiles
    });

    expect(preparation.ready).toBe(false);
    expect(preparation.missing).toContain("MOBILE_PAYMENTS_ENABLED=true");
  });

  it("requires finalized native store identifiers before production preparation", () => {
    const {
      APPLE_BUNDLE_ID: _appleBundleId,
      APPLE_DETAILED_REPORT_PRODUCT_ID: _appleProductId,
      APPLE_ENVIRONMENT: _appleEnvironment,
      GOOGLE_PLAY_PACKAGE_NAME: _googlePackageName,
      GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID: _googleProductId,
      ...withoutNativeStoreIds
    } = completeEnv;

    const preparation = createProductionReleasePreparation({
      env: withoutNativeStoreIds,
      existingFiles
    });

    expect(preparation.ready).toBe(false);
    expect(preparation.missing).toEqual(
      expect.arrayContaining([
        "APPLE_BUNDLE_ID=com.iddoppelganger.app",
        "APPLE_DETAILED_REPORT_PRODUCT_ID=detailed_report",
        "APPLE_ENVIRONMENT=production",
        "GOOGLE_PLAY_PACKAGE_NAME=com.iddoppelganger.app",
        "GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID=detailed_report"
      ])
    );
  });

  it("rejects placeholder production domains before writing release files", () => {
    const preparation = createProductionReleasePreparation({
      env: { ...completeEnv, PRODUCTION_DOMAIN: "id.example.com" },
      existingFiles
    });

    expect(preparation.ready).toBe(false);
    expect(preparation.missing).toContain("PRODUCTION_DOMAIN");
  });
});

describe("renderProductionLaunchRunbook", () => {
  it("renders a launch sequence without leaking generated or provider secrets", () => {
    const runbook = renderProductionLaunchRunbook({
      DOMAIN: "id.verified-domain.kr",
      SITE_URL: "https://id.verified-domain.kr",
      RELEASE_VERSION: "release-20260611",
      STORE_SUPPORT_EMAIL: "support@verified-domain.kr",
      TOSS_MINI_APP_NAME: "id-doppelganger",
      TOSS_ALLOWED_ORIGINS:
        "https://id-doppelganger.apps.tossmini.com,https://id-doppelganger.private-apps.tossmini.com",
      MOBILE_APP_ORIGIN: "https://id.verified-domain.kr",
      ALERT_WEBHOOK_PROVIDER: "slack",
      ALERT_RUNBOOK_URL: "https://docs.verified-domain.kr/runbooks/id-doppelganger",
      TOSS_CLIENT_KEY: "test_ck_should_not_render",
      [["TOSS", "SECRET", "KEY"].join("_")]: "test_sk_should_not_render",
      TOSS_SECURITY_KEY: "a".repeat(64),
      PAYMENT_PROVIDER: "polar",
      POLAR_ACCESS_TOKEN: "polar_should_not_render",
      POLAR_PRODUCT_ID: "product_should_not_render",
      POLAR_MONTHLY_MONITORING_PRODUCT_ID: "monthly_product_should_not_render",
      POLAR_WEBHOOK_SECRET: "polar_webhook_should_not_render",
      "POSTGRES_PASSWORD": "postgres_should_not_render",
      "CRON_SECRET": "cron_should_not_render",
      ALERT_WEBHOOK_URL: "https://hooks.verified-domain.kr/secret-webhook"
    });

    expect(runbook).toContain("docker compose --env-file deploy/compose/.env");
    expect(runbook).toContain('PRODUCTION_BASE_URL="https://id.verified-domain.kr" npm run verify:production');
    expect(runbook).toContain("TOSS_RELEASE_CHECK=true");
    expect(runbook).toContain("Web checkout provider: Polar");
    expect(runbook).toContain("STORE_RELEASE_CHECK=true");
    expect(runbook).toContain("MOBILE_RELEASE_CHECK=true");
    expect(runbook).not.toContain("test_ck_should_not_render");
    expect(runbook).not.toContain("test_sk_should_not_render");
    expect(runbook).not.toContain("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(runbook).not.toContain("postgres_should_not_render");
    expect(runbook).not.toContain("cron_should_not_render");
    expect(runbook).not.toContain("secret-webhook");
    expect(runbook).not.toContain("polar_should_not_render");
    expect(runbook).not.toContain("monthly_product_should_not_render");
    expect(runbook).not.toContain("polar_webhook_should_not_render");
  });
});

describe("renderDeployEnv", () => {
  it("renders URL-safe generated secrets", () => {
    const env = renderDeployEnv({
      DOMAIN: "id.verified-domain.kr",
      SITE_URL: "https://id.verified-domain.kr",
      "POSTGRES_PASSWORD": "abc_123-DEF.456~ghi",
      "CRON_SECRET": "abc_123-DEF.456~ghi_abc_123-DEF.456~ghi",
      REPORT_TOKEN_SECRET: "report_abc_123-DEF.456~ghi_abc_123-DEF.456~ghi",
      FIRST_FREE_FINGERPRINT_SECRET: "fingerprint_abc_123-DEF.456~ghi_abc_123-DEF.456~ghi",
      [envKey("TOSS", "CLIENT", "KEY")]: liveTossClientKey,
      [envKey("TOSS", "SECRET", "KEY")]: liveTossSecretKey,
      TOSS_SECURITY_KEY: "a".repeat(64),
      POLAR_ACCESS_TOKEN: "",
      POLAR_PRODUCT_ID: "",
      POLAR_MONTHLY_MONITORING_PRODUCT_ID: "",
      POLAR_WEBHOOK_SECRET: "",
      POLAR_SERVER: "production",
      TOSS_CONSOLE_APP_ID: "toss-console-app",
      TOSS_MINI_APP_NAME: "id-doppelganger",
      TOSS_ALLOWED_ORIGINS: "https://id-doppelganger.apps.tossmini.com,https://id-doppelganger.private-apps.tossmini.com",
      ALERT_WEBHOOK_URL: "https://hooks.verified-domain.kr/launch",
      ALERT_WEBHOOK_PROVIDER: "slack",
      ALERT_RUNBOOK_URL: "https://docs.verified-domain.kr/runbooks/id-doppelganger",
      STORE_SUPPORT_EMAIL: "support@verified-domain.kr",
      RELEASE_VERSION: "release-20260611"
    });

    expect(env).toContain("POSTGRES_PASSWORD=abc_123-DEF.456~ghi");
    expect(env).toContain("CRON_SECRET=abc_123-DEF.456~ghi_abc_123-DEF.456~ghi");
    expect(env).toContain("REPORT_TOKEN_SECRET=report_abc_123-DEF.456~ghi_abc_123-DEF.456~ghi");
    expect(env).toContain("FIRST_FREE_FINGERPRINT_SECRET=fingerprint_abc_123-DEF.456~ghi_abc_123-DEF.456~ghi");
    expect(env).toContain(`TOSS_CLIENT_KEY=${liveTossClientKey}`);
    expect(env).toContain(`TOSS_SECURITY_KEY=${"a".repeat(64)}`);
    expect(env).toContain("POLAR_SERVER=production");
    expect(env).not.toContain("replace-with");
  });
});
