# Monthly Monitoring

Monthly monitoring is the first subscription-ready surface for the P2 roadmap. It is browser-token based for launch so it works before full account/login rollout.

## User Flow
1. User enters one to three usernames on the landing page.
2. `POST /api/monitoring` creates or updates the monitoring subscription.
3. The browser stores the returned `ownerToken` in local storage.
4. The server stores only `ownerTokenHash`.
5. User can read or delete the monitoring record with `x-monitoring-owner-token`.

## API
- `POST /api/monitoring`
  - Body: `{ ownerToken?, usernames: string[], purpose? }`
  - Returns: `{ ownerToken, monitoring }`
- `GET /api/monitoring`
  - Header: `x-monitoring-owner-token`
  - Returns: `{ monitoring }`
- `DELETE /api/monitoring/{monitoringId}`
  - Header: `x-monitoring-owner-token`
  - Returns the deleted monitoring record.
- `GET /api/cron/monitoring`
  - Header: `Authorization: Bearer <CRON_SECRET>`
  - Runs due monthly re-checks up to `MONITORING_CRON_LIMIT`.

## Retention
- Monitoring records remain until the user cancels them.
- Monitoring-generated scans are extended to 40 days so the latest monthly check remains available until the next run.

## Store Privacy Impact
Because monthly monitoring stores a hashed browser owner token, App Store App Privacy and Google Play Data safety declarations include:
- Apple: `Identifiers / User ID`, not linked to the user, not used for tracking
- Google: `Personal info / User IDs`, not shared

## Verification
```bash
npm run test -- src/lib/monitoring.test.ts src/lib/monitoring-service.test.ts
npm run e2e -- --project=chromium-monitoring-flow
```
