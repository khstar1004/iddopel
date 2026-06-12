import { randomBytes as nodeRandomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const storeJsonFiles = [
  "store-assets/apple-app-store.json",
  "store-assets/google-play-listing.json",
  "store-assets/privacy-declarations.json"
];

const commonRequiredExternalValues = [
  "STORE_SUPPORT_EMAIL",
  "TOSS_CONSOLE_API_KEY",
  "TOSS_CONSOLE_APP_ID",
  "TOSS_MINI_APP_NAME",
  "TOSS_ALLOWED_ORIGINS",
  "MOBILE_PAYMENTS_ENABLED=true",
  "APPLE_BUNDLE_ID=com.iddoppelganger.app",
  "APPLE_DETAILED_REPORT_PRODUCT_ID=detailed_report",
  "APPLE_ENVIRONMENT=production",
  "GOOGLE_PLAY_PACKAGE_NAME=com.iddoppelganger.app",
  "GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID=detailed_report",
  "ALERT_WEBHOOK_URL",
  "ALERT_RUNBOOK_URL"
];
const tossPaymentRequiredValues = ["TOSS_CLIENT_KEY", "TOSS_SECRET_KEY", "TOSS_SECURITY_KEY"];
const polarPaymentRequiredValues = [
  "POLAR_ACCESS_TOKEN",
  "POLAR_PRODUCT_ID",
  "POLAR_MONTHLY_MONITORING_PRODUCT_ID",
  "POLAR_WEBHOOK_SECRET"
];
const productionPaymentProviders = new Set(["toss", "polar"]);

export function normalizeProductionOrigin(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    throw new Error("Production origin is required.");
  }

  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`;
  const parsed = new URL(withScheme);
  if (parsed.protocol !== "https:") {
    throw new Error("Production origin must use HTTPS.");
  }
  if (isLocalHostname(parsed.hostname)) {
    throw new Error("Production origin must not be localhost.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Production origin must not include credentials.");
  }

  return {
    origin: parsed.origin,
    hostname: parsed.hostname
  };
}

export function renderDeployEnv(values) {
  const paymentProvider = normalizePaymentProvider(values.PAYMENT_PROVIDER);
  const env = {
    COMPOSE_PROJECT_NAME: "id-doppelganger",
    DOMAIN: values.DOMAIN,
    SITE_URL: values.SITE_URL,
    POSTGRES_DB: "id_doppelganger",
    POSTGRES_USER: "id_doppelganger",
    "POSTGRES_PASSWORD": values.POSTGRES_PASSWORD,
    DATABASE_SSL: "false",
    APP_IMAGE: "id-doppelganger:latest",
    "CRON_SECRET": values.CRON_SECRET,
    "REPORT_TOKEN_SECRET": values.REPORT_TOKEN_SECRET,
    "FIRST_FREE_FINGERPRINT_SECRET": values.FIRST_FREE_FINGERPRINT_SECRET,
    MONITORING_CRON_LIMIT: "3",
    RELEASE_VERSION: values.RELEASE_VERSION || "release-local",
    SCAN_PROVIDER: "maigret",
    MAIGRET_BIN: "maigret",
    MAIGRET_TOP_SITES_QUICK: "100",
    MAIGRET_TOP_SITES_DEEP: "500",
    MAIGRET_DEEP_ALL: "false",
    MAIGRET_SITE_TIMEOUT_SECONDS: "12",
    MAIGRET_PROCESS_TIMEOUT_MS: "120000",
    PAYMENT_PROVIDER: paymentProvider,
    ENABLE_MOCK_PAYMENTS: "false",
    WEB_DETAILED_REPORT_PAYWALL_ENABLED: values.WEB_DETAILED_REPORT_PAYWALL_ENABLED || "false",
    MONITORING_PAYWALL_ENABLED: values.MONITORING_PAYWALL_ENABLED || "false",
    TOSS_CLIENT_KEY: values.TOSS_CLIENT_KEY || "",
    "TOSS_SECRET_KEY": values.TOSS_SECRET_KEY || "",
    TOSS_SECURITY_KEY: values.TOSS_SECURITY_KEY || "",
    POLAR_ACCESS_TOKEN: values.POLAR_ACCESS_TOKEN || "",
    POLAR_PRODUCT_ID: values.POLAR_PRODUCT_ID || "",
    POLAR_MONTHLY_MONITORING_PRODUCT_ID: values.POLAR_MONTHLY_MONITORING_PRODUCT_ID || "",
    POLAR_WEBHOOK_SECRET: values.POLAR_WEBHOOK_SECRET || "",
    POLAR_SERVER: values.POLAR_SERVER || "production",
    TOSS_CONSOLE_APP_ID: values.TOSS_CONSOLE_APP_ID,
    TOSS_MINI_APP_NAME: values.TOSS_MINI_APP_NAME,
    TOSS_ALLOWED_ORIGINS: values.TOSS_ALLOWED_ORIGINS,
    TOSS_REVIEW_TEST_USERNAME: values.TOSS_REVIEW_TEST_USERNAME || "khstar104",
    TOSS_REVIEW_SCENARIO:
      values.TOSS_REVIEW_SCENARIO ||
      "Enter the review username, acknowledge legitimate purpose, run the free scan, then open the detailed report checkout.",
    TELEMETRY_DISABLED: "false",
    NEXT_PUBLIC_TELEMETRY_DISABLED: "false",
    ALERT_WEBHOOK_URL: values.ALERT_WEBHOOK_URL,
    ALERT_WEBHOOK_PROVIDER: values.ALERT_WEBHOOK_PROVIDER || "generic",
    ALERT_WEBHOOK_TIMEOUT_MS: values.ALERT_WEBHOOK_TIMEOUT_MS || "1500",
    ALERT_RUNBOOK_URL: values.ALERT_RUNBOOK_URL,
    MOBILE_APP_ORIGIN: values.MOBILE_APP_ORIGIN || values.SITE_URL,
    MOBILE_SUPPORT_URL: values.MOBILE_SUPPORT_URL || `${values.SITE_URL}/responsible-use`,
    MOBILE_PRIVACY_URL: values.MOBILE_PRIVACY_URL || `${values.SITE_URL}/privacy`,
    MOBILE_TERMS_URL: values.MOBILE_TERMS_URL || `${values.SITE_URL}/terms`,
    MOBILE_PAYMENTS_ENABLED: values.MOBILE_PAYMENTS_ENABLED || "false",
    APPLE_BUNDLE_ID: values.APPLE_BUNDLE_ID || "com.iddoppelganger.app",
    APPLE_DETAILED_REPORT_PRODUCT_ID: values.APPLE_DETAILED_REPORT_PRODUCT_ID || "detailed_report",
    APPLE_ENVIRONMENT: values.APPLE_ENVIRONMENT || "production",
    APPLE_KEY_ID: values.APPLE_KEY_ID || "",
    APPLE_ISSUER_ID: values.APPLE_ISSUER_ID || "",
    "APPLE_PRIVATE_KEY": values.APPLE_PRIVATE_KEY || "",
    APPLE_REQUIRE_JWS_VERIFICATION: values.APPLE_REQUIRE_JWS_VERIFICATION || "false",
    APPLE_ROOT_CERTIFICATES_BASE64: values.APPLE_ROOT_CERTIFICATES_BASE64 || "",
    APPLE_APP_APPLE_ID: values.APPLE_APP_APPLE_ID || "",
    GOOGLE_PLAY_PACKAGE_NAME: values.GOOGLE_PLAY_PACKAGE_NAME || "com.iddoppelganger.app",
    GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID: values.GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID || "detailed_report",
    "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON": values.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || ""
  };

  return [
    "# Generated by npm run release:prepare.",
    "# Keep this file out of version control.",
    "",
    ...Object.entries(env).map(([key, value]) => `${key}=${value ?? ""}`),
    ""
  ].join("\n");
}

export function createProductionReleasePreparation({ env = {}, existingFiles = {}, now = new Date(), randomBytes = nodeRandomBytes } = {}) {
  const originInput = env.PRODUCTION_DOMAIN || env.STORE_PRODUCTION_ORIGIN || env.MOBILE_APP_ORIGIN || env.SITE_URL || "";
  const paymentProvider = normalizePaymentProvider(env.PAYMENT_PROVIDER);
  const missing = [];

  if (!originInput) {
    missing.push("PRODUCTION_DOMAIN");
  } else if (hasPlaceholder(originInput)) {
    missing.push("PRODUCTION_DOMAIN");
  }

  if (!productionPaymentProviders.has(paymentProvider)) {
    missing.push("PAYMENT_PROVIDER=toss|polar");
  }

  for (const requirement of requiredExternalValuesForProvider(paymentProvider)) {
    const [key, expectedValue] = requirement.split("=");
    if (expectedValue) {
      if (env[key] !== expectedValue) {
        missing.push(requirement);
      }
    } else if (!String(env[key] || "").trim() || hasPlaceholder(env[key])) {
      missing.push(requirement);
    }
  }

  const originInfo = originInput ? normalizeProductionOrigin(originInput) : null;
  if (!originInfo) {
    return {
      ready: false,
      missing,
      origin: "",
      hostname: "",
      deployEnv: "",
      fileUpdates: []
    };
  }

  const releaseVersion = env.RELEASE_VERSION || `release-${formatTimestamp(now)}`;
  const siteUrl = originInfo.origin;
  const tossMiniAppName = String(env.TOSS_MINI_APP_NAME || "").trim();
  const deployValues = {
    ...env,
    DOMAIN: originInfo.hostname,
    SITE_URL: siteUrl,
    "POSTGRES_PASSWORD": env.POSTGRES_PASSWORD || generateUrlSafeSecret(randomBytes, 36),
    "CRON_SECRET": env.CRON_SECRET || generateUrlSafeSecret(randomBytes, 48),
    "REPORT_TOKEN_SECRET": env.REPORT_TOKEN_SECRET || generateUrlSafeSecret(randomBytes, 48),
    "FIRST_FREE_FINGERPRINT_SECRET": env.FIRST_FREE_FINGERPRINT_SECRET || generateUrlSafeSecret(randomBytes, 48),
    RELEASE_VERSION: releaseVersion,
    PAYMENT_PROVIDER: paymentProvider,
    TOSS_CLIENT_KEY: env.TOSS_CLIENT_KEY || "",
    "TOSS_SECRET_KEY": env.TOSS_SECRET_KEY || "",
    TOSS_SECURITY_KEY: env.TOSS_SECURITY_KEY || "",
    POLAR_ACCESS_TOKEN: env.POLAR_ACCESS_TOKEN || "",
    POLAR_PRODUCT_ID: env.POLAR_PRODUCT_ID || "",
    POLAR_MONTHLY_MONITORING_PRODUCT_ID: env.POLAR_MONTHLY_MONITORING_PRODUCT_ID || "",
    POLAR_WEBHOOK_SECRET: env.POLAR_WEBHOOK_SECRET || "",
    POLAR_SERVER: env.POLAR_SERVER || "production",
    TOSS_CONSOLE_APP_ID: env.TOSS_CONSOLE_APP_ID || "",
    TOSS_MINI_APP_NAME: tossMiniAppName,
    TOSS_ALLOWED_ORIGINS:
      env.TOSS_ALLOWED_ORIGINS ||
      (tossMiniAppName
        ? `https://${tossMiniAppName}.apps.tossmini.com,https://${tossMiniAppName}.private-apps.tossmini.com`
        : ""),
    ALERT_WEBHOOK_URL: env.ALERT_WEBHOOK_URL || "",
    ALERT_WEBHOOK_PROVIDER: env.ALERT_WEBHOOK_PROVIDER || "generic",
    ALERT_RUNBOOK_URL: env.ALERT_RUNBOOK_URL || "",
    STORE_SUPPORT_EMAIL: env.STORE_SUPPORT_EMAIL || "",
    MOBILE_APP_ORIGIN: siteUrl
  };
  const deployEnv = renderDeployEnv(deployValues);

  const fileUpdates = [
    { path: "deploy/compose/.env", content: deployEnv },
    { path: "deploy/compose/PRODUCTION_LAUNCH_RUNBOOK.md", content: renderProductionLaunchRunbook(deployValues) },
    { path: "fastlane/metadata/ko-KR/privacy_url.txt", content: `${siteUrl}/privacy\n` },
    { path: "fastlane/metadata/ko-KR/support_url.txt", content: `${siteUrl}/responsible-use\n` },
    { path: "fastlane/metadata/ko-KR/marketing_url.txt", content: `${siteUrl}/\n` },
    { path: "native-web/app-config.js", content: renderNativeAppConfig(siteUrl, env) }
  ];

  fileUpdates.push(...buildStoreMetadataUpdates(siteUrl, env.STORE_SUPPORT_EMAIL || "", existingFiles));

  return {
    ready: missing.length === 0,
    missing,
    origin: siteUrl,
    hostname: originInfo.hostname,
    releaseVersion,
    deployEnv,
    fileUpdates
  };
}

function buildStoreMetadataUpdates(origin, supportEmail, existingFiles) {
  const appleListing = parseJsonFile(existingFiles, "store-assets/apple-app-store.json");
  appleListing.privacyPolicyUrl = `${origin}/privacy`;
  appleListing.supportUrl = `${origin}/responsible-use`;
  appleListing.marketingUrl = `${origin}/`;

  const googleListing = parseJsonFile(existingFiles, "store-assets/google-play-listing.json");
  googleListing.privacyPolicyUrl = `${origin}/privacy`;
  if (supportEmail) {
    googleListing.contactEmail = supportEmail;
  }

  const privacyDeclarations = parseJsonFile(existingFiles, "store-assets/privacy-declarations.json");
  privacyDeclarations.privacyPolicyUrl = `${origin}/privacy`;
  privacyDeclarations.supportUrl = `${origin}/responsible-use`;

  return [
    { path: "store-assets/apple-app-store.json", content: `${JSON.stringify(appleListing, null, 2)}\n` },
    { path: "store-assets/google-play-listing.json", content: `${JSON.stringify(googleListing, null, 2)}\n` },
    { path: "store-assets/privacy-declarations.json", content: `${JSON.stringify(privacyDeclarations, null, 2)}\n` }
  ];
}

function renderNativeAppConfig(origin, env) {
  return `window.IDD_APP_CONFIG = ${JSON.stringify(
    {
      apiBaseUrl: origin,
      paymentsEnabled: env.MOBILE_PAYMENTS_ENABLED === "true",
      appleDetailedReportProductId: env.APPLE_DETAILED_REPORT_PRODUCT_ID || "detailed_report",
      googlePlayDetailedReportProductId: env.GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID || "detailed_report",
      supportUrl: env.MOBILE_SUPPORT_URL || `${origin}/responsible-use`,
      privacyUrl: env.MOBILE_PRIVACY_URL || `${origin}/privacy`,
      termsUrl: env.MOBILE_TERMS_URL || `${origin}/terms`
    },
    null,
    2
  )};
`;
}

export function renderProductionLaunchRunbook(values) {
  const supportEmail = values.STORE_SUPPORT_EMAIL || "not configured";
  const paymentProvider = normalizePaymentProvider(values.PAYMENT_PROVIDER);
  const paymentProviderLabel = paymentProvider === "polar" ? "Polar" : "Toss Payments";

  return `# ID Doppelganger Production Launch Runbook

Generated by \`npm run release:prepare\`.

This runbook intentionally omits production secrets. Keep \`deploy/compose/.env\` out of version control and load real deployment secrets from your host, CI, ${paymentProviderLabel}, Toss, App Store Connect, and Google Play consoles.

## Finalized Public Values

- Production origin: ${values.SITE_URL}
- Production domain: ${values.DOMAIN}
- Release version: ${values.RELEASE_VERSION}
- Store support email: ${supportEmail}
- Web checkout provider: ${paymentProviderLabel}
- Web checkout credentials: ${paymentProviderLabel} credentials configured in release environment
- Toss console API key: configured in release environment
- Toss mini app name: ${values.TOSS_MINI_APP_NAME}
- Toss allowed origins: ${values.TOSS_ALLOWED_ORIGINS}
- Mobile app origin: ${values.MOBILE_APP_ORIGIN || values.SITE_URL}

## 1. Review Generated Files

\`\`\`bash
npm run assets:all
npm run deploy:verify
DEPLOY_RELEASE_CHECK=true npm run deploy:verify
npm run store:verify
npm run privacy:verify
npm run toss:verify
npm run mobile:verify
\`\`\`

## 2. Start Or Update The Compose Stack

Point DNS A/AAAA records at the production host before this step so Caddy can issue TLS certificates for \`${values.DOMAIN}\`.

\`\`\`bash
docker build -t id-doppelganger:latest .
docker compose --env-file deploy/compose/.env -f deploy/compose/compose.yaml up -d --build
\`\`\`

## 3. Verify The Live Web Launch

\`\`\`bash
PRODUCTION_BASE_URL="${values.SITE_URL}" npm run verify:production
SMOKE_BASE_URL="${values.SITE_URL}" SMOKE_CONFIRM_PAYMENT=skip npm run smoke:release
\`\`\`

Use \`SMOKE_CONFIRM_PAYMENT=skip\` for production checkout credentials. Remove it only when intentionally testing a non-live payment path.

## 4. Verify Toss, Store, And Native Packages

Run these with the real release credentials already available in the shell or CI secret manager.

\`\`\`bash
TOSS_RELEASE_CHECK=true SITE_URL="${values.SITE_URL}" npm run toss:verify
STORE_PRODUCTION_ORIGIN="${values.SITE_URL}" STORE_SUPPORT_EMAIL="${supportEmail}" npm run store:finalize
STORE_RELEASE_CHECK=true npm run store:verify
MOBILE_APP_ORIGIN="${values.SITE_URL}" npm run mobile:configure
MOBILE_RELEASE_CHECK=true npm run mobile:verify
npm run android:bundle
\`\`\`

\`npm run release:production\` runs the same store finalization and native configuration steps before the store and mobile release gates.

Keep native paid reports disabled until Apple IAP and Google Play Billing products, receipt verification credentials, sandbox purchases, restore flow, and review notes are complete.

## 5. First-Hour Production Watch

\`\`\`bash
LAUNCH_RELEASE_CHECK=true npm run launch:readiness
ALERT_WEBHOOK_URL="<from-secret-manager>" ALERT_WEBHOOK_PROVIDER="${values.ALERT_WEBHOOK_PROVIDER}" ALERT_RUNBOOK_URL="${values.ALERT_RUNBOOK_URL}" npm run alerts:test
\`\`\`

Manual checks:

- Open ${values.SITE_URL} and run one legitimate-purpose scan.
- Confirm the result card appears before score analysis.
- Open the full report checkout and verify ${paymentProviderLabel} opens.
- Check ${values.SITE_URL}/sitemap.xml and ${values.SITE_URL}/robots.txt.
- Confirm production logs contain \`id_doppelganger_telemetry\` and no new client errors.
- Confirm prune and monthly monitoring cron invocations succeed with \`CRON_SECRET\`.

## Rollback

If Maigret is slow or blocked, set \`SCAN_PROVIDER=mock\` in \`deploy/compose/.env\` and restart only the app service while preserving the landing, report, policy, and payment surfaces:

\`\`\`bash
docker compose --env-file deploy/compose/.env -f deploy/compose/compose.yaml up -d app
\`\`\`

If payment or report access fails, hide paid CTAs or roll back the app image, then verify \`/\`, \`/toss\`, \`/api/health\`, and \`/api/scans\`.
`;
}

function normalizePaymentProvider(value) {
  const input = String(value || "").trim().toLowerCase();
  return input || "toss";
}

function requiredExternalValuesForProvider(paymentProvider) {
  const paymentValues =
    paymentProvider === "polar" ? polarPaymentRequiredValues :
    paymentProvider === "toss" ? tossPaymentRequiredValues :
    [];
  return [...commonRequiredExternalValues, ...paymentValues];
}

function parseJsonFile(existingFiles, path) {
  const content = existingFiles[path];
  if (!content) return {};
  return JSON.parse(content);
}

function generateUrlSafeSecret(randomBytes, byteLength) {
  return randomBytes(byteLength).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function formatTimestamp(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function isLocalHostname(hostname) {
  return ["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"].includes(hostname.toLowerCase());
}

function hasPlaceholder(value) {
  return /YOUR_|your-|replace-with|example\.com|support@YOUR_DOMAIN/i.test(String(value || ""));
}

async function main() {
  const dryRun = process.env.PREPARE_RELEASE_DRY_RUN === "true" || process.argv.includes("--dry-run");
  const existingFiles = await readExistingFiles(storeJsonFiles);
  const preparation = createProductionReleasePreparation({
    env: process.env,
    existingFiles
  });

  if (!preparation.ready) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          dryRun,
          missing: preparation.missing,
          message:
            "Set the missing production values, then rerun npm run release:prepare. The script will not write partial production files."
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  if (!dryRun) {
    for (const update of preparation.fileUpdates) {
      await mkdir(dirname(update.path), { recursive: true });
      await writeFile(update.path, update.content, "utf-8");
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        origin: preparation.origin,
        hostname: preparation.hostname,
        releaseVersion: preparation.releaseVersion,
        updatedFiles: preparation.fileUpdates.map((update) => update.path)
      },
      null,
      2
    )
  );
}

async function readExistingFiles(files) {
  const entries = await Promise.all(
    files.map(async (file) => {
      try {
        return [file, await readFile(file, "utf-8")];
      } catch {
        return [file, "{}"];
      }
    })
  );
  return Object.fromEntries(entries);
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
