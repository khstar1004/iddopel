import { describe, expect, it } from "vitest";
import {
  createLaunchEnvStatus,
  isLaunchConsoleAvailable,
  isLaunchConsoleExecutionEnabled,
  launchConfirmPhrase,
  launchEnvFields,
  mergeLaunchEnvValues,
  parseLaunchConsoleOptions,
  renderLaunchEnvFile,
  sanitizeLaunchEnvUpdates,
  validateLaunchEnvValues
} from "./launch-console";

const tossSecretKey = ["TOSS", "SECRET", "KEY"].join("_");
const tossClientKey = ["TOSS", "CLIENT", "KEY"].join("_");
const tossSecurityKey = ["TOSS", "SECURITY", "KEY"].join("_");
const tossConsoleApiKey = ["TOSS", "CONSOLE", "API", "KEY"].join("_");
const cronSecretKey = ["CRON", "SECRET"].join("_");
const reportTokenSecretKey = ["REPORT", "TOKEN", "SECRET"].join("_");
const firstFreeFingerprintSecretKey = ["FIRST", "FREE", "FINGERPRINT", "SECRET"].join("_");
const applePrivateKey = ["APPLE", "PRIVATE", "KEY"].join("_");
const googlePlayServiceAccountJsonKey = ["GOOGLE", "PLAY", "SERVICE", "ACCOUNT", "JSON"].join("_");

describe("launch-console", () => {
  it("allows dry-run access only from loopback requests", () => {
    const localRequest = new Request("http://localhost:3000/api/dev/launch-button");
    const publicRequest = new Request("https://id.example.com/api/dev/launch-button");

    expect(isLaunchConsoleAvailable(localRequest, { NODE_ENV: "production" })).toBe(true);
    expect(isLaunchConsoleAvailable(publicRequest, { NODE_ENV: "development" })).toBe(false);
  });

  it("requires an explicit launch console flag before executing commands", () => {
    const request = new Request("http://127.0.0.1:3000/api/dev/launch-button");

    expect(isLaunchConsoleExecutionEnabled(request, { NODE_ENV: "development" })).toBe(false);
    expect(isLaunchConsoleExecutionEnabled(request, { NODE_ENV: "production", ENABLE_LAUNCH_CONSOLE: "true" })).toBe(true);
  });

  it("parses launch console booleans and confirmation phrase", () => {
    expect(
      parseLaunchConsoleOptions({
        ship: "true",
        localGate: "1",
        execute: true,
        confirm: launchConfirmPhrase
      })
    ).toEqual({
      ship: true,
      localGate: true,
      execute: true,
      saveEnv: false,
      confirm: launchConfirmPhrase
    });
  });

  it("keeps launch env writes on an allowlist and preserves existing values", () => {
    const updates = sanitizeLaunchEnvUpdates({
      PRODUCTION_DOMAIN: " id.example.com ",
      [tossSecretKey]: "placeholder-value",
      IGNORED_KEY: "do-not-write",
      ALERT_RUNBOOK_URL: ""
    });
    const merged = mergeLaunchEnvValues({ ALERT_RUNBOOK_URL: "https://docs.example.com/runbook" }, updates);

    expect(updates).toEqual({
      PRODUCTION_DOMAIN: "id.example.com",
      [tossSecretKey]: "placeholder-value"
    });
    expect(merged).toMatchObject({
      PRODUCTION_DOMAIN: "id.example.com",
      [tossSecretKey]: "placeholder-value",
      ALERT_RUNBOOK_URL: "https://docs.example.com/runbook"
    });
    expect(merged).not.toHaveProperty("IGNORED_KEY");
  });

  it("redacts sensitive launch env values from browser status", () => {
    const status = createLaunchEnvStatus({
      PRODUCTION_DOMAIN: "id.example.com",
      [tossClientKey]: "test_ck_123456789",
      [tossSecretKey]: "placeholder-value",
      [tossSecurityKey]: "a".repeat(64),
      [tossConsoleApiKey]: "console-api-key-value",
      [reportTokenSecretKey]: "report-token-secret-value-1234567890",
      [firstFreeFingerprintSecretKey]: "first-free-fingerprint-secret-1234567890"
    });

    expect(status.find((item) => item.key === "PRODUCTION_DOMAIN")).toMatchObject({
      configured: true,
      sensitive: false,
      value: "id.example.com"
    });
    expect(status.find((item) => item.key === tossSecretKey)).toMatchObject({
      configured: true,
      sensitive: true,
      value: ""
    });
    expect(status.find((item) => item.key === tossClientKey)).toMatchObject({
      configured: true,
      sensitive: true,
      value: ""
    });
    expect(status.find((item) => item.key === tossSecurityKey)).toMatchObject({
      configured: true,
      sensitive: true,
      value: ""
    });
    expect(status.find((item) => item.key === tossConsoleApiKey)).toMatchObject({
      configured: true,
      sensitive: true,
      value: ""
    });
    expect(status.find((item) => item.key === reportTokenSecretKey)).toMatchObject({
      configured: true,
      sensitive: true,
      value: ""
    });
    expect(status.find((item) => item.key === firstFreeFingerprintSecretKey)).toMatchObject({
      configured: true,
      sensitive: true,
      value: ""
    });
    expect(JSON.stringify(status)).not.toContain("test_ck_123456789");
    expect(JSON.stringify(status)).not.toContain("placeholder-value");
    expect(JSON.stringify(status)).not.toContain("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(JSON.stringify(status)).not.toContain("console-api-key-value");
    expect(JSON.stringify(status)).not.toContain("report-token-secret-value-1234567890");
    expect(JSON.stringify(status)).not.toContain("first-free-fingerprint-secret-1234567890");
  });

  it("renders launch env files with safe quoting", () => {
    const rendered = renderLaunchEnvFile({
      PRODUCTION_DOMAIN: "id.example.com",
      STORE_SUPPORT_EMAIL: "support@example.com",
      TOSS_REVIEW_SCENARIO: "Run scan #1"
    });

    expect(rendered).toContain("PRODUCTION_DOMAIN=id.example.com");
    expect(rendered).toContain('TOSS_REVIEW_SCENARIO="Run scan #1"');
    expect(rendered).toContain("STORE_SUPPORT_EMAIL=support@example.com");
  });

  it("supports long multiline store credentials without writing raw newlines into env values", () => {
    const rendered = renderLaunchEnvFile({
      [applePrivateKey]: "not-a-real-app-store-key-line-1\nnot-a-real-app-store-key-line-2",
      [googlePlayServiceAccountJsonKey]: JSON.stringify({ type: "service_account", private_key: "line-1\nline-2" })
    });

    expect(launchEnvFields.find((field) => field.key === applePrivateKey)).toMatchObject({ multiline: true });
    expect(launchEnvFields.find((field) => field.key === googlePlayServiceAccountJsonKey)).toMatchObject({ multiline: true });
    expect(rendered).toContain(`${applePrivateKey}="not-a-real-app-store-key-line-1\\nnot-a-real-app-store-key-line-2"`);
    expect(rendered).toContain(`${googlePlayServiceAccountJsonKey}="{\\"type\\":\\"service_account\\"`);
    expect(rendered).not.toContain("not-a-real-app-store-key-line-1\nnot-a-real-app-store-key-line-2");
  });

  it("validates configured launch env values before they can be saved", () => {
    const errors = validateLaunchEnvValues({
      PRODUCTION_DOMAIN: "localhost:3000",
      STORE_SUPPORT_EMAIL: "not-an-email",
      DATABASE_URL: "mysql://db.example.com/app",
      DATABASE_SSL: "maybe",
      [cronSecretKey]: "short",
      [reportTokenSecretKey]: "shared-secret-value-123456789012345",
      [firstFreeFingerprintSecretKey]: "shared-secret-value-123456789012345",
      [tossClientKey]: "wrong-client-key",
      [tossSecretKey]: "short",
      [tossSecurityKey]: "not-64-hex",
      [tossConsoleApiKey]: "short",
      TOSS_ALLOWED_ORIGINS: "https://bad.example.com",
      ALERT_WEBHOOK_URL: "http://hooks.example.com/launch",
      ALERT_WEBHOOK_PROVIDER: "pager",
      ALERT_RUNBOOK_URL: "https://localhost/runbook",
      MOBILE_PAYMENTS_ENABLED: "maybe",
      APPLE_BUNDLE_ID: "com.other.app",
      APPLE_DETAILED_REPORT_PRODUCT_ID: "invalid product",
      APPLE_ENVIRONMENT: "live",
      APPLE_KEY_ID: "ABC",
      APPLE_ISSUER_ID: "short",
      [applePrivateKey]: "too-short",
      APPLE_APP_APPLE_ID: "app-id",
      GOOGLE_PLAY_PACKAGE_NAME: "com.other.app",
      GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID: "invalid product",
      [googlePlayServiceAccountJsonKey]: "{not-json"
    });

    expect(errors).toMatchObject({
      PRODUCTION_DOMAIN: expect.stringContaining("실제 HTTPS 도메인"),
      STORE_SUPPORT_EMAIL: expect.stringContaining("이메일"),
      DATABASE_URL: expect.stringContaining("Postgres"),
      DATABASE_SSL: expect.stringContaining("true 또는 false"),
      [cronSecretKey]: expect.stringContaining("32자 이상"),
      [reportTokenSecretKey]: expect.stringContaining("서로 달라야"),
      [firstFreeFingerprintSecretKey]: expect.stringContaining("서로 달라야"),
      [tossClientKey]: expect.stringContaining("test_ck_ 또는 live_ck_"),
      [tossSecretKey]: expect.stringContaining("12자 이상"),
      [tossSecurityKey]: expect.stringContaining("64자 hex"),
      [tossConsoleApiKey]: expect.stringContaining("12자 이상"),
      TOSS_ALLOWED_ORIGINS: expect.stringContaining("공개 tossmini.com Origin"),
      ALERT_WEBHOOK_URL: expect.stringContaining("HTTPS"),
      ALERT_WEBHOOK_PROVIDER: expect.stringContaining("generic, slack, discord"),
      ALERT_RUNBOOK_URL: expect.stringContaining("HTTPS"),
      MOBILE_PAYMENTS_ENABLED: expect.stringContaining("true 또는 false"),
      APPLE_BUNDLE_ID: expect.stringContaining("com.iddoppelganger.app"),
      APPLE_DETAILED_REPORT_PRODUCT_ID: expect.stringContaining("영문, 숫자"),
      APPLE_ENVIRONMENT: expect.stringContaining("sandbox 또는 production"),
      APPLE_KEY_ID: expect.stringContaining("6자 이상"),
      APPLE_ISSUER_ID: expect.stringContaining("16자 이상"),
      [applePrivateKey]: expect.stringContaining("12자 이상"),
      APPLE_APP_APPLE_ID: expect.stringContaining("숫자"),
      GOOGLE_PLAY_PACKAGE_NAME: expect.stringContaining("com.iddoppelganger.app"),
      GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID: expect.stringContaining("영문, 숫자"),
      [googlePlayServiceAccountJsonKey]: expect.stringContaining("JSON")
    });
  });

  it("rejects placeholder-like launch env values before saving", () => {
    expect(
      validateLaunchEnvValues({
        PRODUCTION_DOMAIN: "id.example.com",
        STORE_SUPPORT_EMAIL: "support@example.com",
        ALERT_WEBHOOK_URL: "https://hooks.example.com/launch",
        ALERT_RUNBOOK_URL: "https://docs.example.com/runbook"
      })
    ).toMatchObject({
      PRODUCTION_DOMAIN: expect.stringContaining("실제 출시 값"),
      STORE_SUPPORT_EMAIL: expect.stringContaining("실제 출시 값"),
      ALERT_WEBHOOK_URL: expect.stringContaining("실제 출시 값"),
      ALERT_RUNBOOK_URL: expect.stringContaining("실제 출시 값")
    });
  });

  it("accepts valid production launch env values", () => {
    expect(
      validateLaunchEnvValues({
        PRODUCTION_DOMAIN: "id.verified-domain.kr",
        STORE_SUPPORT_EMAIL: "support@verified-domain.kr",
        DATABASE_URL: "postgres://db.verified-domain.kr:5432/id_doppelganger",
        DATABASE_SSL: "true",
        [cronSecretKey]: "launch-cron-secret-value-1234567890",
        [reportTokenSecretKey]: "launch-report-token-secret-value-1234567890",
        [firstFreeFingerprintSecretKey]: "launch-fingerprint-secret-value-1234567890",
        [tossClientKey]: "test_ck_123456789",
        [tossSecretKey]: "test_sk_123456789",
        [tossSecurityKey]: "a".repeat(64),
        [tossConsoleApiKey]: "toss-console-api-key-value",
        TOSS_ALLOWED_ORIGINS:
          "https://id-doppelganger.apps.tossmini.com,https://id-doppelganger.private-apps.tossmini.com",
        ALERT_WEBHOOK_URL: "https://hooks.verified-domain.kr/launch",
        ALERT_WEBHOOK_PROVIDER: "slack",
        ALERT_RUNBOOK_URL: "https://docs.verified-domain.kr/runbook",
        MOBILE_PAYMENTS_ENABLED: "true",
        APPLE_BUNDLE_ID: "com.iddoppelganger.app",
        APPLE_DETAILED_REPORT_PRODUCT_ID: "detailed_report",
        APPLE_ENVIRONMENT: "production",
        APPLE_KEY_ID: "ABC123DEFG",
        APPLE_ISSUER_ID: "00000000-0000-0000-0000-000000000000",
        [applePrivateKey]: "not-a-real-app-store-private-key",
        APPLE_APP_APPLE_ID: "1234567890",
        GOOGLE_PLAY_PACKAGE_NAME: "com.iddoppelganger.app",
        GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID: "detailed_report",
        [googlePlayServiceAccountJsonKey]: JSON.stringify({ type: "service_account" })
      })
    ).toEqual({});
  });

  it("includes the native paid-report switch in launch env fields", () => {
    expect(launchEnvFields.find((field) => field.key === "MOBILE_PAYMENTS_ENABLED")).toMatchObject({
      label: "네이티브 유료 리포트",
      placeholder: "true"
    });
    expect(launchEnvFields.find((field) => field.key === "APPLE_DETAILED_REPORT_PRODUCT_ID")).toMatchObject({
      label: "Apple 상세 리포트 상품 ID",
      placeholder: "detailed_report"
    });
    expect(launchEnvFields.find((field) => field.key === "GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID")).toMatchObject({
      label: "Google Play 상세 리포트 상품 ID",
      placeholder: "detailed_report"
    });
  });

  it("includes the Apps in Toss console API key as a sensitive launch field", () => {
    expect(launchEnvFields.find((field) => field.key === reportTokenSecretKey)).toMatchObject({
      label: "Report Token Secret",
      sensitive: true
    });
    expect(launchEnvFields.find((field) => field.key === firstFreeFingerprintSecretKey)).toMatchObject({
      label: "1회 무료 판정 Secret",
      sensitive: true
    });
    expect(launchEnvFields.find((field) => field.key === tossClientKey)).toMatchObject({
      label: "Toss Payments Client Key",
      sensitive: true
    });
    expect(launchEnvFields.find((field) => field.key === tossSecurityKey)).toMatchObject({
      label: "Toss Payments Security Key",
      sensitive: true
    });
    expect(launchEnvFields.find((field) => field.key === tossConsoleApiKey)).toMatchObject({
      label: "Toss Console API Key",
      sensitive: true
    });
    expect(launchEnvFields.find((field) => field.key === "TOSS_ALLOWED_ORIGINS")).toMatchObject({
      label: "Toss 허용 Origin",
      sensitive: false
    });
  });
});
