import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const releaseCheck = process.env.DEPLOY_RELEASE_CHECK === "true";
const envPath = resolve(process.env.DEPLOY_ENV_FILE || (releaseCheck ? "deploy/compose/.env" : "deploy/compose/.env.example"));
const composePath = resolve("deploy/compose/compose.yaml");
const caddyPath = resolve("deploy/compose/Caddyfile");

const checks = [];
const warnings = [];

function addCheck(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function addWarning(name, detail) {
  warnings.push({ name, detail });
}

async function main() {
  await requiredFile("deploy/compose/compose.yaml");
  await requiredFile("deploy/compose/Caddyfile");
  await requiredFile("deploy/compose/.env.example");
  await requiredFile("deploy/compose/README.md");

  const compose = await readFile(composePath, "utf-8");
  const caddy = await readFile(caddyPath, "utf-8");
  validateComposeSource(compose);
  validateCaddyfile(caddy);

  const envValues = await readEnvFile(envPath);
  validateEnvShape(envValues);
  validateDockerComposeConfig();

  const failed = checks.filter((check) => !check.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, failed: failed.length, warningCount: warnings.length, checks, warnings }, null, 2));
  if (failed.length > 0) process.exit(1);
}

async function requiredFile(path) {
  try {
    await access(path);
    addCheck(`Required file ${path}`, true, path);
  } catch {
    addCheck(`Required file ${path}`, false, `${path} is missing.`);
  }
}

async function readEnvFile(path) {
  try {
    const contents = await readFile(path, "utf-8");
    return parseEnv(contents);
  } catch (error) {
    addCheck("Deploy env file exists", false, `Expected ${path}. ${error instanceof Error ? error.message : error}`);
    return {};
  }
}

function parseEnv(contents) {
  const values = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals === -1) continue;
    const name = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[name] = value;
  }
  return values;
}

function validateComposeSource(compose) {
  for (const service of ["postgres:", "migrate:", "app:", "caddy:", "prune:", "monitoring-cron:"]) {
    addCheck(`Compose includes ${service}`, compose.includes(service), `deploy/compose/compose.yaml must include ${service}`);
  }

  addCheck("Compose waits for Postgres health", compose.includes("condition: service_healthy"), "Use a Postgres healthcheck before migration/app startup.");
  addCheck("Compose waits for migrations", compose.includes("condition: service_completed_successfully"), "App should wait for the migrate service to finish successfully.");
  addCheck("Compose uses production scanner default", compose.includes("SCAN_PROVIDER: \"${SCAN_PROVIDER:-maigret}\""), "Default SCAN_PROVIDER should be maigret.");
  addCheck("Compose keeps mock payments disabled by default", compose.includes("ENABLE_MOCK_PAYMENTS: \"${ENABLE_MOCK_PAYMENTS:-false}\""), "Mock payments must be disabled by default.");
  addCheck("Compose passes web paywall switches", compose.includes("WEB_DETAILED_REPORT_PAYWALL_ENABLED") && compose.includes("MONITORING_PAYWALL_ENABLED"), "App service must receive web paywall switches.");
  addCheck("Compose passes report access secrets", compose.includes("REPORT_TOKEN_SECRET") && compose.includes("FIRST_FREE_FINGERPRINT_SECRET"), "App service must receive report token and first-free fingerprint secrets.");
  addCheck(
    "Compose passes live checkout env",
    compose.includes("TOSS_CLIENT_KEY") &&
      compose.includes("POLAR_ACCESS_TOKEN") &&
      compose.includes("POLAR_MONTHLY_MONITORING_PRODUCT_ID") &&
      compose.includes("NEXT_PUBLIC_PORTONE_STORE_ID") &&
      compose.includes("NEXT_PUBLIC_PORTONE_CHANNEL_KEY") &&
      compose.includes("PORTONE_API_SECRET"),
    "App service must receive Toss, Polar, and PortOne checkout settings."
  );
  addCheck("Compose passes Toss mini-app env", compose.includes("TOSS_MINI_APP_NAME") && compose.includes("TOSS_ALLOWED_ORIGINS"), "App service must receive Toss mini-app Origin settings.");
  addCheck("Compose passes alert webhook env", compose.includes("ALERT_WEBHOOK_URL") && compose.includes("ALERT_RUNBOOK_URL"), "App service must receive alert webhook settings.");
  addCheck("Compose exposes only Caddy ports", compose.includes("443:443") && !compose.includes("3000:3000"), "Only Caddy should bind public ports in production.");
}

function validateCaddyfile(caddy) {
  addCheck("Caddyfile uses DOMAIN env", caddy.includes("{$DOMAIN}"), "Caddy should get its public site address from DOMAIN.");
  addCheck("Caddyfile proxies to app service", caddy.includes("reverse_proxy app:3000"), "Caddy should proxy to the internal app service.");
  addCheck("Caddyfile enables compression", caddy.includes("encode zstd gzip"), "Caddy should compress proxied responses.");
}

function validateEnvShape(values) {
  const requiredKeys = [
    "DOMAIN",
    "SITE_URL",
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "APP_IMAGE",
    "CRON_SECRET",
    "REPORT_TOKEN_SECRET",
    "FIRST_FREE_FINGERPRINT_SECRET",
    "MONITORING_CRON_LIMIT",
    "SCAN_PROVIDER",
    "PAYMENT_PROVIDER",
    "ENABLE_MOCK_PAYMENTS",
    "WEB_DETAILED_REPORT_PAYWALL_ENABLED",
    "MONITORING_PAYWALL_ENABLED",
    "TOSS_CONSOLE_APP_ID",
    "TOSS_MINI_APP_NAME",
    "TOSS_ALLOWED_ORIGINS",
    "TOSS_REVIEW_TEST_USERNAME",
    "TOSS_REVIEW_SCENARIO",
    "TELEMETRY_DISABLED",
    "NEXT_PUBLIC_TELEMETRY_DISABLED",
    "ALERT_WEBHOOK_URL",
    "ALERT_WEBHOOK_PROVIDER",
    "ALERT_WEBHOOK_TIMEOUT_MS",
    "ALERT_RUNBOOK_URL",
    "MOBILE_APP_ORIGIN",
    "MOBILE_PAYMENTS_ENABLED"
  ];

  for (const key of requiredKeys) {
    addCheck(`Deploy env ${key}`, Boolean(values[key]), `${key} must be set in ${envPath}.`);
  }

  for (const key of [
    "TOSS_CLIENT_KEY",
    "TOSS_SECRET_KEY",
    "TOSS_SECURITY_KEY",
    "POLAR_ACCESS_TOKEN",
    "POLAR_PRODUCT_ID",
    "POLAR_MONTHLY_MONITORING_PRODUCT_ID",
    "POLAR_WEBHOOK_SECRET",
    "POLAR_SERVER",
    "NEXT_PUBLIC_PORTONE_STORE_ID",
    "NEXT_PUBLIC_PORTONE_CHANNEL_KEY",
    "PORTONE_API_SECRET"
  ]) {
    addCheck(`Deploy env declares ${key}`, hasEnvKey(values, key), `${key} must be declared in ${envPath}.`);
  }

  const paymentProvider = String(values.PAYMENT_PROVIDER || "").trim();
  addCheck("Deploy env defaults to Maigret", values.SCAN_PROVIDER === "maigret", "SCAN_PROVIDER should be maigret in production Compose.");
  addCheck("Deploy env uses live checkout provider", ["toss", "polar", "portone"].includes(paymentProvider), "PAYMENT_PROVIDER should be toss, polar, or portone in production Compose.");
  addCheck("Deploy env disables mock payments", values.ENABLE_MOCK_PAYMENTS === "false", "ENABLE_MOCK_PAYMENTS must be false.");
  addCheck("Postgres password is URL-safe", /^[A-Za-z0-9._~-]+$/.test(values.POSTGRES_PASSWORD ?? ""), "Use URL-safe characters because the password is interpolated into DATABASE_URL.");

  if (releaseCheck) {
    addCheck("Deploy DOMAIN finalized", isFinalDomain(values.DOMAIN), "DOMAIN must be a real production hostname.");
    addCheck("Deploy SITE_URL finalized", isHttpsUrl(values.SITE_URL) && !hasPlaceholder(values.SITE_URL), "SITE_URL must be the production HTTPS origin.");
    addCheck("Mobile origin matches SITE_URL", values.MOBILE_APP_ORIGIN === values.SITE_URL, "MOBILE_APP_ORIGIN should match SITE_URL for release.");
    addCheck("CRON_SECRET is strong", (values.CRON_SECRET ?? "").length >= 32 && !hasPlaceholder(values.CRON_SECRET), "Use at least 32 random characters.");
    addCheck("REPORT_TOKEN_SECRET is strong", isStrongSecret(values.REPORT_TOKEN_SECRET), "Use at least 32 random characters for report access tokens.");
    addCheck("FIRST_FREE_FINGERPRINT_SECRET is strong", isStrongSecret(values.FIRST_FREE_FINGERPRINT_SECRET), "Use at least 32 random characters for one-time free report fingerprints.");
    addCheck(
      "Report secrets are isolated",
      values.REPORT_TOKEN_SECRET !== values.FIRST_FREE_FINGERPRINT_SECRET,
      "Use different secrets for report tokens and first-free fingerprints."
    );
    addCheck("Postgres password is strong", (values.POSTGRES_PASSWORD ?? "").length >= 24 && !hasPlaceholder(values.POSTGRES_PASSWORD), "Use a strong random Postgres password.");
    if (paymentProvider === "toss") {
      addCheck("Toss live client key configured", isLiveTossClientKey(values.TOSS_CLIENT_KEY), "Set the live Toss Payments client key.");
      addCheck("Toss live secret configured", isLiveTossSecretKey(values.TOSS_SECRET_KEY), "Set the live Toss Payments secret key.");
      addCheck("Toss security key configured", /^[a-f0-9]{64}$/i.test(values.TOSS_SECURITY_KEY ?? ""), "Set the 64-character Toss Payments security key.");
    }
    if (paymentProvider === "polar") {
      addCheck("Polar access token configured", (values.POLAR_ACCESS_TOKEN ?? "").length >= 12 && !hasPlaceholder(values.POLAR_ACCESS_TOKEN), "Set the Polar access token.");
      addCheck("Polar product id configured", (values.POLAR_PRODUCT_ID ?? "").length > 0 && !hasPlaceholder(values.POLAR_PRODUCT_ID), "Set the Polar detailed-report product id.");
      addCheck(
        "Polar monthly monitoring product id configured",
        (values.POLAR_MONTHLY_MONITORING_PRODUCT_ID ?? "").length > 0 && !hasPlaceholder(values.POLAR_MONTHLY_MONITORING_PRODUCT_ID),
        "Set the Polar monthly-monitoring product id."
      );
      addCheck("Polar webhook secret is strong", isStrongSecret(values.POLAR_WEBHOOK_SECRET), "Set a 32+ character Polar webhook secret.");
      addCheck("Polar server is production", values.POLAR_SERVER !== "sandbox", "Use POLAR_SERVER=production or leave it unset for production checkout.");
    }
    if (paymentProvider === "portone") {
      addCheck("PortOne store id configured", /^store-[0-9a-f-]{36}$/i.test(values.NEXT_PUBLIC_PORTONE_STORE_ID ?? ""), "Set the PortOne V2 store id.");
      addCheck("PortOne channel key configured", (values.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? "").length >= 12 && !hasPlaceholder(values.NEXT_PUBLIC_PORTONE_CHANNEL_KEY), "Set the PortOne payment channel key.");
      addCheck("PortOne API secret configured", (values.PORTONE_API_SECRET ?? "").length >= 12 && !hasPlaceholder(values.PORTONE_API_SECRET), "Set the PortOne V2 API secret.");
    }
    addCheck("Toss console app id configured", (values.TOSS_CONSOLE_APP_ID ?? "").length > 0 && !hasPlaceholder(values.TOSS_CONSOLE_APP_ID), "Set the Apps in Toss console app id.");
    addCheck("Toss mini app name finalized", /^[a-z0-9-]+$/.test(values.TOSS_MINI_APP_NAME ?? "") && !hasPlaceholder(values.TOSS_MINI_APP_NAME), "Set the Apps in Toss mini app name.");
    addCheck("Toss allowed origins finalized", hasFinalTossOrigins(values.TOSS_ALLOWED_ORIGINS), "Set live and private tossmini.com Origins.");
    addCheck("Toss review scenario configured", (values.TOSS_REVIEW_SCENARIO ?? "").length >= 12 && !hasPlaceholder(values.TOSS_REVIEW_SCENARIO), "Document the Toss review scenario.");
    addCheck("Alert webhook finalized", isHttpsUrl(values.ALERT_WEBHOOK_URL) && !hasPlaceholder(values.ALERT_WEBHOOK_URL), "Set the production alert channel webhook.");
    addCheck("Alert provider supported", ["generic", "slack", "discord"].includes(values.ALERT_WEBHOOK_PROVIDER), "Use generic, slack, or discord.");
    addCheck("Alert runbook finalized", isHttpsUrl(values.ALERT_RUNBOOK_URL) && !hasPlaceholder(values.ALERT_RUNBOOK_URL), "Set an HTTPS alert runbook URL.");
  } else {
    if (hasPlaceholder(values.DOMAIN) || hasPlaceholder(values.SITE_URL)) {
      addWarning("Production domain placeholder", "Replace DOMAIN and SITE_URL in deploy/compose/.env before deployment.");
    }
    if (
      hasPlaceholder(values.CRON_SECRET) ||
      hasPlaceholder(values.REPORT_TOKEN_SECRET) ||
      hasPlaceholder(values.FIRST_FREE_FINGERPRINT_SECRET) ||
      hasPlaceholder(values.TOSS_CLIENT_KEY) ||
      hasPlaceholder(values.TOSS_SECRET_KEY) ||
      hasPlaceholder(values.TOSS_SECURITY_KEY) ||
      hasPlaceholder(values.POLAR_ACCESS_TOKEN) ||
      hasPlaceholder(values.POLAR_PRODUCT_ID) ||
      hasPlaceholder(values.POLAR_MONTHLY_MONITORING_PRODUCT_ID) ||
      hasPlaceholder(values.POLAR_WEBHOOK_SECRET) ||
      hasPlaceholder(values.NEXT_PUBLIC_PORTONE_STORE_ID) ||
      hasPlaceholder(values.NEXT_PUBLIC_PORTONE_CHANNEL_KEY) ||
      hasPlaceholder(values.PORTONE_API_SECRET)
    ) {
      addWarning("Production secret placeholder", "Replace CRON_SECRET, report secrets, and checkout provider keys in deploy/compose/.env before deployment.");
    }
    if (hasPlaceholder(values.TOSS_CONSOLE_APP_ID) || hasPlaceholder(values.TOSS_MINI_APP_NAME) || hasPlaceholder(values.TOSS_ALLOWED_ORIGINS)) {
      addWarning("Toss mini-app placeholder", "Replace Toss console and tossmini.com Origin placeholders before Toss submission.");
    }
    if (hasPlaceholder(values.ALERT_WEBHOOK_URL) || hasPlaceholder(values.ALERT_RUNBOOK_URL)) {
      addWarning("Alert routing placeholder", "Replace ALERT_WEBHOOK_URL and ALERT_RUNBOOK_URL before production launch.");
    }
  }
}

function validateDockerComposeConfig() {
  const version = spawnSync("docker", ["compose", "version"], { encoding: "utf-8" });
  if (version.status !== 0) {
    const detail = "Docker Compose is required to validate deploy/compose/compose.yaml.";
    if (releaseCheck) {
      addCheck("Docker Compose available", false, detail);
    } else {
      addWarning("Docker Compose unavailable", detail);
    }
    return;
  }

  addCheck("Docker Compose available", true, version.stdout.trim() || "docker compose version");

  const config = spawnSync(
    "docker",
    ["compose", "--env-file", envPath, "-f", composePath, "config", "--quiet"],
    { encoding: "utf-8" }
  );

  addCheck(
    "Docker Compose config validates",
    config.status === 0,
    (config.stderr || config.stdout || "docker compose config --quiet passed").trim()
  );
}

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function isFinalDomain(value) {
  return Boolean(value) && !hasPlaceholder(value) && !value.includes("localhost") && value.includes(".");
}

function hasPlaceholder(value = "") {
  return /YOUR_|your_|replace-with|placeholder|local-|example/i.test(value);
}

function hasEnvKey(values, key) {
  return Object.prototype.hasOwnProperty.call(values, key);
}

function isStrongSecret(value = "") {
  return value.length >= 32 && !hasPlaceholder(value);
}

function isLiveTossClientKey(value = "") {
  return /^live_ck_/.test(value) && !hasPlaceholder(value);
}

function isLiveTossSecretKey(value = "") {
  return /^live_sk_/.test(value) && !hasPlaceholder(value);
}

function hasFinalTossOrigins(value = "") {
  if (hasPlaceholder(value)) return false;
  const origins = value.split(",").map((origin) => origin.trim());
  return origins.some((origin) => /\.apps\.tossmini\.com$/.test(hostname(origin))) &&
    origins.some((origin) => /\.private-apps\.tossmini\.com$/.test(hostname(origin)));
}

function hostname(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
