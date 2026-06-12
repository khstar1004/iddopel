import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const requiredPackageScripts = [
  "verify",
  "scan:maigret",
  "scan:maigret:live",
  "code:hygiene",
  "product:verify",
  "security:audit",
  "security:secrets",
  "release:prepare",
  "release:local",
  "release:production",
  "launch:button",
  "e2e",
  "assets:store",
  "assets:promotion",
  "assets:marketing",
  "assets:all",
  "assets:verify",
  "store:finalize",
  "store:verify",
  "privacy:verify",
  "toss:verify",
  "mobile:configure",
  "mobile:verify",
  "android:debug",
  "android:bundle",
  "deploy:verify",
  "verify:production",
  "smoke:vercel-beta",
  "smoke:release",
  "alerts:test",
  "db:migrate",
  "launch:readiness"
];

export const requiredReadmeCommands = [
  "npm run verify",
  "npm run scan:maigret",
  "npm run scan:maigret:live",
  "npm run code:hygiene",
  "npm run product:verify",
  "npm run security:audit",
  "npm run security:secrets",
  "npm run release:prepare",
  "npm run release:local",
  "npm run release:production",
  "npm run launch:button",
  "npm run e2e",
  "npm run assets:store",
  "npm run assets:marketing",
  "npm run assets:all",
  "npm run assets:verify",
  "npm run store:finalize",
  "npm run store:verify",
  "npm run privacy:verify",
  "npm run toss:verify",
  "npm run mobile:configure",
  "npm run mobile:verify",
  "npm run android:debug",
  "npm run android:bundle",
  "npm run deploy:verify",
  "npm run smoke:vercel-beta",
  "npm run smoke:release",
  "npm run alerts:test",
  "npm run launch:readiness"
];

export const requiredFiles = [
  "README.md",
  ".env.launch.example",
  "Dockerfile",
  "db/schema.sql",
  "deploy/compose/compose.yaml",
  "deploy/compose/Caddyfile",
  "docs/launch-checklist.md",
  "docs/store-submission.md",
  "docs/toss-submission.md",
  "docs/deployment.md",
  "docs/cloudtype-deployment.md",
  "docs/marketing/competitor-uiux-benchmark.md",
  "docs/privacy-data-map.md",
  "docs/app-privacy-data-safety.md",
  "fastlane/Fastfile",
  "fastlane/Appfile",
  "store-assets/apple-app-store.json",
  "store-assets/google-play-listing.json",
  "store-assets/privacy-declarations.json",
  "capacitor.config.ts",
  "src/app/launch/page.tsx",
  "src/app/api/dev/launch-button/route.ts",
  "src/components/LaunchConsole.tsx",
  "src/lib/launch-console.ts",
  "native-web/app-config.js",
  "native-web/app.js",
  "scripts/verify-release-candidate.mjs",
  "scripts/launch-button.mjs",
  "scripts/prepare-production-release.mjs",
  "scripts/verify-production-release.mjs",
  "scripts/verify-maigret-runtime.mjs",
  "scripts/verify-code-hygiene.mjs",
  "scripts/verify-product-positioning.mjs",
  "scripts/generate-store-assets.mjs",
  "scripts/generate-promotion-assets.mjs",
  "scripts/package-marketing-assets.mjs",
  "scripts/verify-store-assets.mjs",
  "scripts/verify-marketing-assets.mjs",
  "scripts/verify-secret-scan.mjs",
  "scripts/verify-android-debug-build.mjs",
  "scripts/verify-android-bundle-build.mjs",
  "scripts/test-alert-webhook.mjs",
  "tests/e2e/launch-console.spec.ts",
  "vercel.json"
];

export const requiredEnvExampleKeys = [
  "DATABASE_URL",
  "DATABASE_SSL",
  "CRON_SECRET",
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
  "REPORT_TOKEN_SECRET",
  "FIRST_FREE_FINGERPRINT_SECRET",
  "SITE_URL",
  "TOSS_CLIENT_KEY",
  "TOSS_SECRET_KEY",
  "TOSS_SECURITY_KEY",
  "TOSS_CONSOLE_API_KEY",
  "TOSS_CONSOLE_APP_ID",
  "TOSS_MINI_APP_NAME",
  "TOSS_ALLOWED_ORIGINS",
  "TOSS_REVIEW_TEST_USERNAME",
  "TOSS_REVIEW_SCENARIO",
  "PRODUCTION_BASE_URL",
  "ALERT_WEBHOOK_URL",
  "ALERT_WEBHOOK_PROVIDER",
  "ALERT_WEBHOOK_TIMEOUT_MS",
  "ALERT_RUNBOOK_URL",
  "STORE_PRODUCTION_ORIGIN",
  "STORE_SUPPORT_EMAIL",
  "MOBILE_APP_ORIGIN",
  "MOBILE_PAYMENTS_ENABLED",
  "APPLE_BUNDLE_ID",
  "APPLE_DETAILED_REPORT_PRODUCT_ID",
  "APPLE_ENVIRONMENT",
  "APPLE_KEY_ID",
  "APPLE_ISSUER_ID",
  "APPLE_PRIVATE_KEY",
  "APPLE_REQUIRE_JWS_VERIFICATION",
  "APPLE_ROOT_CERTIFICATES_BASE64",
  "APPLE_APP_APPLE_ID",
  "GOOGLE_PLAY_PACKAGE_NAME",
  "GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"
];

export const requiredLaunchEnvExampleKeys = [
  "PRODUCTION_DOMAIN",
  "STORE_SUPPORT_EMAIL",
  "DATABASE_URL",
  "DATABASE_SSL",
  "CRON_SECRET",
  "REPORT_TOKEN_SECRET",
  "FIRST_FREE_FINGERPRINT_SECRET",
  "TOSS_CLIENT_KEY",
  "TOSS_SECRET_KEY",
  "TOSS_SECURITY_KEY",
  "TOSS_CONSOLE_API_KEY",
  "TOSS_CONSOLE_APP_ID",
  "TOSS_MINI_APP_NAME",
  "TOSS_ALLOWED_ORIGINS",
  "TOSS_REVIEW_TEST_USERNAME",
  "TOSS_REVIEW_SCENARIO",
  "WEB_DETAILED_REPORT_PAYWALL_ENABLED",
  "ALERT_WEBHOOK_URL",
  "ALERT_WEBHOOK_PROVIDER",
  "ALERT_RUNBOOK_URL",
  "MOBILE_PAYMENTS_ENABLED",
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

const externalBlockerPatterns = [
  /production|domain|ssl|dns|alert routing|external monitoring|dashboard/i,
  /ALERT_WEBHOOK_URL|alerts:test|alert route/i,
  /DATABASE_URL=.*db:migrate|production database/i,
  /CRON_SECRET|scheduled .*cron|cron\/monitoring|cron\/prune/i,
  /Deploy Docker image|SCAN_PROVIDER=maigret|Maigret/i,
  /PAYMENT_PROVIDER=toss|TOSS_CLIENT_KEY|TOSS_SECRET_KEY|TOSS_SECURITY_KEY|Toss Payments|Toss/i,
  /TOSS_RELEASE_CHECK|Toss console|토스/i,
  /SMOKE_BASE_URL|PRODUCTION_BASE_URL|verify:production|Security headers checked/i,
  /final SITE_URL|sitemap\.xml|robots\.txt/i,
  /STORE_|store upload|App Store Connect|Google Play credentials|STORE_RELEASE_CHECK|support@domain/i,
  /MOBILE_|native archive|mobile:configure|mobile:verify/i,
  /Apple IAP|Google Play Billing|receipt verification|IAP|Billing/i,
  /GitHub Actions|release branch/i
];

export function parseChecklistItems(markdown) {
  return markdown
    .split(/\r?\n/)
    .map((line, index) => {
      const match = line.match(/^\s*-\s+\[([ xX])\]\s+(.+?)\s*$/);
      if (!match) return null;
      return {
        checked: match[1].toLowerCase() === "x",
        line: index + 1,
        text: match[2]
      };
    })
    .filter(Boolean);
}

export function parseEnvKeys(contents) {
  const keys = new Set();
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals > 0) keys.add(line.slice(0, equals).trim());
  }
  return keys;
}

export function isExternalChecklistBlocker(text) {
  return externalBlockerPatterns.some((pattern) => pattern.test(text));
}

export function createReadinessReport({
  packageJson,
  existingFiles,
  envExample,
  launchEnvExample = "",
  readme = "",
  checklistMarkdown,
  releaseCheck = false,
  now = new Date()
}) {
  const checks = [];
  const localFailures = [];
  const externalBlockers = [];
  const envKeys = parseEnvKeys(envExample);
  const launchEnvKeys = parseEnvKeys(launchEnvExample);
  const checklistItems = parseChecklistItems(checklistMarkdown);

  for (const script of requiredPackageScripts) {
    addCheck(checks, localFailures, `Package script ${script}`, Boolean(packageJson?.scripts?.[script]), `package.json must define ${script}.`);
  }

  for (const file of requiredFiles) {
    addCheck(checks, localFailures, `Required file ${file}`, existingFiles.has(file), `${file} must exist.`);
  }

  for (const command of requiredReadmeCommands) {
    addCheck(
      checks,
      localFailures,
      `README documents ${command}`,
      readme.includes(command),
      `README.md must document ${command}.`
    );
  }

  for (const key of requiredEnvExampleKeys) {
    addCheck(checks, localFailures, `.env.example key ${key}`, envKeys.has(key), `.env.example must document ${key}.`);
  }

  for (const key of requiredLaunchEnvExampleKeys) {
    addCheck(
      checks,
      localFailures,
      `.env.launch.example key ${key}`,
      launchEnvKeys.has(key),
      `.env.launch.example must document ${key}.`
    );
  }

  for (const item of checklistItems.filter((checklistItem) => !checklistItem.checked)) {
    if (isExternalChecklistBlocker(item.text)) {
      externalBlockers.push(item);
    } else {
      localFailures.push({
        name: `Checklist item line ${item.line}`,
        detail: item.text
      });
    }
  }

  const checkedChecklistItems = checklistItems.filter((item) => item.checked).length;
  const localReady = localFailures.length === 0;
  const releaseReady = localReady && externalBlockers.length === 0;
  const ok = releaseCheck ? releaseReady : localReady;

  return {
    ok,
    mode: releaseCheck ? "release" : "local",
    generatedAt: now.toISOString(),
    localReady,
    releaseReady,
    summary: {
      checks: checks.length,
      checkedChecklistItems,
      uncheckedChecklistItems: checklistItems.length - checkedChecklistItems,
      localFailures: localFailures.length,
      externalBlockers: externalBlockers.length
    },
    checks,
    localFailures,
    externalBlockers,
    warnings: releaseCheck
      ? []
      : externalBlockers.map((item) => ({
          name: `External blocker line ${item.line}`,
          detail: item.text
        }))
  };
}

function addCheck(checks, failures, name, ok, detail) {
  const check = { name, ok, detail };
  checks.push(check);
  if (!ok) failures.push({ name, detail });
}

async function main() {
  const [packageJson, envExample, launchEnvExample, checklistMarkdown, existingFiles] = await Promise.all([
    readJson("package.json"),
    readFile(".env.example", "utf-8"),
    readFile(".env.launch.example", "utf-8"),
    readFile("docs/launch-checklist.md", "utf-8"),
    findExistingFiles(requiredFiles)
  ]);
  const readme = await readFile("README.md", "utf-8").catch(() => "");

  const report = createReadinessReport({
    packageJson,
    existingFiles,
    envExample,
    launchEnvExample,
    readme,
    checklistMarkdown,
    releaseCheck: process.env.LAUNCH_RELEASE_CHECK === "true"
  });

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf-8"));
}

async function findExistingFiles(files) {
  const entries = await Promise.all(
    files.map(async (file) => {
      try {
        await access(file);
        return file;
      } catch {
        return null;
      }
    })
  );
  return new Set(entries.filter(Boolean));
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
