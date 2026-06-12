# Vercel Production

Use this only when the Vercel beta is being promoted to paid production. The beta can keep `/tmp` storage and inline artifacts; production cannot.

## Provision Postgres With Vercel CLI

Use this path when you want Vercel to create and connect the managed Postgres resource instead of pasting a separate `DATABASE_URL` manually:

```bash
npm run vercel:db
npm run vercel:db -- --execute
```

The default plan is a dry run. It prints the exact sequence before touching Vercel:

1. `vercel link` if the workspace is not already linked.
2. `vercel integration add neon --plan free` to provision a Marketplace Postgres resource and connect it to production.
3. `vercel env pull .vercel/.env.production.local --environment=production --yes` to inspect the injected Postgres aliases locally.
4. `vercel env run -e production -- npm run db:migrate` to run migrations with Vercel-held credentials.
5. `vercel deploy --prod`.
6. `vercel env run -e production -- npm run vercel:production`.

In non-interactive terminals, set `VERCEL_TOKEN` before using `--execute`. Vercel CLI also supports `--token`, but the environment variable keeps the token out of generated command text.

Useful variants:

```bash
npm run vercel:db -- --plan free
npm run vercel:db -- --interactive-plan
npm run vercel:db -- --skip-provision
npm run vercel:db -- --skip-deploy
npm run vercel:db -- --execute --skip-verify
```

The default integration is Neon because it is the Postgres provider surfaced through Vercel Marketplace storage. Use `--integration` and `--metadata` if the selected Marketplace provider or region changes. Use `--skip-verify` only for the free beta phase; paid production should keep the final `vercel:production` gate.

## Prepare Env

1. Fill `.env.launch` from `.env.launch.example`.
2. Run:

```bash
npm run vercel:prepare
```

The command prints a redacted plan and one `vercel env add` command per key. Secret values are not printed. For each listed key, create a local file under `.vercel-env/production/KEY` with the value, then run the matching command:

```bash
vercel env add DATABASE_URL production --sensitive < .vercel-env/production/DATABASE_URL
vercel env add CRON_SECRET production --sensitive < .vercel-env/production/CRON_SECRET
```

Keep `.vercel-env/` uncommitted. Vercel documents this stdin form for `vercel env add`, and the generated commands mark secret-like keys with `--sensitive` so Vercel hides them in the dashboard.

## Required Production Shape

- Durable Postgres is configured with `DATABASE_URL` or a supported Vercel Postgres alias.
- `CRON_SECRET`, `REPORT_TOKEN_SECRET`, `FIRST_FREE_FINGERPRINT_SECRET`, and `MAIGRET_API_SECRET` are unique random secrets.
- `SCAN_PROVIDER=maigret`.
- `INLINE_SCAN_ARTIFACTS=false`.
- `PAYMENT_PROVIDER=toss` or `PAYMENT_PROVIDER=polar`.
- `ENABLE_MOCK_PAYMENTS=false`.
- `WEB_DETAILED_REPORT_PAYWALL_ENABLED=true`.
- `MONITORING_PAYWALL_ENABLED=true`.
- Toss in-app console origin values are set.
- Apple and Google receipt verification values are present before native paid reports are enabled.

## Migrate And Verify

After adding production env values to the linked Vercel project, run the migration with production env loaded from Vercel:

```bash
vercel env run -e production -- npm run db:migrate
```

Redeploy production, then verify the live site:

```bash
VERCEL_PRODUCTION_BASE_URL="https://YOUR_DOMAIN" npm run vercel:production
```

For cron routes, Vercel sends the configured `CRON_SECRET` as the bearer authorization value. Keep both `/api/cron/prune` and `/api/cron/monitoring` scheduled in `vercel.json`.

References:

- https://vercel.com/docs/marketplace-storage
- https://vercel.com/docs/cli/integration
- https://vercel.com/docs/cli/env
- https://vercel.com/docs/cron-jobs/manage-cron-jobs
