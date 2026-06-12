import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePostgresUrl } from "./postgres-env.mjs";

export const defaultLaunchEnvFile = ".env.launch";

const basePrepareRequiredKeys = [
  "PRODUCTION_DOMAIN",
  "STORE_SUPPORT_EMAIL",
  "TOSS_CONSOLE_API_KEY",
  "TOSS_CONSOLE_APP_ID",
  "TOSS_MINI_APP_NAME",
  "TOSS_ALLOWED_ORIGINS",
  "ALERT_WEBHOOK_URL",
  "ALERT_RUNBOOK_URL"
];
const tossPaymentRequiredKeys = ["TOSS_CLIENT_KEY", "TOSS_SECRET_KEY", "TOSS_SECURITY_KEY"];
const polarPaymentRequiredKeys = [
  "POLAR_ACCESS_TOKEN",
  "POLAR_PRODUCT_ID",
  "POLAR_MONTHLY_MONITORING_PRODUCT_ID",
  "POLAR_WEBHOOK_SECRET"
];
const productionPaymentProviders = new Set(["toss", "polar"]);

const shipRequiredKeys = ["DATABASE_URL", "REPORT_TOKEN_SECRET", "FIRST_FREE_FINGERPRINT_SECRET"];
const shipRequiredValues = {
  MOBILE_PAYMENTS_ENABLED: "true"
};
const storeReleaseRequiredKeys = [
  "CRON_SECRET",
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

const sensitiveKeyPattern = /(SECRET|PASSWORD|PRIVATE_KEY|SERVICE_ACCOUNT|DATABASE_URL|WEBHOOK_URL|TOKEN|KEY_ID|ISSUER_ID|API_KEY|CLIENT_KEY|SECURITY_KEY)/i;
const publicLaunchEnvKeys = new Set([
  "PRODUCTION_DOMAIN",
  "STORE_SUPPORT_EMAIL",
  "DATABASE_URL",
  "DATABASE_SSL",
  "CRON_SECRET",
  "REPORT_TOKEN_SECRET",
  "FIRST_FREE_FINGERPRINT_SECRET",
  "MONITORING_CRON_LIMIT",
  "SCAN_PROVIDER",
  "MAIGRET_BIN",
  "MAIGRET_TOP_SITES_QUICK",
  "MAIGRET_TOP_SITES_DEEP",
  "MAIGRET_DEEP_ALL",
  "MAIGRET_SITE_TIMEOUT_SECONDS",
  "MAIGRET_PROCESS_TIMEOUT_MS",
  "PAYMENT_PROVIDER",
  "ENABLE_MOCK_PAYMENTS",
  "WEB_DETAILED_REPORT_PAYWALL_ENABLED",
  "MONITORING_PAYWALL_ENABLED",
  "TOSS_CLIENT_KEY",
  "POLAR_ACCESS_TOKEN",
  "POLAR_PRODUCT_ID",
  "POLAR_MONTHLY_MONITORING_PRODUCT_ID",
  "POLAR_WEBHOOK_SECRET",
  "POLAR_SERVER",
  "SITE_URL",
  "PRODUCTION_BASE_URL",
  "SMOKE_BASE_URL",
  "STORE_PRODUCTION_ORIGIN",
  "MOBILE_APP_ORIGIN",
  "MOBILE_PAYMENTS_ENABLED",
  "TOSS_SECRET_KEY",
  "TOSS_SECURITY_KEY",
  "TOSS_CONSOLE_API_KEY",
  "TOSS_CONSOLE_APP_ID",
  "TOSS_MINI_APP_NAME",
  "TOSS_ALLOWED_ORIGINS",
  "TOSS_REVIEW_TEST_USERNAME",
  "TOSS_REVIEW_SCENARIO",
  "ALERT_WEBHOOK_URL",
  "ALERT_WEBHOOK_PROVIDER",
  "ALERT_WEBHOOK_TIMEOUT_MS",
  "ALERT_RUNBOOK_URL",
  "APPLE_KEY_ID",
  "APPLE_ISSUER_ID",
  "APPLE_PRIVATE_KEY",
  "APPLE_BUNDLE_ID",
  "APPLE_DETAILED_REPORT_PRODUCT_ID",
  "APPLE_ENVIRONMENT",
  "APPLE_APP_APPLE_ID",
  "APP_STORE_CONNECT_KEY_ID",
  "APP_STORE_CONNECT_ISSUER_ID",
  "APP_STORE_CONNECT_API_KEY_P8",
  "APP_STORE_CONNECT_APPLE_ID",
  "GOOGLE_PLAY_PACKAGE_NAME",
  "GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
  "DEPLOY_RELEASE_CHECK",
  "STORE_RELEASE_CHECK",
  "TOSS_RELEASE_CHECK",
  "MOBILE_RELEASE_CHECK",
  "SMOKE_CONFIRM_PAYMENT"
]);

export function parseEnvText(contents) {
  const values = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const line = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const equals = line.indexOf("=");
    if (equals <= 0) continue;

    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if (!/^[A-Z0-9_]+$/.test(key)) continue;

    if (value.startsWith('"') && value.endsWith('"')) {
      value = parseDoubleQuotedEnvValue(value);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }

    values[key] = value;
  }

  return values;
}

function parseDoubleQuotedEnvValue(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value.slice(1, -1);
  }
}

export function buildLaunchEnvironment({ fileEnv = {}, env = {} } = {}) {
  const merged = { ...fileEnv, ...env };
  merged.DATABASE_URL ||= resolvePostgresUrl(merged) || "";
  const origin = normalizeProductionOrigin(
    merged.PRODUCTION_DOMAIN || merged.SITE_URL || merged.STORE_PRODUCTION_ORIGIN || merged.MOBILE_APP_ORIGIN || ""
  );

  if (origin) {
    merged.PRODUCTION_DOMAIN ||= origin.hostname;
    merged.SITE_URL ||= origin.origin;
    merged.PRODUCTION_BASE_URL ||= origin.origin;
    merged.SMOKE_BASE_URL ||= origin.origin;
    merged.STORE_PRODUCTION_ORIGIN ||= origin.origin;
    merged.MOBILE_APP_ORIGIN ||= origin.origin;
  }

  merged.SCAN_PROVIDER ||= "maigret";
  merged.PAYMENT_PROVIDER = normalizePaymentProvider(merged.PAYMENT_PROVIDER);
  merged.ENABLE_MOCK_PAYMENTS ||= "false";
  merged.WEB_DETAILED_REPORT_PAYWALL_ENABLED ||= "false";
  merged.MONITORING_PAYWALL_ENABLED ||= "false";
  merged.POLAR_SERVER ||= "production";
  merged.DATABASE_SSL ||= "false";
  merged.MONITORING_CRON_LIMIT ||= "3";
  merged.SMOKE_CONFIRM_PAYMENT ||= "skip";
  merged.ALERT_WEBHOOK_PROVIDER ||= "generic";
  merged.ALERT_WEBHOOK_TIMEOUT_MS ||= "1500";
  merged.TOSS_REVIEW_TEST_USERNAME ||= "khstar104";
  merged.TOSS_REVIEW_SCENARIO ||= "Enter the review username, acknowledge legitimate purpose, run the free scan, then open the detailed report checkout.";

  if (!merged.TOSS_ALLOWED_ORIGINS && merged.TOSS_MINI_APP_NAME && /^[a-z0-9-]+$/.test(merged.TOSS_MINI_APP_NAME)) {
    merged.TOSS_ALLOWED_ORIGINS = [
      `https://${merged.TOSS_MINI_APP_NAME}.apps.tossmini.com`,
      `https://${merged.TOSS_MINI_APP_NAME}.private-apps.tossmini.com`
    ].join(",");
  }

  merged.APPLE_BUNDLE_ID ||= "com.iddoppelganger.app";
  merged.APPLE_DETAILED_REPORT_PRODUCT_ID ||= "detailed_report";
  merged.APPLE_ENVIRONMENT ||= "production";
  merged.GOOGLE_PLAY_PACKAGE_NAME ||= "com.iddoppelganger.app";
  merged.GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID ||= "detailed_report";

  merged.APP_STORE_CONNECT_KEY_ID ||= merged.APPLE_KEY_ID;
  merged.APP_STORE_CONNECT_ISSUER_ID ||= merged.APPLE_ISSUER_ID;
  merged.APP_STORE_CONNECT_API_KEY_P8 ||= merged.APPLE_PRIVATE_KEY;
  merged.APP_STORE_CONNECT_APPLE_ID ||= merged.APPLE_APP_APPLE_ID;

  return merged;
}

export function buildLaunchButtonPlan({
  env = {},
  envFile = defaultLaunchEnvFile,
  ship = false,
  localGate = false
} = {}) {
  const paymentProvider = normalizePaymentProvider(env.PAYMENT_PROVIDER);
  const prepareRequiredKeys = [
    ...basePrepareRequiredKeys,
    ...requiredPaymentKeysForProvider(paymentProvider)
  ];
  const missing = missingKeys(env, ship ? [...prepareRequiredKeys, ...shipRequiredKeys, ...storeReleaseRequiredKeys] : prepareRequiredKeys);
  if (!productionPaymentProviders.has(paymentProvider)) {
    missing.push("PAYMENT_PROVIDER=toss|polar");
  }
  if (ship) {
    for (const [key, expectedValue] of Object.entries(shipRequiredValues)) {
      if (env[key] !== expectedValue) {
        missing.push(`${key}=${expectedValue}`);
      }
    }
  }
  const steps = [
    npmStep("generate-release-assets", "assets:all", env, "Regenerate store screenshots, marketing images, press kits, and verify all release assets.")
  ];

  if (localGate) {
    steps.push(npmStep("local-release-gate", "release:local", env, "Run the full local release candidate gate."));
  }

  steps.push(
    npmStep("prepare-production-files", "release:prepare", env, "Generate deploy env, launch runbook, store URLs, and native config."),
    npmStep(
      "verify-compose-release-config",
      "deploy:verify",
      { ...env, DEPLOY_RELEASE_CHECK: "true" },
      "Verify generated Compose production configuration."
    )
  );

  if (ship) {
    steps.push(
      {
        id: "deploy-compose-stack",
        type: "command",
        command: "docker",
        args: ["compose", "--env-file", "deploy/compose/.env", "-f", "deploy/compose/compose.yaml", "up", "-d", "--build"],
        env,
        description: "Build and start the production Compose stack."
      },
      npmStep("verify-live-production", "release:production", env, "Run production migration, smoke, Toss, store, mobile, and launch gates.")
    );
  }

  return {
    ready: missing.length === 0,
    ship,
    localGate,
    envFile,
    missing,
    steps
  };
}

export function createPublicLaunchReport(plan) {
  return {
    ok: plan.ready,
    ship: plan.ship,
    localGate: plan.localGate,
    envFile: plan.envFile,
    missing: plan.missing,
    steps: plan.steps.map((step) => ({
      id: step.id,
      description: step.description,
      command: displayCommand(step),
      env: redactPublicEnv(step.env)
    }))
  };
}

export function runLaunchButtonPlan(plan, { cwd = process.cwd(), env = process.env, spawnSyncImpl = spawnSync } = {}) {
  const results = [];

  for (const step of plan.steps) {
    const startedAt = performance.now();
    console.log(`\n[launch:button] ${displayCommand(step)}`);
    const result = runStep(step, { cwd, env: { ...env, ...step.env }, spawnSyncImpl });
    const ok = result.status === 0;
    results.push({
      id: step.id,
      command: displayCommand(step),
      ok,
      status: result.status,
      durationMs: Math.round(performance.now() - startedAt)
    });

    if (!ok) {
      return { ok: false, failedStep: step.id, results };
    }
  }

  return { ok: true, failedStep: null, results };
}

function npmStep(id, script, env, description) {
  return {
    id,
    type: "npm",
    script,
    env,
    description
  };
}

function runStep(step, { cwd, env, spawnSyncImpl }) {
  if (step.type === "npm") {
    if (process.platform === "win32") {
      return spawnSyncImpl("cmd.exe", ["/d", "/c", `npm run ${step.script}`], { cwd, env, stdio: "inherit", shell: false });
    }

    return spawnSyncImpl("npm", ["run", step.script], { cwd, env, stdio: "inherit", shell: false });
  }

  return spawnSyncImpl(step.command, step.args, { cwd, env, stdio: "inherit", shell: false });
}

function displayCommand(step) {
  if (step.type === "npm") return `npm run ${step.script}`;
  return [step.command, ...step.args].join(" ");
}

function missingKeys(env, keys) {
  return Array.from(new Set(keys)).filter((key) => {
    const value = String(env[key] || "").trim();
    return !value || hasPlaceholder(value);
  });
}

function normalizePaymentProvider(value) {
  const input = String(value || "").trim().toLowerCase();
  return input || "toss";
}

function requiredPaymentKeysForProvider(paymentProvider) {
  if (paymentProvider === "polar") return polarPaymentRequiredKeys;
  if (paymentProvider === "toss") return tossPaymentRequiredKeys;
  return [];
}

function hasPlaceholder(value) {
  return /YOUR_|your-|replace-with|example\.com|support@YOUR_DOMAIN/i.test(String(value || ""));
}

function redactPublicEnv(env) {
  return Object.fromEntries(
    Object.entries(env)
      .filter(([key, value]) => publicLaunchEnvKeys.has(key) && String(value ?? "").trim().length > 0)
      .map(([key, value]) => [key, sensitiveKeyPattern.test(key) ? "<redacted>" : value])
  );
}

function normalizeProductionOrigin(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return null;

  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`;
  const parsed = new URL(withScheme);
  if (parsed.protocol !== "https:" || ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(parsed.hostname)) {
    return null;
  }

  return {
    origin: parsed.origin,
    hostname: parsed.hostname
  };
}

function parseArgs(argv) {
  const args = {
    envFile: process.env.LAUNCH_ENV_FILE || defaultLaunchEnvFile,
    execute: false,
    ship: false,
    localGate: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--env-file") {
      args.envFile = argv[index + 1] || args.envFile;
      index += 1;
    } else if (item.startsWith("--env-file=")) {
      args.envFile = item.slice("--env-file=".length);
    } else if (item === "--execute") {
      args.execute = true;
    } else if (item === "--ship") {
      args.ship = true;
    } else if (item === "--local-gate") {
      args.localGate = true;
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
  const launchEnv = buildLaunchEnvironment({ fileEnv, env: process.env });
  const plan = buildLaunchButtonPlan({
    env: launchEnv,
    envFile: args.envFile,
    ship: args.ship,
    localGate: args.localGate
  });
  const publicReport = createPublicLaunchReport(plan);

  if (!args.execute || !plan.ready) {
    console.log(JSON.stringify({ ...publicReport, dryRun: !args.execute }, null, 2));
    if (args.execute && !plan.ready) process.exit(1);
    return;
  }

  const result = runLaunchButtonPlan(plan, { env: launchEnv });
  console.log(`\n${JSON.stringify({ ...publicReport, dryRun: false, result }, null, 2)}`);
  if (!result.ok) process.exit(1);
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
