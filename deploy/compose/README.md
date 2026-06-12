# Docker Compose Deployment

This stack is the single-host production path for the web service. It runs:

- `postgres`: persistent Postgres 16 storage
- `migrate`: one-shot schema migration before the app starts
- `app`: the Dockerized Next.js service with Maigret enabled
- `caddy`: HTTPS reverse proxy for the public domain
- `prune`: optional maintenance job for expired scan retention cleanup
- `monitoring-cron`: optional maintenance job that calls `/api/cron/monitoring`

## Configure

```bash
cp deploy/compose/.env.example deploy/compose/.env
```

Edit `deploy/compose/.env` and replace every placeholder. Use a URL-safe `POSTGRES_PASSWORD`, because the stack interpolates it into `DATABASE_URL`. Keep `REPORT_TOKEN_SECRET` and `FIRST_FREE_FINGERPRINT_SECRET` as separate 32+ character random values.

Before starting production, validate the config:

```bash
npm run deploy:verify
DEPLOY_RELEASE_CHECK=true npm run deploy:verify
```

`DEPLOY_RELEASE_CHECK=true` reads `deploy/compose/.env` instead of `.env.example` and fails on placeholder domains, short secrets, mock payment settings, or an invalid Compose model.

When `npm run release:prepare` is run with final production values, it also writes `deploy/compose/PRODUCTION_LAUNCH_RUNBOOK.md`. That runbook contains the exact non-secret launch commands for the finalized domain, Toss mini-app origin, store metadata, native config, smoke tests, and rollback path.

You can drive the same flow from the launch button instead of running each command manually:

```bash
cp .env.launch.example .env.launch
npm run launch:button
npm run launch:button -- --execute --ship
```

The first command is a dry run that redacts secret-like values. The ship command prepares production files, validates this Compose config, starts the stack, and runs live verification.

Before using `--execute --ship`, fill `.env.launch` with the production domain, Postgres URL, cron/report secrets, Toss Payments values, alert webhook/runbook, App Store Connect key fields, Apple app id, and Google Play service account JSON. Values derived from `PRODUCTION_DOMAIN` such as `SITE_URL`, `SMOKE_BASE_URL`, `STORE_PRODUCTION_ORIGIN`, and `MOBILE_APP_ORIGIN` are filled by the launch button automatically.

When the app is running locally, `/launch` shows the same launch plan after developer login. It validates and saves allowlisted production values into `.env.launch`, but command execution stays disabled unless `ENABLE_LAUNCH_CONSOLE=true` is present on that local process.

## Start

```bash
docker compose --env-file deploy/compose/.env -f deploy/compose/compose.yaml up -d --build
```

Caddy provisions HTTPS for `DOMAIN`, then proxies traffic to the app. Point DNS A/AAAA records at the host before running the production stack.

## Verify

```bash
PRODUCTION_BASE_URL="$SITE_URL" npm run verify:production
SMOKE_BASE_URL="$SITE_URL" SMOKE_CONFIRM_PAYMENT=skip npm run smoke:release
```

Use `SMOKE_CONFIRM_PAYMENT=skip` for production Toss keys unless you are intentionally completing a test-key payment.

For Apps in Toss, set `TOSS_CONSOLE_APP_ID`, `TOSS_MINI_APP_NAME`, `TOSS_ALLOWED_ORIGINS`, and the review scenario fields before upload. The app service uses those values to allow the live Toss origin `https://<appName>.apps.tossmini.com` and the QR/private test origin `https://<appName>.private-apps.tossmini.com`.

## Maintenance

Run expired scan retention cleanup manually:

```bash
docker compose --env-file deploy/compose/.env -f deploy/compose/compose.yaml run --rm prune
```

Run due monthly monitoring re-checks manually:

```bash
docker compose --env-file deploy/compose/.env -f deploy/compose/compose.yaml run --rm monitoring-cron
```

For production, schedule those commands from host cron or a scheduler. Keep `/api/cron/prune` and `/api/cron/monitoring` available for hosted schedulers that call the app over HTTPS with `Authorization: Bearer <CRON_SECRET>`.

## Rollback

If the scanner is causing production failures, set `SCAN_PROVIDER=mock` in `deploy/compose/.env` and restart `app` while keeping the payment/report/policy surfaces online:

```bash
docker compose --env-file deploy/compose/.env -f deploy/compose/compose.yaml up -d app
```
