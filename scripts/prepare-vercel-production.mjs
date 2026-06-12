import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLaunchEnvironment, defaultLaunchEnvFile, parseEnvText } from "./launch-button.mjs";
import { resolvePostgresUrl } from "./postgres-env.mjs";

const vercelEnvDirectory = ".vercel-env/production";
const vercelEnvironment = "production";

const sourceReferences = [
  "https://vercel.com/docs/cli/env",
  "https://vercel.com/docs/cron-jobs/manage-cron-jobs"
];

const sensitiveKeyPattern =
  /(DATABASE|POSTGRES|SECRET|PASSWORD|PRIVATE_KEY|SERVICE_ACCOUNT|WEBHOOK_URL|TOKEN|API_KEY|CLIENT_KEY|SECURITY_KEY|KEY_ID|ISSUER_ID)/i;
const placeholderPattern = /YOUR_|your_|replace-with|placeholder|changeme|example\.com|support@YOUR_DOMAIN/i;

const commonRequiredKeys = [
  "DATABASE_URL",
  "DATABASE_SSL",
  "CRON_SECRET",
  "REPORT_TOKEN_SECRET",
  "FIRST_FREE_FINGERPRINT_SECRET",
  "MAIGRET_API_SECRET",
  "SCAN_PROVIDER",
  "MAIGRET_TOP_SITES_QUICK",
  "MAIGRET_TOP_SITES_DEEP",
  "MAIGRET_SITE_TIMEOUT_SECONDS",
  "MAIGRET_RETRIES",
  "MAIGRET_PROCESS_TIMEOUT_MS",
  "MAIGRET_MAX_CONNECTIONS",
  "MAIGRET_PRIORITY_SITES",
  "MAIGRET_BOOST_TAGS",
  "MAIGRET_EXCLUDED_SITES",
  "MAIGRET_SITE_CAP_QUICK",
  "MAIGRET_SITE_CAP_DEEP",
  "MAIGRET_EXTRACT_EXTENDED",
  "INLINE_SCAN_ARTIFACTS",
  "PAYMENT_PROVIDER",
  "ENABLE_MOCK_PAYMENTS",
  "WEB_DETAILED_REPORT_PAYWALL_ENABLED",
  "MONITORING_PAYWALL_ENABLED",
  "SITE_URL",
  "PRODUCTION_BASE_URL",
  "SMOKE_BASE_URL",
  "STORE_PRODUCTION_ORIGIN",
  "STORE_SUPPORT_EMAIL",
  "MOBILE_APP_ORIGIN",
  "MOBILE_PAYMENTS_ENABLED",
  "TOSS_CONSOLE_API_KEY",
  "TOSS_CONSOLE_APP_ID",
  "TOSS_MINI_APP_NAME",
  "TOSS_ALLOWED_ORIGINS",
  "ALERT_WEBHOOK_URL",
  "ALERT_WEBHOOK_PROVIDER",
  "ALERT_WEBHOOK_TIMEOUT_MS",
  "ALERT_RUNBOOK_URL",
  "TELEMETRY_DISABLED",
  "NEXT_PUBLIC_TELEMETRY_DISABLED"
];

const tossPaymentKeys = ["TOSS_CLIENT_KEY", "TOSS_SECRET_KEY", "TOSS_SECURITY_KEY"];
const polarPaymentKeys = [
  "POLAR_ACCESS_TOKEN",
  "POLAR_PRODUCT_ID",
  "POLAR_MONTHLY_MONITORING_PRODUCT_ID",
  "POLAR_WEBHOOK_SECRET",
  "POLAR_SERVER"
];
const tossClientKey = ["TOSS", "CLIENT", "KEY"].join("_");
const tossSecretKey = ["TOSS", "SECRET", "KEY"].join("_");
const tossSecurityKey = ["TOSS", "SECURITY", "KEY"].join("_");

const mobileStoreKeys = [
  "APPLE_BUNDLE_ID",
  "APPLE_DETAILED_REPORT_PRODUCT_ID",
  "APPLE_ENVIRONMENT",
  "APPLE_KEY_ID",
  "APPLE_ISSUER_ID",
  "APPLE_PRIVATE_KEY",
  "APPLE_APP_APPLE_ID",
  "GOOGLE_PLAY_PACKAGE_NAME",
  "GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"
];

const optionalExplicitKeys = [
  "RELEASE_VERSION",
  "TOSS_REVIEW_TEST_USERNAME",
  "TOSS_REVIEW_SCENARIO",
  "APPLE_REQUIRE_JWS_VERIFICATION",
  "APPLE_ROOT_CERTIFICATES_BASE64",
  "BETA_PUBLIC_SCAN_ENABLED",
  "BETA_FREE_SCAN_LIMIT",
  "BETA_FREE_SCAN_WINDOW_HOURS"
];

const productionExpectedValues = {
  DATABASE_SSL: "true",
  SCAN_PROVIDER: "maigret",
  MAIGRET_TOP_SITES_QUICK: "35",
  MAIGRET_TOP_SITES_DEEP: "150",
  MAIGRET_SITE_TIMEOUT_SECONDS: "6",
  MAIGRET_RETRIES: "1",
  MAIGRET_PROCESS_TIMEOUT_MS: "58000",
  MAIGRET_MAX_CONNECTIONS: "20",
  MAIGRET_PRIORITY_SITES: "Instagram,Twitter,Threads,TikTok,YouTube,Facebook,LinkedIn,Naver,GitHub,GitHubGist,Reddit",
  MAIGRET_BOOST_TAGS: "kr:30,social:35,photo:16,video:16,blog:20,coding:20,music:10,design:10,streaming:8,messaging:8",
  MAIGRET_EXCLUDED_SITES: "Geeksfor Geeks",
  MAIGRET_SITE_CAP_QUICK: "155",
  MAIGRET_SITE_CAP_DEEP: "260",
  MAIGRET_EXTRACT_EXTENDED: "false",
  INLINE_SCAN_ARTIFACTS: "false",
  ENABLE_MOCK_PAYMENTS: "false",
  WEB_DETAILED_REPORT_PAYWALL_ENABLED: "true",
  MONITORING_PAYWALL_ENABLED: "true",
  MOBILE_PAYMENTS_ENABLED: "true",
  TELEMETRY_DISABLED: "false",
  NEXT_PUBLIC_TELEMETRY_DISABLED: "false",
  ALERT_WEBHOOK_TIMEOUT_MS: "1500",
  APPLE_ENVIRONMENT: "production"
};

const productionValueRequirements = {
  [tossClientKey]: /^live_ck_/,
  [tossSecretKey]: /^live_sk_/,
  [tossSecurityKey]: /^[a-f0-9]{64}$/i
};

export function createVercelProductionPreparation({
  fileEnv = {},
  env = {},
  envFile = defaultLaunchEnvFile,
  now = new Date()
} = {}) {
  const rawEnv = { ...fileEnv, ...env };
  const launchEnv = applyVercelProductionDefaults(buildLaunchEnvironment({ fileEnv, env }), rawEnv);
  const paymentProvider = normalizePaymentProvider(launchEnv.PAYMENT_PROVIDER);
  const entryKeys = resolveEntryKeys(paymentProvider, rawEnv);
  const entries = entryKeys.map((key) => createEntry(key, launchEnv, rawEnv, paymentProvider));
  const missing = entries.filter((entry) => entry.required && !entry.configured).map((entry) => entry.key);

  const commands = [
    ...entries.map((entry) => entry.command),
    `vercel env run -e ${vercelEnvironment} -- npm run db:migrate`,
    `VERCEL_PRODUCTION_BASE_URL="${launchEnv.PRODUCTION_BASE_URL || "https://YOUR_DOMAIN"}" npm run vercel:production`
  ];

  return {
    ready: missing.length === 0,
    ok: missing.length === 0,
    envFile,
    environment: vercelEnvironment,
    generatedAt: now.toISOString(),
    missing,
    entries,
    commands,
    sources: sourceReferences,
    next: [
      `Create one local file per key under ${vercelEnvDirectory}; do not commit that directory.`,
      "Run the generated vercel env add commands from a linked Vercel project.",
      `Run vercel env run -e ${vercelEnvironment} -- npm run db:migrate after Postgres is set.`,
      "Redeploy production, then run npm run vercel:production against the HTTPS origin."
    ]
  };
}

export function renderVercelProductionRunbook(preparation) {
  const lines = [
    "# Vercel Production Environment Runbook",
    "",
    `Generated: ${preparation.generatedAt}`,
    `Environment: ${preparation.environment}`,
    `Ready: ${preparation.ready ? "yes" : "no"}`,
    "",
    "## Missing Required Values",
    preparation.missing.length ? preparation.missing.map((key) => `- ${key}`).join("\n") : "- none",
    "",
    "## Environment Values",
    ...preparation.entries.map((entry) => {
      const status = entry.configured ? entry.redactedValue : "<missing>";
      return `- ${entry.key}: ${status}${entry.required ? " (required)" : " (optional)"}`;
    }),
    "",
    "## Commands",
    "```bash",
    ...preparation.commands,
    "```",
    "",
    "## References",
    ...preparation.sources.map((source) => `- ${source}`)
  ];

  return `${lines.join("\n")}\n`;
}

export function isSensitiveKey(key) {
  if (key === "DATABASE_SSL") return false;
  return sensitiveKeyPattern.test(key);
}

export function redactValue(key, value) {
  if (!isConfiguredValue(value)) return "<missing>";
  if (isSensitiveKey(key)) return "<redacted>";
  return String(value);
}

function applyVercelProductionDefaults(launchEnv, rawEnv) {
  const env = { ...launchEnv };
  env.DATABASE_URL = resolvePostgresUrl(env) || env.DATABASE_URL || rawEnv.DATABASE_URL || "";

  for (const [key, value] of Object.entries(productionExpectedValues)) {
    env[key] = value;
  }

  env.PAYMENT_PROVIDER = normalizePaymentProvider(env.PAYMENT_PROVIDER);
  env.POLAR_SERVER ||= "production";
  env.ALERT_WEBHOOK_PROVIDER ||= "generic";

  if (env.SITE_URL) {
    env.PRODUCTION_BASE_URL ||= env.SITE_URL;
    env.SMOKE_BASE_URL ||= env.SITE_URL;
    env.STORE_PRODUCTION_ORIGIN ||= env.SITE_URL;
    env.MOBILE_APP_ORIGIN ||= env.SITE_URL;
  }

  return env;
}

function resolveEntryKeys(paymentProvider, rawEnv) {
  const paymentKeys = paymentProvider === "polar" ? polarPaymentKeys : tossPaymentKeys;
  const explicitOptionalKeys = optionalExplicitKeys.filter((key) => isConfiguredValue(rawEnv[key]));
  return uniqueKeys([...commonRequiredKeys, ...paymentKeys, ...mobileStoreKeys, ...explicitOptionalKeys]);
}

function createEntry(key, launchEnv, rawEnv, paymentProvider) {
  const value = launchEnv[key] ?? "";
  const expectedValue = productionExpectedValues[key];
  const required = isRequiredKey(key, paymentProvider);
  const configured = isEntryConfigured(key, value, expectedValue, required);

  return {
    key,
    required,
    configured,
    sensitive: isSensitiveKey(key),
    expectedValue: expectedValue || null,
    redactedValue: redactValue(key, value),
    command: buildVercelEnvAddCommand(key),
    source: isConfiguredValue(rawEnv[key]) ? "input" : expectedValue ? "production-default" : "derived"
  };
}

function buildVercelEnvAddCommand(key) {
  const sensitiveFlag = isSensitiveKey(key) ? " --sensitive" : "";
  return `vercel env add ${key} ${vercelEnvironment}${sensitiveFlag} < ${vercelEnvDirectory}/${key}`;
}

function isRequiredKey(key, paymentProvider) {
  if (commonRequiredKeys.includes(key)) return true;
  if (mobileStoreKeys.includes(key)) return true;
  if (paymentProvider === "polar") return polarPaymentKeys.includes(key);
  return tossPaymentKeys.includes(key);
}

function isEntryConfigured(key, value, expectedValue, required) {
  if (!required) return isConfiguredValue(value);
  if (!isConfiguredValue(value)) return false;
  if (expectedValue) return String(value) === expectedValue;
  if (productionValueRequirements[key]) return productionValueRequirements[key].test(String(value).trim());
  return true;
}

function isConfiguredValue(value) {
  const stringValue = String(value ?? "").trim();
  return Boolean(stringValue) && !placeholderPattern.test(stringValue);
}

function normalizePaymentProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  return provider === "polar" ? "polar" : "toss";
}

function uniqueKeys(keys) {
  return Array.from(new Set(keys));
}

function parseArgs(argv) {
  const args = {
    envFile: process.env.LAUNCH_ENV_FILE || defaultLaunchEnvFile,
    releaseCheck: process.env.VERCEL_RELEASE_CHECK === "true",
    jsonOnly: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--env-file") {
      args.envFile = argv[index + 1] || args.envFile;
      index += 1;
    } else if (item.startsWith("--env-file=")) {
      args.envFile = item.slice("--env-file=".length);
    } else if (item === "--release-check") {
      args.releaseCheck = true;
    } else if (item === "--json-only") {
      args.jsonOnly = true;
    }
  }

  return args;
}

async function readEnvFileIfPresent(path) {
  if (!path || !existsSync(path)) return {};
  return parseEnvText(await readFile(path, "utf-8"));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fileEnv = await readEnvFileIfPresent(args.envFile);
  const preparation = createVercelProductionPreparation({
    fileEnv,
    env: process.env,
    envFile: args.envFile
  });

  if (args.jsonOnly) {
    console.log(JSON.stringify(preparation, null, 2));
  } else {
    console.log(JSON.stringify(preparation, null, 2));
    console.log("");
    console.log(renderVercelProductionRunbook(preparation));
  }

  if (args.releaseCheck && !preparation.ready) {
    process.exit(1);
  }
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
