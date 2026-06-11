# ID 도플갱어

ID 도플갱어는 아이디 문자열이 공개 플랫폼 어디에 남아 있는지 먼저 보여주고, 희소성·노출도·사칭 가능성·방치 계정 위험은 마지막 참고 분석으로 정리하는 한국어 웹/앱 서비스입니다.

이 저장소는 웹 배포, Toss 인앱, App Store, Google Play 제출 준비물을 한 번에 관리합니다. 현재 로컬 패키지는 출시 준비 상태로 검증 가능하지만, 실제 배포 버튼을 누르기 전에는 도메인, 결제 키, 스토어 계정, 네이티브 인앱상품 같은 외부 값이 필요합니다.

## Surfaces

- Web/PWA: `/`
- Toss in-app route: `/toss`
- Paid report checkout: `/checkout/{orderId}`
- Paid report viewer: `/reports/{scanId}`
- Native shell: `native-web/`
- Android project: `android/`
- iOS project: `ios/`

## Local Verification

Local search now requires Maigret for real public username scanning. This workspace uses a local virtualenv:

```bash
python -m venv .maigret-venv
./.maigret-venv/Scripts/python.exe -m pip install maigret
```

`.env.local` points `MAIGRET_BIN` at that local executable and sets `SCAN_PROVIDER=maigret`, so a missing or failing Maigret install fails the scan instead of showing deterministic fallback data. Vercel runs the same real scanner through the Python function at `/api/maigret_scan`, installed from `requirements.txt`. Use `SCAN_PROVIDER=mock` only for automated smoke tests or demos.

Verify the scanner runtime explicitly:

```bash
npm run scan:maigret
npm run scan:maigret:live
```

`scan:maigret` checks that the effective provider is `maigret` and that the CLI responds. `scan:maigret:live` also runs a tiny public Maigret scan and verifies that a simple JSON report is generated.

Run the full local release candidate gate:

```bash
npm run release:local
```

That command regenerates store screenshots, marketing images, press-kit ZIPs, verifies release assets, and runs the same checks listed below:

```bash
npm run verify
npm run scan:maigret
npm run code:hygiene
npm run product:verify
npm run security:audit
npm run security:secrets
npm run e2e
npm run assets:all
npm run store:verify
npm run privacy:verify
npm run toss:verify
npm run mobile:verify
npm run android:debug
npm run android:bundle
npm run deploy:verify
npm run launch:readiness
```

`npm run launch:readiness` must report `localReady: true`. `releaseReady: false` is expected until production domain, secrets, store credentials, and native purchase products are configured.

For local repeated testing, the scanner exposes a localhost-only developer login on the landing page. The default local account is `admin` / `admin`; set `DEV_ADMIN_USERNAME`, `DEV_ADMIN_PASSWORD`, and `DEV_ADMIN_SECRET` to override it. Developer mode bypasses scan throttling and report payment locks only on localhost unless `ENABLE_DEV_ADMIN=true` is explicitly set.

The consumer flow grants the first detailed report once per browser owner token. After that, the free screen shows preview rows plus blurred locked rows until the user opens the paid report checkout. Result screens also expose a sanitized PNG share card with only score/count context, not platform URLs or profile details.

Preview the launch button without shipping anything:

```bash
cp .env.launch.example .env.launch
npm run launch:button
```

Edit `.env.launch` with the real production domain, database, Toss, alert, and store values. Keep that file local. The dry run prints the exact release steps and redacts secret-like values before any command can run.

For the clickable operator console, run the app locally and open `/launch`:

```bash
npm run dev
```

Log in with the local developer account, then review the same redacted launch plan in the browser. The console keeps command execution locked unless the app is running on loopback with `ENABLE_LAUNCH_CONSOLE=true`.
The console can also validate and save allowed production values into `.env.launch`; existing secret values are never echoed back to the page and are preserved unless you enter a replacement.

## Web Production

Use the launch button for the single-host Docker Compose production package:

```bash
npm run launch:button
npm run launch:button -- --execute --local-gate
npm run launch:button -- --execute --ship
```

`npm run launch:button` is a dry run. Execute mode first runs `npm run assets:all` so store screenshots, marketing images, press-kit ZIPs, and stale-asset checks are fresh. `--execute --local-gate` also runs the full local release gate before generating production files. `--execute --ship` prepares production files, verifies the Compose release config, starts the Docker Compose stack, and runs production verification.

The underlying manual commands are:

```bash
PRODUCTION_DOMAIN="YOUR_DOMAIN" \
STORE_SUPPORT_EMAIL="support@YOUR_DOMAIN" \
DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DB" \
CRON_SECRET="YOUR_32_PLUS_CHARACTER_RANDOM_SECRET" \
TOSS_CLIENT_KEY="YOUR_TOSS_CLIENT_KEY" \
TOSS_SECRET_KEY="YOUR_TOSS_SECRET_KEY" \
TOSS_SECURITY_KEY="YOUR_TOSS_SECURITY_KEY" \
TOSS_CONSOLE_API_KEY="YOUR_TOSS_CONSOLE_API_KEY" \
TOSS_CONSOLE_APP_ID="YOUR_TOSS_CONSOLE_APP_ID" \
TOSS_MINI_APP_NAME="YOUR_TOSS_MINI_APP_NAME" \
TOSS_ALLOWED_ORIGINS="https://YOUR_TOSS_APP_NAME.apps.tossmini.com,https://YOUR_TOSS_APP_NAME.private-apps.tossmini.com" \
WEB_DETAILED_REPORT_PAYWALL_ENABLED="false" \
ALERT_WEBHOOK_URL="https://YOUR_ALERT_WEBHOOK" \
ALERT_WEBHOOK_PROVIDER="slack" \
ALERT_RUNBOOK_URL="https://YOUR_RUNBOOK_URL" \
MOBILE_PAYMENTS_ENABLED="true" \
APPLE_BUNDLE_ID="com.iddoppelganger.app" \
APPLE_DETAILED_REPORT_PRODUCT_ID="detailed_report" \
APPLE_ENVIRONMENT="production" \
APPLE_KEY_ID="YOUR_APPLE_KEY_ID" \
APPLE_ISSUER_ID="YOUR_APPLE_ISSUER_ID" \
APPLE_PRIVATE_KEY="YOUR_APP_STORE_CONNECT_PRIVATE_KEY_P8" \
APPLE_APP_APPLE_ID="YOUR_APP_APPLE_ID" \
GOOGLE_PLAY_PACKAGE_NAME="com.iddoppelganger.app" \
GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID="detailed_report" \
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON="YOUR_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON" \
npm run release:prepare
npm run deploy:verify
DEPLOY_RELEASE_CHECK=true npm run deploy:verify
docker compose --env-file deploy/compose/.env -f deploy/compose/compose.yaml up -d --build
```

`npm run release:prepare` writes `deploy/compose/.env`, `deploy/compose/PRODUCTION_LAUNCH_RUNBOOK.md`, production store URLs, and `native-web/app-config.js` together. It refuses to write partial production files when required external values are missing. Use `PREPARE_RELEASE_DRY_RUN=true npm run release:prepare` to preview the file list without writing.

Before starting the stack, confirm real values in `deploy/compose/.env`:

- `DOMAIN`
- `SITE_URL`
- `POSTGRES_PASSWORD`
- `CRON_SECRET`
- `SCAN_PROVIDER=maigret`
- `PAYMENT_PROVIDER=toss`
- `ENABLE_MOCK_PAYMENTS=false`
- `WEB_DETAILED_REPORT_PAYWALL_ENABLED=false` for beta. Switch to `true` only after Toss web checkout is ready.
- `TOSS_CLIENT_KEY`
- `TOSS_SECRET_KEY`
- `TOSS_SECURITY_KEY`
- `TOSS_CONSOLE_API_KEY`
- `TOSS_CONSOLE_APP_ID`
- `TOSS_MINI_APP_NAME`
- `TOSS_ALLOWED_ORIGINS`
- `MOBILE_APP_ORIGIN`
- `MOBILE_PAYMENTS_ENABLED=true`
- `APPLE_BUNDLE_ID=com.iddoppelganger.app`
- `APPLE_DETAILED_REPORT_PRODUCT_ID`
- `APPLE_ENVIRONMENT=production`
- `ALERT_WEBHOOK_URL`
- `ALERT_WEBHOOK_PROVIDER`
- `ALERT_RUNBOOK_URL`
- `APPLE_KEY_ID`
- `APPLE_ISSUER_ID`
- `APPLE_PRIVATE_KEY`
- `APPLE_APP_APPLE_ID`
- `GOOGLE_PLAY_PACKAGE_NAME=com.iddoppelganger.app`
- `GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

After the domain is live:

```bash
npm run release:production
```

For Vercel beta, the repository `vercel.json` sets `SCAN_PROVIDER=maigret`, installs Maigret from `requirements.txt`, and routes scans through the Python function at `/api/maigret_scan` with serverless-safe Maigret limits. It also uses `/tmp` JSON stores so the first scan response does not fail on a read-only serverless filesystem, keeps mock payment confirmation disabled, and leaves the web detailed-report paywall off. Set `MAIGRET_API_SECRET` in Vercel to protect the Python function from direct public use. `/tmp` is not durable; use Postgres for stable detailed reports, orders, monitoring, and deletion audits. For Cloudtype, use the Dockerfile web/API service plus a separate Cloudtype PostgreSQL service. The native apps are still built and submitted through App Store Connect / Google Play; they point at the Cloudtype HTTPS origin via `MOBILE_APP_ORIGIN`. See [docs/cloudtype-deployment.md](docs/cloudtype-deployment.md).

After a Vercel beta deployment, verify the real scan path:

```bash
SMOKE_BASE_URL="https://iddopel.vercel.app" npm run smoke:vercel-beta
```

That command assumes `release:prepare`, `deploy:verify`, and the Compose startup above have already completed. It first regenerates and verifies release assets with `npm run assets:all`, then runs the live scanner, code, security, deployment, migration, runtime, Toss, store URL finalization, store verification, native config generation, mobile verification, Android, and release-readiness checks. The full manual sequence is:

```bash
PRODUCTION_DOMAIN="YOUR_DOMAIN" STORE_SUPPORT_EMAIL="support@YOUR_DOMAIN" DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DB" CRON_SECRET="YOUR_32_PLUS_CHARACTER_RANDOM_SECRET" TOSS_CLIENT_KEY="YOUR_TOSS_CLIENT_KEY" TOSS_SECRET_KEY="YOUR_TOSS_SECRET_KEY" TOSS_SECURITY_KEY="YOUR_TOSS_SECURITY_KEY" TOSS_CONSOLE_API_KEY="YOUR_TOSS_CONSOLE_API_KEY" TOSS_CONSOLE_APP_ID="YOUR_TOSS_CONSOLE_APP_ID" TOSS_MINI_APP_NAME="YOUR_TOSS_MINI_APP_NAME" TOSS_ALLOWED_ORIGINS="https://YOUR_TOSS_APP_NAME.apps.tossmini.com,https://YOUR_TOSS_APP_NAME.private-apps.tossmini.com" WEB_DETAILED_REPORT_PAYWALL_ENABLED="false" ALERT_WEBHOOK_URL="https://YOUR_ALERT_WEBHOOK" ALERT_WEBHOOK_PROVIDER="slack" ALERT_RUNBOOK_URL="https://YOUR_RUNBOOK_URL" MOBILE_PAYMENTS_ENABLED="true" APPLE_BUNDLE_ID="com.iddoppelganger.app" APPLE_DETAILED_REPORT_PRODUCT_ID="detailed_report" APPLE_ENVIRONMENT="production" APPLE_KEY_ID="YOUR_APPLE_KEY_ID" APPLE_ISSUER_ID="YOUR_APPLE_ISSUER_ID" APPLE_PRIVATE_KEY="YOUR_APP_STORE_CONNECT_PRIVATE_KEY_P8" APPLE_APP_APPLE_ID="YOUR_APP_APPLE_ID" GOOGLE_PLAY_PACKAGE_NAME="com.iddoppelganger.app" GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID="detailed_report" GOOGLE_PLAY_SERVICE_ACCOUNT_JSON="YOUR_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON" npm run release:prepare
DEPLOY_RELEASE_CHECK=true npm run deploy:verify
npm run assets:all
npm run scan:maigret
npm run code:hygiene
npm run security:audit
npm run security:secrets
DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DB" npm run db:migrate
PRODUCTION_BASE_URL="https://YOUR_DOMAIN" npm run verify:production
ALERT_WEBHOOK_URL="https://YOUR_ALERT_WEBHOOK" ALERT_WEBHOOK_PROVIDER="slack" ALERT_RUNBOOK_URL="https://YOUR_RUNBOOK_URL" npm run alerts:test
SMOKE_BASE_URL="https://YOUR_DOMAIN" SMOKE_CONFIRM_PAYMENT=skip npm run smoke:release
TOSS_RELEASE_CHECK=true npm run toss:verify
npm run store:finalize
STORE_RELEASE_CHECK=true npm run store:verify
npm run mobile:configure
MOBILE_RELEASE_CHECK=true npm run mobile:verify
npm run android:bundle
LAUNCH_RELEASE_CHECK=true npm run launch:readiness
```

For beta and production, keep automated smoke checks in locked-report mode while mock payment confirmation is disabled:

```bash
SMOKE_BASE_URL="https://YOUR_DOMAIN" SMOKE_CONFIRM_PAYMENT=skip npm run smoke:release
```

For a local mock-payment smoke test, run the server with `ENABLE_MOCK_PAYMENTS=true` and `PAYMENT_PROVIDER=mock`, then run `npm run smoke:release` against that local URL.

## Toss In-App

Prepare the Toss console app, production origin, mini-app name, review scenario, and Toss Payments secret key. Then run:

```bash
npm run toss:verify
TOSS_RELEASE_CHECK=true npm run toss:verify
```

Submission notes are in `docs/toss-submission.md`.

## App Store And Google Play

`npm run launch:button -- --execute --ship` and `npm run release:production` finalize store URLs and native config automatically when the production env is present. For a manual store-only refresh after the production domain changes:

```bash
STORE_PRODUCTION_ORIGIN="https://YOUR_DOMAIN" \
STORE_SUPPORT_EMAIL="support@YOUR_DOMAIN" \
APPLE_KEY_ID="YOUR_APPLE_KEY_ID" \
APPLE_ISSUER_ID="YOUR_APPLE_ISSUER_ID" \
APPLE_PRIVATE_KEY="YOUR_APP_STORE_CONNECT_PRIVATE_KEY_P8" \
APPLE_APP_APPLE_ID="YOUR_APP_APPLE_ID" \
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON="YOUR_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON" \
npm run store:finalize
npm run store:verify
STORE_RELEASE_CHECK=true npm run store:verify
```

Native release builds must point at the production HTTPS origin:

```bash
MOBILE_APP_ORIGIN="https://YOUR_DOMAIN" npm run mobile:configure
MOBILE_RELEASE_CHECK=true npm run mobile:verify
npm run android:debug
npm run android:bundle
```

Native paid reports must stay disabled until Apple IAP and Google Play Billing products, receipt verification credentials, sandbox purchases, restore flow, and review notes are complete. The native bridge is already wired through StoreKit and Play Billing; see `docs/mobile-packaging.md`.

## Store Assets

Assets and metadata are generated and verified with:

```bash
npm run assets:store
npm run assets:marketing
npm run assets:all
npm run assets:verify
npm run privacy:verify
```

Prepared assets live under `store-assets/`, `fastlane/metadata/`, `fastlane/screenshots/`, and `docs/marketing/assets/`. `assets:marketing` regenerates the Product Hunt/social/press images and refreshes `docs/marketing/id-doppelganger-press-kit.zip` plus `docs/marketing/id-doppelganger-launch-kit-v2.zip`.

## Operational Checks

Before launch:

```bash
npm run launch:readiness
LAUNCH_RELEASE_CHECK=true npm run launch:readiness
```

After launch:

- Verify `/api/health` returns 200.
- Check production logs for `id_doppelganger_telemetry`.
- Run `npm run alerts:test` and confirm the launch alert reaches the intended channel.
- Confirm `/api/cron/prune` and `/api/cron/monitoring` run with `CRON_SECRET`.
- Check `sitemap.xml` and `robots.txt` on the final domain.
- Run one manual scan, delete the record, and verify no raw sensitive input is logged.

## Rollback

If Maigret is slow or blocked in production, roll back to the previous working deployment or temporarily disable the scan entry point while the scanner is repaired. Keep `SCAN_PROVIDER=mock` limited to private smoke tests and demos.

If payment/report checkout fails, disable paid conversion CTAs or switch the deployment back to the previous image, then verify `/api/health`, `/`, `/toss`, and `/api/scans` recover.
