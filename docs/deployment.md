# Deployment Guide

## Recommended Production Path
Use the Docker image when you want real Maigret scans in production. The image installs both the Next.js app and the Maigret Python CLI.

```bash
docker build -t id-doppelganger .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DB" \
  -e CRON_SECRET="replace-with-random-secret" \
  -e SCAN_PROVIDER="maigret" \
  id-doppelganger
```

Run the database migration once before the first production deployment:

```bash
DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DB" npm run db:migrate
# Vercel/Neon aliases also work:
POSTGRES_URL="postgres://USER:PASSWORD@HOST:5432/DB" npm run db:migrate
```

Before promoting a build, verify the scanner runtime that will serve real public username searches:

```bash
npm run scan:maigret
npm run scan:maigret:live
```

## Single-Host Docker Compose Path
Use `deploy/compose` when you want one repeatable unit for Postgres, migrations, the app container, and HTTPS termination:

```bash
cp .env.launch.example .env.launch
npm run launch:button
npm run launch:button -- --execute --local-gate
npm run launch:button -- --execute --ship
```

`npm run launch:button` is the safe dry run. It loads `.env.launch`, reports missing production values, and redacts secret-like values. Execute mode first runs `npm run assets:all` so store screenshots, marketing images, press-kit ZIPs, and stale-asset checks are fresh. `--execute --local-gate` then runs the local release candidate gate before writing production files. `--execute --ship` prepares the release, verifies `deploy/compose/.env`, starts the Compose stack, finalizes store URLs, refreshes native config, and runs production verification.

The same plan is available in the local browser console at `/launch` after developer login. It is loopback-only, validates and saves allowlisted production values into `.env.launch`, never echoes stored secrets back to the page, and keeps execution disabled until `ENABLE_LAUNCH_CONSOLE=true` is set.

The equivalent manual path is:

```bash
PRODUCTION_DOMAIN="your-domain.example" \
STORE_SUPPORT_EMAIL="support@your-domain.example" \
DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DB" \
CRON_SECRET="your-32-plus-character-random-secret" \
TOSS_CLIENT_KEY="your-live-toss-client-key" \
TOSS_SECRET_KEY="your-live-toss-secret-key" \
TOSS_SECURITY_KEY="your-toss-security-key" \
TOSS_CONSOLE_API_KEY="your-toss-console-api-key" \
TOSS_CONSOLE_APP_ID="your-toss-console-app-id" \
TOSS_MINI_APP_NAME="your-toss-mini-app-name" \
TOSS_ALLOWED_ORIGINS="https://your-toss-mini-app-name.apps.tossmini.com,https://your-toss-mini-app-name.private-apps.tossmini.com" \
WEB_DETAILED_REPORT_PAYWALL_ENABLED="false" \
ALERT_WEBHOOK_URL="https://your-alert-webhook.example" \
ALERT_WEBHOOK_PROVIDER="slack" \
ALERT_RUNBOOK_URL="https://your-runbook.example/id-doppelganger" \
MOBILE_PAYMENTS_ENABLED="true" \
APPLE_BUNDLE_ID="com.iddoppelganger.app" \
APPLE_DETAILED_REPORT_PRODUCT_ID="detailed_report" \
APPLE_ENVIRONMENT="production" \
APPLE_KEY_ID="your-apple-key-id" \
APPLE_ISSUER_ID="your-apple-issuer-id" \
APPLE_PRIVATE_KEY="your-app-store-connect-private-key-p8" \
APPLE_APP_APPLE_ID="your-apple-app-id" \
GOOGLE_PLAY_PACKAGE_NAME="com.iddoppelganger.app" \
GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID="detailed_report" \
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON="your-google-play-service-account-json" \
GOOGLE_PLAY_UPLOAD_KEYSTORE_BASE64="your-google-play-upload-keystore-base64" \
GOOGLE_PLAY_UPLOAD_KEYSTORE_PASSWORD="your-google-play-upload-keystore-password" \
GOOGLE_PLAY_UPLOAD_KEY_ALIAS="upload" \
GOOGLE_PLAY_UPLOAD_KEY_PASSWORD="your-google-play-upload-key-password" \
npm run release:prepare
npm run deploy:verify
DEPLOY_RELEASE_CHECK=true npm run deploy:verify
docker compose --env-file deploy/compose/.env -f deploy/compose/compose.yaml up -d --build
```

Run `npm run assets:all` before the manual path if you are not using `launch:button`; it regenerates store screenshots, marketing launch images, and press-kit ZIPs before verification. `npm run release:production` also re-runs `assets:all` as its first live gate, then runs `store:finalize` before store verification and `mobile:configure` before mobile verification, so stale screenshots, store URLs, native origins, or launch kits cannot slip through the final check.

`npm run release:prepare` generates `deploy/compose/.env`, writes `deploy/compose/PRODUCTION_LAUNCH_RUNBOOK.md`, updates Fastlane and store listing URLs, and points `native-web/app-config.js` at the production HTTPS origin. It exits before writing when required production values are missing. Use `PREPARE_RELEASE_DRY_RUN=true npm run release:prepare` to preview the update list.

The Compose stack includes:

- `postgres`: persistent Postgres 16 storage with a health check
- `migrate`: one-shot `npm run db:migrate`, started after Postgres is healthy
- `app`: the Docker image with `SCAN_PROVIDER=maigret`
- `caddy`: public HTTP/HTTPS reverse proxy for `DOMAIN`
- `prune`: optional maintenance service for `npm run retention:prune`

Point DNS at the host before starting the stack so Caddy can provision TLS for `DOMAIN`. Keep `deploy/compose/.env` out of version control.

Run expired retention cleanup from the host scheduler:

```bash
docker compose --env-file deploy/compose/.env -f deploy/compose/compose.yaml run --rm prune
```

## Cloudtype Path
Cloudtype can run the web/API container and a PostgreSQL service. Use the repository `Dockerfile` service for Maigret support, create PostgreSQL as a separate Cloudtype database service, then set `DATABASE_URL` on the web/API service. Native iOS and Android apps are still built, signed, and submitted through App Store Connect / Google Play; they only use Cloudtype as the backend origin through `MOBILE_APP_ORIGIN`.

Detailed Cloudtype setup is in [cloudtype-deployment.md](cloudtype-deployment.md).

## Vercel Path
Vercel is suitable for the web app, policy pages, Toss route, and API shell. For real Maigret scans, use one of these:

- Deploy the Docker image to a container platform and point `SCAN_PROVIDER=maigret`.
- Keep Vercel as the frontend and add a separate scan worker service in a later slice.
- Use `SCAN_PROVIDER=mock` only for demos and smoke tests.

For the public Vercel beta, keep `SCAN_PROVIDER=maigret`. Vercel installs Maigret from `requirements.txt` and the Node scan route calls the Python function at `/api/maigret_scan` for real CLI output. `vercel.json` also points the JSON stores at `/tmp` so the first scan response can complete on Vercel, sets `INLINE_SCAN_ARTIFACTS=true` so the browser can render details even when later serverless functions cannot read the same `/tmp` file, schedules daily `/api/cron/prune` and `/api/cron/monitoring` invocations, and sets beta free searches to 5 per request identity and browser owner token over 24 hours by default. The daily cron cadence is intentional so the configuration stays compatible with Vercel Hobby limits. Clearing local storage or changing the browser owner token does not reset the request-identity quota. Change the limit from `/admin` after signing in with the developer admin account. That storage is not durable and is not a substitute for Postgres; stable detailed reports, orders, monitoring, quota settings, and deletion audits require a managed Postgres URL. The runtime accepts `DATABASE_URL` first, then Vercel/Neon-style `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, or `POSTGRES_URL_NON_POOLING`. Set `CRON_SECRET` in Vercel so cron invocations include the bearer authorization header expected by both cron routes.

To let Vercel create and connect the database, use the CLI setup plan:

```bash
npm run vercel:db
npm run vercel:db -- --execute
```

The dry run shows the Marketplace Postgres provisioning command, production env pull, `vercel env run -e production -- npm run db:migrate`, production deploy, and `vercel:production` verification. It defaults to Neon on the free provider plan and can be adjusted with `--integration`, `--plan`, `--metadata`, or `--interactive-plan`.

After each Vercel beta deployment, run the beta smoke. It verifies security headers, policy pages, sitemap/robots/manifest, the real scan path, beta inline report rendering, and product-branded embedded source reports:

```bash
SMOKE_BASE_URL="https://iddopel.vercel.app" npm run smoke:vercel-beta
```

## Required Environment Variables
- `PRODUCTION_DOMAIN`: final public domain. `launch:button` derives `SITE_URL`, `PRODUCTION_BASE_URL`, `SMOKE_BASE_URL`, `STORE_PRODUCTION_ORIGIN`, and `MOBILE_APP_ORIGIN` from it.
- `DATABASE_URL`: production Postgres connection string
- `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`: optional Vercel/Neon-style Postgres aliases. Used only when `DATABASE_URL` is absent.
- `DATABASE_SSL`: `true` if the provider requires TLS verification
- `CRON_SECRET`: random secret used by `/api/cron/prune` and `/api/cron/monitoring`
- `REPORT_TOKEN_SECRET`: random secret used to sign detailed-report access tokens
- `FIRST_FREE_FINGERPRINT_SECRET`: separate random secret used to bind the one-time free detailed report to a request/browser identity
- `MONITORING_CRON_LIMIT`: maximum monitoring subscriptions processed by one `/api/cron/monitoring` run
- `SITE_URL`: production origin used for Toss success/fail URLs
- `SCAN_PROVIDER`: `maigret` for Vercel, Docker, and Cloudtype real scans. `mock` must be used only for private smoke tests and demos.
- `BETA_FREE_SCAN_LIMIT`: default non-admin free search quota, `5` for beta.
- `BETA_FREE_SCAN_WINDOW_HOURS`: quota window in hours, `24` for beta.
- `BETA_SCAN_SETTINGS_STORE_PATH`: file path for `/admin` quota settings when Postgres is absent. With any supported Postgres URL, quota settings are stored in `beta_scan_settings`.
- `BETA_SCAN_USAGE_STORE_PATH`: file path for beta free search usage counts when Postgres is absent. With any supported Postgres URL, quota usage is stored in `beta_scan_usage`.
- `ENABLE_DEV_ADMIN`: set `true` only with `DEV_ADMIN_PASSWORD` and `DEV_ADMIN_SECRET` so `/admin` can manage beta quota.
- `DEV_ADMIN_PASSWORD`: required before public `/admin` login is enabled.
- `DEV_ADMIN_SECRET`: signing secret for developer admin tokens.
- `MAIGRET_BIN`: CLI binary path, usually `maigret`
- `MAIGRET_TOP_SITES_QUICK`: free scan scope, default `100`
- `MAIGRET_TOP_SITES_DEEP`: paid/deep scan scope, default `500`
- `MAIGRET_PROCESS_TIMEOUT_MS`: process kill timeout
- `MAIGRET_MAX_CONNECTIONS`: Maigret concurrent connection limit; keep it low on Vercel serverless functions
- `MAIGRET_EXTRACT_EXTENDED`: set `false` on Vercel to reduce Maigret memory and network pressure
- `MAIGRET_API_SECRET`: required shared secret for public Vercel production so the Node scan route can call the Python Maigret function with `x-maigret-api-secret`
- `INLINE_SCAN_ARTIFACTS`: `true` only for Vercel beta without Postgres; keep false when durable report storage and paid web reports are enabled
- `PAYMENT_PROVIDER`: `toss` or `polar` for live web checkout
- `WEB_DETAILED_REPORT_PAYWALL_ENABLED`: keep `false` only for a free beta; set `true` after live checkout is ready to require checkout for detailed web reports
- `MONITORING_PAYWALL_ENABLED`: keep `false` only for a free beta; set `true` after the monthly monitoring checkout product is ready
- `TOSS_CLIENT_KEY`: Toss Payments live client key starting with `live_ck_`, required when `PAYMENT_PROVIDER=toss`
- `TOSS_SECRET_KEY`: Toss Payments live API secret key starting with `live_sk_`, required when `PAYMENT_PROVIDER=toss`
- `TOSS_SECURITY_KEY`: Toss Payments 64-character security key, required when `PAYMENT_PROVIDER=toss`
- `POLAR_ACCESS_TOKEN`: Polar organization access token, required when `PAYMENT_PROVIDER=polar`
- `POLAR_PRODUCT_ID`: Polar detailed-report product id, required when `PAYMENT_PROVIDER=polar`
- `POLAR_MONTHLY_MONITORING_PRODUCT_ID`: Polar monthly-monitoring product id, required when `PAYMENT_PROVIDER=polar`
- `POLAR_WEBHOOK_SECRET`: 32+ character Polar webhook signing secret, required when `PAYMENT_PROVIDER=polar`
- `POLAR_SERVER`: `production` for live Polar checkout, `sandbox` only for sandbox testing
- `TOSS_CONSOLE_API_KEY`: Apps in Toss console/AX release automation API key; keep it in the secret manager and never expose it to the client
- `TOSS_CONSOLE_APP_ID`: Toss developer console app id
- `TOSS_MINI_APP_NAME`: Toss mini app slug used to derive standard Toss origins
- `TOSS_ALLOWED_ORIGINS`: comma-separated live and private `tossmini.com` origins
- `ENABLE_MOCK_PAYMENTS`: keep `false` in production and beta; set `true` only on local/E2E servers that intentionally exercise `/api/payments/mock/confirm`
- `TELEMETRY_DISABLED`: keep unset or `false` for launch monitoring
- `NEXT_PUBLIC_TELEMETRY_DISABLED`: keep unset or `false` so the browser reports page views, Core Web Vitals, and client errors
- `RELEASE_VERSION`: release identifier included in structured telemetry logs
- `ALERT_WEBHOOK_URL`: HTTPS Slack, Discord, or generic webhook for launch alert routing
- `ALERT_WEBHOOK_PROVIDER`: `generic`, `slack`, or `discord`
- `ALERT_WEBHOOK_TIMEOUT_MS`: alert webhook timeout, between `250` and `5000`
- `ALERT_RUNBOOK_URL`: HTTPS runbook link included in every alert payload
- `PRODUCTION_BASE_URL`: deployed HTTPS origin used by `npm run verify:production` runtime checks
- `SMOKE_BASE_URL`: deployed HTTPS origin used by `npm run smoke:release` and `npm run smoke:vercel-beta`
- `STORE_PRODUCTION_ORIGIN`: public HTTPS origin written into App Store / Google Play metadata
- `STORE_SUPPORT_EMAIL`: final store support email
- `MOBILE_APP_ORIGIN`: production HTTPS API origin embedded into native shell config
- `MOBILE_PAYMENTS_ENABLED`: set `true` for store release builds after Apple IAP and Google Play Billing products are created
- `APPLE_BUNDLE_ID`: App Store bundle id, currently `com.iddoppelganger.app`
- `APPLE_DETAILED_REPORT_PRODUCT_ID`: App Store one-time detailed report product id, currently `detailed_report`
- `APPLE_ENVIRONMENT`: `sandbox` for TestFlight checks, `production` for live App Store verification
- `APPLE_KEY_ID`: App Store Connect API key id for metadata upload and receipt verification
- `APPLE_ISSUER_ID`: App Store Connect issuer id
- `APPLE_PRIVATE_KEY`: App Store Connect `.p8` private key value
- `APPLE_APP_APPLE_ID`: numeric Apple app id from App Store Connect
- `GOOGLE_PLAY_PACKAGE_NAME`: Google Play package name, currently `com.iddoppelganger.app`
- `GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID`: Google Play one-time detailed report product id, currently `detailed_report`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: Android Publisher service account JSON for Google Play release checks
- `GOOGLE_PLAY_UPLOAD_KEYSTORE_BASE64`: base64-encoded Google Play upload keystore for CI/release signing
- `GOOGLE_PLAY_UPLOAD_KEYSTORE_PASSWORD`: upload keystore password
- `GOOGLE_PLAY_UPLOAD_KEY_ALIAS`: upload key alias, for example `upload`
- `GOOGLE_PLAY_UPLOAD_KEY_PASSWORD`: upload key password

## Runtime Assets
- `public/fonts/NotoSansCJKkr-Regular.otf` is required for Korean PDF report generation.
- The bundled Noto CJK font is licensed under SIL Open Font License 1.1; keep the asset when building Docker or deploying to a Node runtime.
- If the font is missing, `/api/scans/{scanId}/report.pdf` will fail instead of returning a broken Korean PDF.

## Smoke Test
Summarize launch readiness before every release candidate:

```bash
npm run assets:all
npm run scan:maigret
npm run launch:readiness
LAUNCH_RELEASE_CHECK=true npm run launch:readiness
```

The default mode passes when the local package, scripts, docs, env template, and checklist structure are internally ready. `LAUNCH_RELEASE_CHECK=true` also fails on external blockers such as production DNS, secrets, store credentials, live Toss payment verification, and release-branch CI.

Check the runtime health endpoint:

```bash
curl -sS http://localhost:3000/api/health
```

Run the release smoke script against a local or staging candidate URL where mock payments are intentionally enabled on the server:

```bash
SMOKE_BASE_URL="https://your-domain.example" npm run smoke:release
```

For beta or production URLs where mock payment confirmation is disabled, smoke the locked-report path without granting a report token:

```bash
SMOKE_BASE_URL="https://your-domain.example" SMOKE_CONFIRM_PAYMENT=skip npm run smoke:release
```

Run browser smoke tests against a built release candidate. The Playwright config starts `next start` automatically when `E2E_BASE_URL` is not already serving. This covers responsive landing widths, paid report unlocking, PDF delivery, and landing-page scan deletion:

```bash
npm run e2e:install
npm run build
npm run e2e
```

Run the production preflight after setting deployment secrets and again after the domain is live. `REPORT_TOKEN_SECRET` and `FIRST_FREE_FINGERPRINT_SECRET` must be different 32+ character random values:

```bash
PRODUCTION_BASE_URL="https://your-domain.example" npm run verify:production
```

The preflight verifies production env shape, security headers, `/api/health`, first-party telemetry, and the authorized prune and monitoring cron endpoints when `CRON_SECRET` is present.

Test the alert route before public launch:

```bash
ALERT_WEBHOOK_URL="https://your-alert-webhook.example" \
ALERT_WEBHOOK_PROVIDER="slack" \
ALERT_RUNBOOK_URL="https://your-runbook.example/id-doppelganger" \
npm run alerts:test
```

For Toss in-app release, run the local and release checks after the Toss console app is created:

```bash
npm run toss:verify
TOSS_RELEASE_CHECK=true npm run toss:verify
```

Set `TOSS_MINI_APP_NAME` or `TOSS_ALLOWED_ORIGINS` so the API allows both `https://<appName>.apps.tossmini.com` and `https://<appName>.private-apps.tossmini.com`.

Check launch SEO metadata after the final `SITE_URL` is live:

```bash
curl -sS https://your-domain.example/sitemap.xml
curl -sS https://your-domain.example/robots.txt
```

The sitemap includes the home, policy, Toss, and SEO guide landing routes. Robots allows public marketing pages and disallows `/api/`, `/checkout/`, and `/reports/`.

## Launch Monitoring
- Client page views, Core Web Vitals, and JavaScript errors are posted to `/api/telemetry`.
- The endpoint writes structured JSON logs with `event: "id_doppelganger_telemetry"`, `requestId`, `release`, `environment`, event name, path, and bounded metric/error fields.
- When `ALERT_WEBHOOK_URL` is configured, `client_error`, `unhandled_rejection`, and `poor` Web Vital events are also posted to the alert channel with the request id and runbook link.
- Telemetry intentionally excludes raw search input, payment keys, report tokens, cookies, and full URLs with query strings.
- Filter deployment logs for `id_doppelganger_telemetry` during the first launch hour and watch for new `client_error` or `unhandled_rejection` events.
- If the alert webhook fails, the server writes `id_doppelganger_alert_delivery_failed` with the original telemetry `requestId`; this should page the deploy owner during launch monitoring.

For production Toss checkout where mock payment confirmation is disabled, run:

```bash
SMOKE_BASE_URL="https://your-domain.example" SMOKE_CONFIRM_PAYMENT=skip npm run smoke:release
```

```bash
curl -sS -X POST http://localhost:3000/api/scans \
  -H "Content-Type: application/json" \
  -d '{"username":"khstar104","purpose":"self_check","mode":"quick"}'
```

Create a report order after a scan:

```bash
curl -sS -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"scanId":"scan_xxx"}'
```

## Rollback
If Maigret starts timing out or a platform blocks the worker IP in production, roll back to the previous working deployment or temporarily disable the scan entry point while the scanner is repaired. Keep `SCAN_PROVIDER=mock` limited to private smoke tests and demos.
