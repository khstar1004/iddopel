import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const requiredSecurityHeaders = [
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy"
];

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function isBoundedAlertTimeout(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 250 && parsed <= 5000;
}

function readEnv(envValues, name) {
  return String(envValues[name] ?? "").trim();
}

function hasPlaceholder(value = "") {
  return /YOUR_|your_|replace-with|placeholder|local-|example\.com|changeme/i.test(value);
}

function isStrongSecret(value) {
  return value.length >= 32 && !hasPlaceholder(value);
}

export async function createProductionConfigReport({ envValues = process.env, runRuntimeChecks: shouldRunRuntimeChecks = true } = {}) {
  const checks = [];
  const warnings = [];
  const addCheck = (name, ok, detail) => checks.push({ name, ok, detail });
  const addWarning = (name, detail) => warnings.push({ name, detail });
  const env = (name) => readEnv(envValues, name);
  const siteUrl = env("SITE_URL");
  const runtimeBaseUrl = env("PRODUCTION_BASE_URL").replace(/\/$/, "");
  const paymentProvider = env("PAYMENT_PROVIDER");

  addCheck("DATABASE_URL is production Postgres", /^postgres(?:ql)?:\/\//.test(env("DATABASE_URL")), "Set DATABASE_URL to managed Postgres.");
  addCheck("DATABASE_SSL is explicit", ["true", "false"].includes(env("DATABASE_SSL")), "Set DATABASE_SSL=true if the provider requires TLS verification.");
  addCheck("CRON_SECRET is strong", isStrongSecret(env("CRON_SECRET")), "Use at least 32 random characters.");
  addCheck("REPORT_TOKEN_SECRET is strong", isStrongSecret(env("REPORT_TOKEN_SECRET")), "Use at least 32 random characters for detailed-report access tokens.");
  addCheck(
    "FIRST_FREE_FINGERPRINT_SECRET is strong",
    isStrongSecret(env("FIRST_FREE_FINGERPRINT_SECRET")),
    "Use at least 32 random characters for one-time free report fingerprints."
  );
  addCheck(
    "Report and fingerprint secrets are isolated",
    Boolean(env("REPORT_TOKEN_SECRET")) && env("REPORT_TOKEN_SECRET") !== env("FIRST_FREE_FINGERPRINT_SECRET"),
    "Use different secrets for report tokens and free-use fingerprints."
  );
  addCheck("SITE_URL is HTTPS production origin", isHttpsUrl(siteUrl), "Use the deployed HTTPS origin, without a trailing slash.");
  addCheck("SCAN_PROVIDER requires Maigret", env("SCAN_PROVIDER") === "maigret", "Set SCAN_PROVIDER=maigret for real username scanning.");
  addCheck("PAYMENT_PROVIDER is a live checkout provider", ["toss", "polar"].includes(paymentProvider), "Set PAYMENT_PROVIDER=toss or PAYMENT_PROVIDER=polar before live web checkout.");
  addCheck("Mock payments disabled", env("ENABLE_MOCK_PAYMENTS") !== "true", "Set ENABLE_MOCK_PAYMENTS=false in production.");
  addCheck("Web detailed report paywall enabled", env("WEB_DETAILED_REPORT_PAYWALL_ENABLED") === "true", "Set WEB_DETAILED_REPORT_PAYWALL_ENABLED=true so detailed reports require checkout.");
  addCheck("Monthly monitoring paywall enabled", env("MONITORING_PAYWALL_ENABLED") === "true", "Set MONITORING_PAYWALL_ENABLED=true so monthly monitoring requires checkout.");
  if (paymentProvider === "toss") {
    addCheck("Toss client key is configured", /^test_ck_|^live_ck_/.test(env("TOSS_CLIENT_KEY")), "Set the Toss Payments client key in the deployment secret manager.");
    addCheck("Toss secret is configured", env("TOSS_SECRET_KEY").length >= 12, "Set a Toss Payments secret key in the deployment secret manager.");
    addCheck("Toss security key is configured", /^[a-f0-9]{64}$/i.test(env("TOSS_SECURITY_KEY")), "Set the Toss Payments security key in the deployment secret manager.");
  }
  if (paymentProvider === "polar") {
    addCheck("Polar access token is configured", env("POLAR_ACCESS_TOKEN").length >= 12 && !hasPlaceholder(env("POLAR_ACCESS_TOKEN")), "Set POLAR_ACCESS_TOKEN in the deployment secret manager.");
    addCheck("Polar product id is configured", env("POLAR_PRODUCT_ID").length > 0 && !hasPlaceholder(env("POLAR_PRODUCT_ID")), "Set POLAR_PRODUCT_ID to the detailed-report product.");
    addCheck(
      "Polar monthly monitoring product id is configured",
      env("POLAR_MONTHLY_MONITORING_PRODUCT_ID").length > 0 && !hasPlaceholder(env("POLAR_MONTHLY_MONITORING_PRODUCT_ID")),
      "Set POLAR_MONTHLY_MONITORING_PRODUCT_ID to the monthly-monitoring product."
    );
    addCheck("Polar webhook secret is strong", isStrongSecret(env("POLAR_WEBHOOK_SECRET")), "Set POLAR_WEBHOOK_SECRET to a random 32+ character webhook secret.");
    addCheck("Polar server is production", env("POLAR_SERVER") !== "sandbox", "Use POLAR_SERVER=production or leave it unset for production checkout.");
  }
  addCheck("Telemetry enabled", env("TELEMETRY_DISABLED") !== "true", "Keep TELEMETRY_DISABLED unset or false for launch monitoring.");
  addCheck("Alert webhook is HTTPS", isHttpsUrl(env("ALERT_WEBHOOK_URL")), "Set ALERT_WEBHOOK_URL to the launch alert channel webhook.");
  addCheck("Alert provider is supported", ["generic", "slack", "discord"].includes(env("ALERT_WEBHOOK_PROVIDER")), "Set ALERT_WEBHOOK_PROVIDER=generic, slack, or discord.");
  addCheck("Alert timeout is bounded", isBoundedAlertTimeout(env("ALERT_WEBHOOK_TIMEOUT_MS")), "Set ALERT_WEBHOOK_TIMEOUT_MS between 250 and 5000.");
  addCheck("Alert runbook URL is HTTPS", isHttpsUrl(env("ALERT_RUNBOOK_URL")), "Set ALERT_RUNBOOK_URL to an HTTPS incident runbook.");
  addCheck("Mobile app origin matches production", env("MOBILE_APP_ORIGIN") === siteUrl, "Run MOBILE_APP_ORIGIN=$SITE_URL npm run mobile:configure before native release.");

  if (env("ENABLE_DEV_ADMIN") === "true") {
    addCheck("Public admin password is configured", env("DEV_ADMIN_PASSWORD").length >= 12 && !hasPlaceholder(env("DEV_ADMIN_PASSWORD")), "Use a non-placeholder admin password before enabling public /admin.");
    addCheck("Public admin signing secret is strong", isStrongSecret(env("DEV_ADMIN_SECRET")), "Use at least 32 random characters for public admin sessions.");
  }

  if (env("MOBILE_PAYMENTS_ENABLED") === "true") {
    addCheck("Apple bundle id configured", env("APPLE_BUNDLE_ID") === "com.iddoppelganger.app", "Use the App Store bundle id.");
    addCheck("Apple product id configured", env("APPLE_DETAILED_REPORT_PRODUCT_ID").length > 0, "Create the matching App Store IAP product.");
    addCheck("Apple server API key configured", env("APPLE_KEY_ID").length > 0 && env("APPLE_ISSUER_ID").length > 0 && env("APPLE_PRIVATE_KEY").length > 0, "Set App Store Server API credentials.");
    addCheck("Google package configured", env("GOOGLE_PLAY_PACKAGE_NAME") === "com.iddoppelganger.app", "Use the Play Console package name.");
    addCheck("Google product id configured", env("GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID").length > 0, "Create the matching Play Billing product.");
    addCheck("Google service account configured", env("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON").length > 0, "Set Android Publisher API service account JSON.");

    if (env("APPLE_ENVIRONMENT") !== "production") {
      addWarning("APPLE_ENVIRONMENT", "Use sandbox for TestFlight verification and production for App Store live verification.");
    }
  } else {
    addWarning("MOBILE_PAYMENTS_ENABLED", "Native paid reports stay disabled until Apple/Google in-app products and receipt verification secrets are live.");
  }

  if (shouldRunRuntimeChecks && isHttpsUrl(runtimeBaseUrl)) {
    await runRuntimeChecks(runtimeBaseUrl, env("CRON_SECRET"), addCheck);
  } else {
    addWarning("Runtime checks skipped", "Set PRODUCTION_BASE_URL to the deployed HTTPS origin to verify headers, health, telemetry, and cron.");
  }

  const failed = checks.filter((check) => !check.ok);
  const report = {
    ok: failed.length === 0,
    failed: failed.length,
    warnings: warnings.length,
    checks,
    warnings
  };

  return report;
}

async function runRuntimeChecks(baseUrl, cronSecret, addCheck) {
  const home = await request(baseUrl, "/");
  addCheck("Production home returns 200", home.status === 200, `${baseUrl}/ returned ${home.status}.`);
  for (const header of requiredSecurityHeaders) {
    addCheck(`Security header ${header}`, home.headers.has(header), `Missing ${header} on ${baseUrl}/.`);
  }

  const health = await requestJson(baseUrl, "/api/health");
  addCheck("Production health endpoint ok", health.status === 200 && health.body?.ok === true, "Expected /api/health to return ok=true.");

  const telemetry = await requestJson(baseUrl, "/api/telemetry", {
    method: "POST",
    body: {
      name: "page_view",
      path: "/production-readiness",
      occurredAt: new Date().toISOString()
    }
  });
  addCheck("Telemetry endpoint accepts launch probe", telemetry.status === 202 && telemetry.body?.ok === true, "Expected /api/telemetry to return 202.");

  if (cronSecret) {
    const cron = await requestJson(baseUrl, "/api/cron/prune", {
      headers: { Authorization: `Bearer ${cronSecret}` }
    });
    addCheck("Cron prune endpoint authorized", cron.status === 200 && cron.body?.ok === true, "Expected /api/cron/prune to authorize CRON_SECRET.");

    const monitoringCron = await requestJson(baseUrl, "/api/cron/monitoring", {
      headers: { Authorization: `Bearer ${cronSecret}` }
    });
    addCheck(
      "Cron monitoring endpoint authorized",
      [200, 207].includes(monitoringCron.status) && typeof monitoringCron.body?.checked === "number",
      "Expected /api/cron/monitoring to authorize CRON_SECRET and return monitoring counts."
    );
  }
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await request(baseUrl, path, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, headers: response.headers, body };
}

async function request(baseUrl, path, options = {}) {
  const body = options.body ? JSON.stringify(options.body) : undefined;
  return fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {})
    },
    body
  });
}

async function main() {
  const report = await createProductionConfigReport();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

function isMainModule() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
