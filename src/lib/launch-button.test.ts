import { describe, expect, it } from "vitest";
// @ts-ignore - This test exercises the Node launch button script directly.
import { buildLaunchButtonPlan, buildLaunchEnvironment, createPublicLaunchReport, parseEnvText, runLaunchButtonPlan } from "../../scripts/launch-button.mjs";

const envKey = (...parts: string[]) => parts.join("_");
const liveTossClientKey = ["live", "ck", "123456789"].join("_");
const liveTossSecretKey = ["live", "sk", "123456789"].join("_");
const testTossClientKey = ["test", "ck", "123456789"].join("_");
const testTossSecretKey = ["test", "sk", "123456789"].join("_");

const sensitiveEnv = {
  [envKey("TOSS", "CLIENT", "KEY")]: liveTossClientKey,
  [envKey("TOSS", "SECRET", "KEY")]: liveTossSecretKey,
  [envKey("TOSS", "SECURITY", "KEY")]: "a".repeat(64),
  [envKey("DATABASE", "URL")]: "postgres://launch_user:launch_pass@db.iddoppelganger.kr:5432/id_doppelganger",
  [envKey("CRON", "SECRET")]: "cron-secret-value-1234567890",
  [envKey("REPORT", "TOKEN", "SECRET")]: "report-token-secret-value-1234567890",
  [envKey("FIRST", "FREE", "FINGERPRINT", "SECRET")]: "first-free-fingerprint-secret-value-1234567890"
};

const polarPaymentEnv = {
  PAYMENT_PROVIDER: "polar",
  POLAR_ACCESS_TOKEN: "polar_" + "a".repeat(32),
  POLAR_PRODUCT_ID: "11111111-1111-4111-8111-111111111111",
  POLAR_MONTHLY_MONITORING_PRODUCT_ID: "22222222-2222-4222-8222-222222222222",
  POLAR_WEBHOOK_SECRET: "p".repeat(48),
  POLAR_SERVER: "production"
};

const portOnePaymentEnv = {
  PAYMENT_PROVIDER: "portone",
  NEXT_PUBLIC_PORTONE_STORE_ID: "store-0a47c3c4-3b2c-4037-a77b-4fd1ee0b575f",
  NEXT_PUBLIC_PORTONE_CHANNEL_KEY: "channel-key-live-12345",
  PORTONE_API_SECRET: "not-a-real-portone-api-secret"
};

const storeCredentialEnv = {
  [["APPLE", "KEY", "ID"].join("_")]: "ABC123DEFG",
  [["APPLE", "ISSUER", "ID"].join("_")]: "00000000-0000-0000-0000-000000000000",
  [["APPLE", "PRIVATE", "KEY"].join("_")]: "not-a-real-app-store-key",
  APPLE_APP_APPLE_ID: "1234567890",
  [["GOOGLE", "PLAY", "SERVICE", "ACCOUNT", "JSON"].join("_")]: JSON.stringify({ type: "service_account" }),
  [["GOOGLE", "PLAY", "UPLOAD", "KEYSTORE", "BASE64"].join("_")]: "bm90LWEtcmVhbC1rZXlzdG9yZQ==",
  [["GOOGLE", "PLAY", "UPLOAD", "KEYSTORE", "PASSWORD"].join("_")]: "not-a-real-keystore-password",
  [["GOOGLE", "PLAY", "UPLOAD", "KEY", "ALIAS"].join("_")]: "upload",
  [["GOOGLE", "PLAY", "UPLOAD", "KEY", "PASSWORD"].join("_")]: "not-a-real-key-password"
};

const completeFileEnv: Record<string, string> = {
  PRODUCTION_DOMAIN: "id.verified-domain.kr",
  STORE_SUPPORT_EMAIL: "support@verified-domain.kr",
  MOBILE_PAYMENTS_ENABLED: "true",
  TOSS_CONSOLE_API_KEY: "toss-console-api-key-value",
  TOSS_CONSOLE_APP_ID: "toss-console-app",
  TOSS_MINI_APP_NAME: "id-doppelganger",
  TOSS_REVIEW_TEST_USERNAME: "khstar104",
  TOSS_REVIEW_SCENARIO: "Enter the review username, run the scan, and open checkout.",
  ALERT_WEBHOOK_URL: "https://hooks.verified-domain.kr/launch-secret-path",
  ALERT_RUNBOOK_URL: "https://docs.verified-domain.kr/runbooks/id-doppelganger",
  ...sensitiveEnv,
  ...storeCredentialEnv
};

describe("parseEnvText", () => {
  it("parses launch env files with comments, export prefixes, and quoted values", () => {
    expect(
      parseEnvText(`
        # production launch values
        export PRODUCTION_DOMAIN="id.verified-domain.kr"
        STORE_SUPPORT_EMAIL=support@verified-domain.kr # inline comment
        TOSS_MINI_APP_NAME='id-doppelganger'
      `)
    ).toEqual({
      PRODUCTION_DOMAIN: "id.verified-domain.kr",
      STORE_SUPPORT_EMAIL: "support@verified-domain.kr",
      TOSS_MINI_APP_NAME: "id-doppelganger"
    });
  });

  it("unescapes double quoted launch env values", () => {
    const googlePlayServiceAccountJsonKey = ["GOOGLE", "PLAY", "SERVICE", "ACCOUNT", "JSON"].join("_");

    expect(
      parseEnvText(String.raw`
        ${googlePlayServiceAccountJsonKey}="{\"type\":\"service_account\"}"
        TOSS_REVIEW_SCENARIO="Run scan #1"
      `)
    ).toMatchObject({
      [googlePlayServiceAccountJsonKey]: "{\"type\":\"service_account\"}",
      TOSS_REVIEW_SCENARIO: "Run scan #1"
    });
  });
});

describe("buildLaunchButtonPlan", () => {
  it("derives production origins and builds a ship plan from one launch env", () => {
    const env = buildLaunchEnvironment({ fileEnv: completeFileEnv, env: {} });
    const plan = buildLaunchButtonPlan({ env, envFile: ".env.launch", ship: true, localGate: true });

    expect(env).toMatchObject({
      APP_STORE_CONNECT_KEY_ID: "ABC123DEFG",
      APP_STORE_CONNECT_ISSUER_ID: "00000000-0000-0000-0000-000000000000",
      TOSS_ALLOWED_ORIGINS:
        "https://id-doppelganger.apps.tossmini.com,https://id-doppelganger.private-apps.tossmini.com",
      SITE_URL: "https://id.verified-domain.kr",
      PRODUCTION_BASE_URL: "https://id.verified-domain.kr",
      SMOKE_BASE_URL: "https://id.verified-domain.kr",
      STORE_PRODUCTION_ORIGIN: "https://id.verified-domain.kr",
      MOBILE_APP_ORIGIN: "https://id.verified-domain.kr",
      APPLE_BUNDLE_ID: "com.iddoppelganger.app",
      APPLE_DETAILED_REPORT_PRODUCT_ID: "detailed_report",
      APPLE_ENVIRONMENT: "production",
      GOOGLE_PLAY_PACKAGE_NAME: "com.iddoppelganger.app",
      GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID: "detailed_report",
      SCAN_PROVIDER: "maigret",
      PAYMENT_PROVIDER: "toss",
      ENABLE_MOCK_PAYMENTS: "false"
    });
    expect(plan.ready).toBe(true);
    expect(plan.steps.map((step: { id: string }) => step.id)).toEqual([
      "generate-release-assets",
      "local-release-gate",
      "prepare-production-files",
      "verify-compose-release-config",
      "deploy-compose-stack",
      "verify-live-production"
    ]);
  });

  it("reports missing launch values before execute mode can run", () => {
    const env = buildLaunchEnvironment({ fileEnv: { PRODUCTION_DOMAIN: "id.verified-domain.kr" }, env: {} });
    const plan = buildLaunchButtonPlan({ env, ship: true });

    expect(plan.ready).toBe(false);
    expect(plan.missing).toEqual(
      expect.arrayContaining([
        "STORE_SUPPORT_EMAIL",
        "TOSS_CLIENT_KEY",
        "TOSS_SECRET_KEY",
        "TOSS_SECURITY_KEY",
        "TOSS_CONSOLE_API_KEY",
        "TOSS_ALLOWED_ORIGINS",
        "DATABASE_URL",
        "CRON_SECRET",
        "REPORT_TOKEN_SECRET",
        "FIRST_FREE_FINGERPRINT_SECRET",
        "ALERT_WEBHOOK_URL",
        "APPLE_KEY_ID",
        "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
        "GOOGLE_PLAY_UPLOAD_KEYSTORE_BASE64",
        "GOOGLE_PLAY_UPLOAD_KEYSTORE_PASSWORD",
        "GOOGLE_PLAY_UPLOAD_KEY_ALIAS",
        "GOOGLE_PLAY_UPLOAD_KEY_PASSWORD"
      ])
    );
  });

  it("requires Polar checkout keys instead of Toss payment keys when Polar is selected", () => {
    const env = buildLaunchEnvironment({
      fileEnv: {
        ...completeFileEnv,
        PAYMENT_PROVIDER: "polar",
        TOSS_CLIENT_KEY: "",
        TOSS_SECRET_KEY: "",
        TOSS_SECURITY_KEY: ""
      },
      env: {}
    });
    const plan = buildLaunchButtonPlan({ env, ship: true });

    expect(plan.ready).toBe(false);
    expect(plan.missing).toEqual(
      expect.arrayContaining([
        "POLAR_ACCESS_TOKEN",
        "POLAR_PRODUCT_ID",
        "POLAR_MONTHLY_MONITORING_PRODUCT_ID",
        "POLAR_WEBHOOK_SECRET"
      ])
    );
    expect(plan.missing).not.toContain("TOSS_CLIENT_KEY");
    expect(plan.missing).not.toContain("TOSS_SECRET_KEY");
    expect(plan.missing).not.toContain("TOSS_SECURITY_KEY");
  });

  it("accepts Vercel-style POSTGRES_URL as the launch database URL", () => {
    const { DATABASE_URL: _databaseUrl, ...withoutDatabaseUrl } = completeFileEnv;
    const env = buildLaunchEnvironment({
      fileEnv: {
        ...withoutDatabaseUrl,
        POSTGRES_URL: "postgres://USER:PASSWORD@db.iddoppelganger.kr:5432/id_doppelganger"
      },
      env: {}
    });
    const plan = buildLaunchButtonPlan({ env, ship: true });

    expect(env.DATABASE_URL).toBe("postgres://USER:PASSWORD@db.iddoppelganger.kr:5432/id_doppelganger");
    expect(plan.ready).toBe(true);
    expect(plan.missing).not.toContain("DATABASE_URL");
  });

  it("builds a ship plan with Polar checkout credentials", () => {
    const env = buildLaunchEnvironment({
      fileEnv: {
        ...completeFileEnv,
        ...polarPaymentEnv,
        TOSS_CLIENT_KEY: "",
        TOSS_SECRET_KEY: "",
        TOSS_SECURITY_KEY: ""
      },
      env: {}
    });
    const plan = buildLaunchButtonPlan({ env, ship: true });

    expect(env).toMatchObject({
      PAYMENT_PROVIDER: "polar",
      POLAR_SERVER: "production"
    });
    expect(plan.ready).toBe(true);
    expect(plan.missing).not.toEqual(expect.arrayContaining(["TOSS_CLIENT_KEY", "TOSS_SECRET_KEY", "TOSS_SECURITY_KEY"]));
  });

  it("builds a ship plan with PortOne checkout credentials", () => {
    const env = buildLaunchEnvironment({
      fileEnv: {
        ...completeFileEnv,
        ...portOnePaymentEnv,
        TOSS_CLIENT_KEY: "",
        TOSS_SECRET_KEY: "",
        TOSS_SECURITY_KEY: ""
      },
      env: {}
    });
    const plan = buildLaunchButtonPlan({ env, ship: true });

    expect(env).toMatchObject({
      PAYMENT_PROVIDER: "portone",
      NEXT_PUBLIC_PORTONE_STORE_ID: portOnePaymentEnv.NEXT_PUBLIC_PORTONE_STORE_ID
    });
    expect(plan.ready).toBe(true);
    expect(plan.missing).not.toEqual(expect.arrayContaining(["TOSS_CLIENT_KEY", "TOSS_SECRET_KEY", "TOSS_SECURITY_KEY"]));
  });

  it("does not ask operators for URLs that are derived from the production domain", () => {
    const env = buildLaunchEnvironment({ fileEnv: {}, env: {} });
    const plan = buildLaunchButtonPlan({ env, ship: true });

    expect(plan.missing).toContain("PRODUCTION_DOMAIN");
    expect(plan.missing).not.toContain("PRODUCTION_BASE_URL");
    expect(plan.missing).not.toContain("SMOKE_BASE_URL");
  });

  it("rejects placeholder values before ship execution can run", () => {
    const env = buildLaunchEnvironment({
      fileEnv: {
        ...completeFileEnv,
        TOSS_CLIENT_KEY: "YOUR_TOSS_CLIENT_KEY",
        TOSS_SECRET_KEY: "YOUR_TOSS_SECRET_KEY",
        TOSS_SECURITY_KEY: "YOUR_TOSS_SECURITY_KEY",
        STORE_SUPPORT_EMAIL: "support@YOUR_DOMAIN"
      },
      env: {}
    });
    const plan = buildLaunchButtonPlan({ env, ship: true });

    expect(plan.ready).toBe(false);
    expect(plan.missing).toEqual(expect.arrayContaining(["STORE_SUPPORT_EMAIL", "TOSS_CLIENT_KEY", "TOSS_SECRET_KEY", "TOSS_SECURITY_KEY"]));
  });

  it("rejects sandbox Toss payment keys before ship execution can run", () => {
    const env = buildLaunchEnvironment({
      fileEnv: {
        ...completeFileEnv,
        [envKey("TOSS", "CLIENT", "KEY")]: testTossClientKey,
        [envKey("TOSS", "SECRET", "KEY")]: testTossSecretKey
      },
      env: {}
    });
    const plan = buildLaunchButtonPlan({ env, ship: true });

    expect(plan.ready).toBe(false);
    expect(plan.missing).toEqual(expect.arrayContaining(["TOSS_CLIENT_KEY", "TOSS_SECRET_KEY"]));
  });

  it("keeps ship execution blocked until store release credentials are present", () => {
    const withoutStoreCredentials = { ...completeFileEnv };
    for (const key of [
      "APPLE_KEY_ID",
      "APPLE_ISSUER_ID",
      "APPLE_PRIVATE_KEY",
      "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
      envKey("GOOGLE", "PLAY", "UPLOAD", "KEYSTORE", "BASE64"),
      envKey("GOOGLE", "PLAY", "UPLOAD", "KEYSTORE", "PASSWORD"),
      envKey("GOOGLE", "PLAY", "UPLOAD", "KEY", "ALIAS"),
      envKey("GOOGLE", "PLAY", "UPLOAD", "KEY", "PASSWORD")
    ]) {
      delete withoutStoreCredentials[key];
    }
    const env = buildLaunchEnvironment({ fileEnv: withoutStoreCredentials, env: {} });
    const plan = buildLaunchButtonPlan({ env, ship: true });

    expect(plan.ready).toBe(false);
    expect(plan.missing).toEqual(
      expect.arrayContaining([
        "APPLE_KEY_ID",
        "APPLE_ISSUER_ID",
        "APPLE_PRIVATE_KEY",
        "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
        "GOOGLE_PLAY_UPLOAD_KEYSTORE_BASE64",
        "GOOGLE_PLAY_UPLOAD_KEYSTORE_PASSWORD",
        "GOOGLE_PLAY_UPLOAD_KEY_ALIAS",
        "GOOGLE_PLAY_UPLOAD_KEY_PASSWORD"
      ])
    );
  });

  it("keeps ship execution blocked until native paid reports are enabled", () => {
    const { MOBILE_PAYMENTS_ENABLED: _mobilePaymentsEnabled, ...withoutMobilePayments } = completeFileEnv;
    const env = buildLaunchEnvironment({ fileEnv: withoutMobilePayments, env: {} });
    const plan = buildLaunchButtonPlan({ env, ship: true });

    expect(plan.ready).toBe(false);
    expect(plan.missing).toContain("MOBILE_PAYMENTS_ENABLED=true");
  });

  it("rejects ship mode when native paid reports are explicitly disabled", () => {
    const env = buildLaunchEnvironment({ fileEnv: { ...completeFileEnv, MOBILE_PAYMENTS_ENABLED: "false" }, env: {} });
    const plan = buildLaunchButtonPlan({ env, ship: true });

    expect(plan.ready).toBe(false);
    expect(plan.missing).toContain("MOBILE_PAYMENTS_ENABLED=true");
  });

  it("redacts secrets and webhook URLs from the public plan", () => {
    const env = buildLaunchEnvironment({
      fileEnv: { ...completeFileEnv, ...polarPaymentEnv },
      env: {
        PATH: "C:/local/bin",
        APPDATA: "C:/Users/USER/AppData/Roaming",
        LOCAL_ONLY_DEBUG_VALUE: "do-not-print"
      }
    });
    const report = createPublicLaunchReport(buildLaunchButtonPlan({ env, ship: true }));
    const serialized = JSON.stringify(report);

    expect(serialized).toContain("<redacted>");
    expect(serialized).not.toContain(liveTossClientKey);
    expect(serialized).not.toContain(liveTossSecretKey);
    expect(serialized).not.toContain("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(serialized).not.toContain("launch_pass");
    expect(serialized).not.toContain("report-token-secret-value-1234567890");
    expect(serialized).not.toContain("first-free-fingerprint-secret-value-1234567890");
    expect(serialized).not.toContain(polarPaymentEnv.POLAR_ACCESS_TOKEN);
    expect(serialized).not.toContain(polarPaymentEnv.POLAR_WEBHOOK_SECRET);
    expect(serialized).not.toContain("launch-secret-path");
    expect(serialized).not.toContain("not-a-real-app-store-key");
    expect(serialized).not.toContain("bm90LWEtcmVhbC1rZXlzdG9yZQ==");
    expect(serialized).not.toContain("not-a-real-keystore-password");
    expect(serialized).not.toContain("not-a-real-key-password");
    expect(serialized).not.toContain("C:/local/bin");
    expect(serialized).not.toContain("APPDATA");
    expect(serialized).not.toContain("LOCAL_ONLY_DEBUG_VALUE");
  });

  it("keeps derived public launch values visible in the dry-run report", () => {
    const env = buildLaunchEnvironment({ fileEnv: completeFileEnv, env: {} });
    const report = createPublicLaunchReport(buildLaunchButtonPlan({ env, ship: true }));
    const serialized = JSON.stringify(report);

    expect(serialized).toContain("https://id-doppelganger.apps.tossmini.com");
    expect(serialized).toContain("com.iddoppelganger.app");
    expect(serialized).toContain("detailed_report");
  });
});

describe("runLaunchButtonPlan", () => {
  it("runs steps in order with inherited launch environment", () => {
    const env = buildLaunchEnvironment({ fileEnv: completeFileEnv, env: {} });
    const plan = buildLaunchButtonPlan({ env, ship: false });
    const calls: string[] = [];
    const result = runLaunchButtonPlan(plan, {
      env: {},
      spawnSyncImpl: (command: string, args: string[], options: { env: Record<string, string> }) => {
        calls.push(`${command} ${args.join(" ")} ${options.env.SITE_URL}`);
        return { status: 0 };
      }
    });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(3);
    expect(calls.every((call) => call.includes("https://id.verified-domain.kr"))).toBe(true);
  });
});
