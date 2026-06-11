import { describe, expect, it } from "vitest";
// @ts-ignore - This test exercises the Node release gate script directly.
import { createReadinessReport, parseChecklistItems } from "../../scripts/launch-readiness.mjs";

const completeScripts = {
  verify: "npm run typecheck && npm run test && npm run build",
  "scan:maigret": "node scripts/verify-maigret-runtime.mjs",
  "scan:maigret:live": "node scripts/verify-maigret-runtime.mjs --live",
  "code:hygiene": "node scripts/verify-code-hygiene.mjs",
  "product:verify": "node scripts/verify-product-positioning.mjs",
  "security:audit": "npm audit --audit-level=high",
  "security:secrets": "node scripts/verify-secret-scan.mjs",
  "release:prepare": "node scripts/prepare-production-release.mjs",
  "release:local": "node scripts/verify-release-candidate.mjs",
  "release:production": "node scripts/verify-production-release.mjs",
  "launch:button": "node scripts/launch-button.mjs",
  e2e: "playwright test",
  "assets:store": "node scripts/generate-store-assets.mjs",
  "assets:promotion": "node scripts/generate-promotion-assets.mjs",
  "assets:marketing": "npm run assets:promotion && node scripts/package-marketing-assets.mjs",
  "assets:all": "npm run assets:store && npm run assets:marketing && npm run assets:verify",
  "assets:verify": "node scripts/verify-store-assets.mjs && node scripts/verify-marketing-assets.mjs",
  "store:verify": "node scripts/verify-store-submission.mjs && npm run privacy:verify",
  "privacy:verify": "node scripts/verify-store-privacy.mjs",
  "toss:verify": "node scripts/verify-toss-submission.mjs",
  "mobile:verify": "node scripts/verify-mobile-app.mjs",
  "android:debug": "node scripts/verify-android-debug-build.mjs",
  "android:bundle": "node scripts/verify-android-bundle-build.mjs",
  "deploy:verify": "node scripts/verify-deploy-compose.mjs",
  "verify:production": "node scripts/verify-production-config.mjs",
  "smoke:release": "node scripts/smoke-release.mjs",
  "alerts:test": "node scripts/test-alert-webhook.mjs",
  "db:migrate": "node scripts/migrate-postgres.mjs",
  "launch:readiness": "node scripts/launch-readiness.mjs"
};

const completeFiles = new Set([
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
]);

const completeReadme = `
# ID 도플갱어

npm run verify
npm run scan:maigret
npm run scan:maigret:live
npm run code:hygiene
npm run product:verify
npm run security:audit
npm run security:secrets
npm run release:prepare
npm run release:local
npm run release:production
npm run launch:button
npm run e2e
npm run assets:store
npm run assets:marketing
npm run assets:all
npm run assets:verify
npm run launch:readiness
npm run deploy:verify
npm run toss:verify
npm run store:verify
npm run privacy:verify
npm run mobile:verify
npm run android:debug
npm run android:bundle
npm run alerts:test
`;

const completeEnv = `
DATABASE_URL=
DATABASE_SSL=false
CRON_SECRET=
MONITORING_CRON_LIMIT=3
SCAN_PROVIDER=maigret
MAIGRET_BIN=maigret
MAIGRET_TOP_SITES_QUICK=100
MAIGRET_TOP_SITES_DEEP=500
MAIGRET_DEEP_ALL=false
MAIGRET_SITE_TIMEOUT_SECONDS=12
MAIGRET_PROCESS_TIMEOUT_MS=120000
PAYMENT_PROVIDER=mock
ENABLE_MOCK_PAYMENTS=false
SITE_URL=http://localhost:3000
TOSS_CLIENT_KEY=
TOSS_SECRET_KEY=
TOSS_SECURITY_KEY=
TOSS_CONSOLE_API_KEY=
TOSS_CONSOLE_APP_ID=
TOSS_MINI_APP_NAME=
TOSS_ALLOWED_ORIGINS=
TOSS_REVIEW_TEST_USERNAME=khstar104
TOSS_REVIEW_SCENARIO=Enter the review username and run the flow.
PRODUCTION_BASE_URL=
ALERT_WEBHOOK_URL=
ALERT_WEBHOOK_PROVIDER=generic
ALERT_WEBHOOK_TIMEOUT_MS=1500
ALERT_RUNBOOK_URL=https://YOUR_PRODUCTION_DOMAIN/runbooks/launch
STORE_PRODUCTION_ORIGIN=
STORE_SUPPORT_EMAIL=support@YOUR_DOMAIN
MOBILE_APP_ORIGIN=https://YOUR_PRODUCTION_DOMAIN
MOBILE_PAYMENTS_ENABLED=false
APPLE_BUNDLE_ID=com.iddoppelganger.app
APPLE_DETAILED_REPORT_PRODUCT_ID=detailed_report
APPLE_ENVIRONMENT=sandbox
APPLE_KEY_ID=
APPLE_ISSUER_ID=
APPLE_PRIVATE_KEY=
APPLE_REQUIRE_JWS_VERIFICATION=false
APPLE_ROOT_CERTIFICATES_BASE64=
APPLE_APP_APPLE_ID=
GOOGLE_PLAY_PACKAGE_NAME=com.iddoppelganger.app
GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID=detailed_report
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=
`;

const completeLaunchEnv = `
PRODUCTION_DOMAIN=YOUR_DOMAIN
STORE_SUPPORT_EMAIL=support@YOUR_DOMAIN
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DB
DATABASE_SSL=true
CRON_SECRET=your_32_plus_character_random_secret
TOSS_CLIENT_KEY=YOUR_TOSS_CLIENT_KEY
TOSS_SECRET_KEY=YOUR_TOSS_SECRET_KEY
TOSS_SECURITY_KEY=YOUR_TOSS_SECURITY_KEY
TOSS_CONSOLE_API_KEY=YOUR_TOSS_CONSOLE_API_KEY
TOSS_CONSOLE_APP_ID=YOUR_TOSS_CONSOLE_APP_ID
TOSS_MINI_APP_NAME=YOUR_TOSS_MINI_APP_NAME
TOSS_ALLOWED_ORIGINS=https://YOUR_TOSS_APP_NAME.apps.tossmini.com
TOSS_REVIEW_TEST_USERNAME=khstar104
TOSS_REVIEW_SCENARIO=Enter the review username and run the flow.
ALERT_WEBHOOK_URL=https://YOUR_ALERT_WEBHOOK
ALERT_WEBHOOK_PROVIDER=slack
ALERT_RUNBOOK_URL=https://YOUR_RUNBOOK_URL
MOBILE_PAYMENTS_ENABLED=true
APPLE_BUNDLE_ID=com.iddoppelganger.app
APPLE_DETAILED_REPORT_PRODUCT_ID=detailed_report
APPLE_ENVIRONMENT=production
APPLE_KEY_ID=
APPLE_ISSUER_ID=
APPLE_PRIVATE_KEY=
APPLE_APP_APPLE_ID=
GOOGLE_PLAY_PACKAGE_NAME=com.iddoppelganger.app
GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID=detailed_report
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=
`;

describe("launch-readiness", () => {
  it("parses checked and unchecked checklist items with line numbers", () => {
    const items = parseChecklistItems(["# Launch", "- [x] Local package", "- [ ] Production domain"].join("\n"));

    expect(items).toEqual([
      { checked: true, line: 2, text: "Local package" },
      { checked: false, line: 3, text: "Production domain" }
    ]);
  });

  it("keeps external launch blockers separate from local failures in default mode", () => {
    const report = createReadinessReport({
      packageJson: { scripts: completeScripts },
      existingFiles: completeFiles,
      envExample: completeEnv,
      launchEnvExample: completeLaunchEnv,
      readme: completeReadme,
      checklistMarkdown: "- [x] Local package\n- [ ] Production domain, SSL, DNS, alert routing",
      releaseCheck: false
    });

    expect(report.ok).toBe(true);
    expect(report.localReady).toBe(true);
    expect(report.releaseReady).toBe(false);
    expect(report.localFailures).toEqual([]);
    expect(report.externalBlockers[0].text).toContain("Production domain");
  });

  it("fails release mode while external launch blockers remain", () => {
    const report = createReadinessReport({
      packageJson: { scripts: completeScripts },
      existingFiles: completeFiles,
      envExample: completeEnv,
      launchEnvExample: completeLaunchEnv,
      readme: completeReadme,
      checklistMarkdown: "- [x] Local package\n- [ ] STORE_RELEASE_CHECK=true npm run store:verify passes",
      releaseCheck: true
    });

    expect(report.ok).toBe(false);
    expect(report.releaseReady).toBe(false);
    expect(report.externalBlockers).toHaveLength(1);
  });

  it("fails default mode when a local verification script is missing", () => {
    const report = createReadinessReport({
      packageJson: { scripts: { ...completeScripts, verify: undefined } },
      existingFiles: completeFiles,
      envExample: completeEnv,
      launchEnvExample: completeLaunchEnv,
      readme: completeReadme,
      checklistMarkdown: "- [x] Local package",
      releaseCheck: false
    });

    expect(report.ok).toBe(false);
    expect(report.localReady).toBe(false);
    expect(report.localFailures).toContainEqual(expect.objectContaining({ name: "Package script verify" }));
  });

  it("fails default mode when the launch README omits a critical release command", () => {
    const report = createReadinessReport({
      packageJson: { scripts: completeScripts },
      existingFiles: completeFiles,
      envExample: completeEnv,
      launchEnvExample: completeLaunchEnv,
      readme: completeReadme.replace("npm run android:debug", ""),
      checklistMarkdown: "- [x] Local package",
      releaseCheck: false
    });

    expect(report.ok).toBe(false);
    expect(report.localFailures).toContainEqual(expect.objectContaining({ name: "README documents npm run android:debug" }));
  });
});
