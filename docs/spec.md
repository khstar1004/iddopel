# Spec: ID 도플갱어 Web/PWA MVP

## Objective
사용자가 아이디 문자열을 입력하면 공개 계정 사용 현황 후보를 점수화해 보여주는 한국어 웹/PWA MVP를 만든다. 이 MVP는 바이럴 랜딩, 안전한 목적 확인, 빠른 스캔, 무료 요약, 일부 결과 미리보기, 검색 기록 삭제, 기본 조치 가이드, 토스 인앱용 순한맛 화면, 출시 제출 문서를 포함한다.

## Tech Stack
- Next.js App Router, TypeScript, React
- Tailwind CSS v4
- Vitest for pure domain tests
- Postgres scan persistence in production, local JSON file fallback for development
- Maigret CLI adapter for real scans, deterministic fallback for local demos
- Docker production image with Node, Next.js, Python, and Maigret CLI
- Toss Payments payment-window integration for paid detailed reports

## Commands
- Install: `npm install`
- Dev: `npm run dev`
- Typecheck: `npm run typecheck`
- Test: `npm test`
- Build: `npm run build`
- Verify: `npm run verify`
- Postgres migration: `DATABASE_URL=postgres://... npm run db:migrate`
- Retention prune: `npm run retention:prune`
- Cron endpoint: `GET /api/cron/prune` with `Authorization: Bearer $CRON_SECRET`
- Create paid report order: `POST /api/orders`
- Confirm Toss payment: `POST /api/payments/confirm`
- Mock payment for local smoke tests: `POST /api/payments/mock/confirm`

## Project Structure
- `src/app`: routes, API handlers, global styles
- `src/components`: reusable client UI
- `src/lib`: scan contracts, validation, scoring, fixtures, in-memory store
- `src/lib/*.test.ts`: pure logic tests
- `db/schema.sql`: production Postgres schema
- `scripts`: database migration and retention operations
- `vercel.json`: hourly retention cron schedule
- `Dockerfile`: production container image with Maigret installed
- `src/lib/commerce*.ts`: paid report order and entitlement storage
- `docs`: launch, policy, app-store, Toss submission artifacts

## Code Style
```ts
export function createApiError(code: string, message: string, status: number) {
  return { status, body: { error: { code, message } } };
}
```
- Keep API response fields camelCase.
- Validate untrusted input in API routes and form submit handlers.
- Keep user-facing copy Korean-first and avoid identity-proof claims.

## Testing Strategy
- Unit tests cover username validation, abuse blocking, deterministic scan generation, and scoring.
- Typecheck and Next build must pass before considering a slice verified.
- Browser smoke tests are required after major UI changes.

## Boundaries
- Always: block email/phone/resident-number style searches, show "동일인 아님" disclaimer, allow local record deletion, set security headers.
- Ask first: adding real payment provider, storing login PII, changing launch positioning, using production Maigret infrastructure.
- Never: real-name search, phone/email search, location inference, profile image collection, same-person probability.

## Success Criteria
- Landing page lets a user complete a scan and see scores, distributions, preview results, and safety copy.
- API contract supports create, status, summary, results preview/detail, and delete.
- Toss/mobile route uses gentler UX copy and purpose selection.
- Privacy, terms, responsible-use, store listing, and Toss checklist docs exist.
- `npm run verify` passes.

## Open Questions
- Production domain, legal business entity, Toss/Apple/Google developer account details, payment merchant keys, and Maigret worker hosting remain owner-supplied launch inputs.
