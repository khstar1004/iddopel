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

const completeEnv = {
  PRODUCTION_DOMAIN: "id.verified-domain.kr",
  STORE_SUPPORT_EMAIL: "support@verified-domain.kr",
  TOSS_CLIENT_KEY: "test_ck_fake_value",
  "TOSS_SECRET_KEY": "test_sk_123456789",
  TOSS_SECURITY_KEY: "a".repeat(64),
  TOSS_CONSOLE_API_KEY: "toss-console-api-key-value",
  TOSS_CONSOLE_APP_ID: "toss-console-app",
  TOSS_MINI_APP_NAME: "id-doppelganger",
  MOBILE_PAYMENTS_ENABLED: "true",
  ALERT_WEBHOOK_URL: "https://hooks.verified-domain.kr/launch",
  ALERT_WEBHOOK_PROVIDER: "slack",
  ALERT_RUNBOOK_URL: "https://docs.verified-domain.kr/runbooks/id-doppelganger"
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
    expect(preparation.fileUpdates.find((update: { path: string }) => update.path === "deploy/compose/.env")?.content).toContain(
      "DOMAIN=id.verified-domain.kr"
    );
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

  it("requires native paid reports to be enabled for production preparation", () => {
    const preparation = createProductionReleasePreparation({
      env: { ...completeEnv, MOBILE_PAYMENTS_ENABLED: "false" },
      existingFiles
    });

    expect(preparation.ready).toBe(false);
    expect(preparation.missing).toContain("MOBILE_PAYMENTS_ENABLED=true");
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
      "POSTGRES_PASSWORD": "postgres_should_not_render",
      "CRON_SECRET": "cron_should_not_render",
      ALERT_WEBHOOK_URL: "https://hooks.verified-domain.kr/secret-webhook"
    });

    expect(runbook).toContain("docker compose --env-file deploy/compose/.env");
    expect(runbook).toContain('PRODUCTION_BASE_URL="https://id.verified-domain.kr" npm run verify:production');
    expect(runbook).toContain("TOSS_RELEASE_CHECK=true");
    expect(runbook).toContain("STORE_RELEASE_CHECK=true");
    expect(runbook).toContain("MOBILE_RELEASE_CHECK=true");
    expect(runbook).not.toContain("test_ck_should_not_render");
    expect(runbook).not.toContain("test_sk_should_not_render");
    expect(runbook).not.toContain("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(runbook).not.toContain("postgres_should_not_render");
    expect(runbook).not.toContain("cron_should_not_render");
    expect(runbook).not.toContain("secret-webhook");
  });
});

describe("renderDeployEnv", () => {
  it("renders URL-safe generated secrets", () => {
    const env = renderDeployEnv({
      DOMAIN: "id.verified-domain.kr",
      SITE_URL: "https://id.verified-domain.kr",
      "POSTGRES_PASSWORD": "abc_123-DEF.456~ghi",
      "CRON_SECRET": "abc_123-DEF.456~ghi_abc_123-DEF.456~ghi",
      TOSS_CLIENT_KEY: "test_ck_fake_value",
      "TOSS_SECRET_KEY": "test_sk_123456789",
      TOSS_SECURITY_KEY: "a".repeat(64),
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
    expect(env).toContain("TOSS_CLIENT_KEY=test_ck_fake_value");
    expect(env).toContain(`TOSS_SECURITY_KEY=${"a".repeat(64)}`);
    expect(env).not.toContain("replace-with");
  });
});
