# ADR-001: Use a Ticket Wallet for Free Scan Coupons

## Status
Accepted

## Date
2026-06-13

## Context
The product needs a free scan coupon system that can also drive referral growth:

- Users should see the remaining free scan count next to the scan button.
- When tickets run out, users should get a referral link that grants a bonus ticket when a friend visits.
- Referral tickets should not be lost when the user changes browser or device.
- No external email or identity provider is configured in the current application.

The existing anonymous browser owner token is enough for a single-device quota, but it is not enough to manage tickets across devices.

## Decision
Add a server-side Ticket Wallet:

- A wallet is claimed with an email address and a one-time recovery code.
- The server stores only an email hash, masked email, account owner token, hashed recovery code, and hashed session token.
- The browser receives an HttpOnly, SameSite=Lax session cookie.
- Scan quota and referral bonus accounting use the account owner token when the wallet session is present.
- Anonymous referral bonus tickets are transferred to the wallet owner token when the wallet is created or opened.
- Local development uses the file store; production uses the existing Postgres environment when configured.

## Alternatives Considered

### Anonymous-only tickets
- Pros: Smallest implementation.
- Cons: Tickets are lost across browsers and referral campaigns become harder to trust.
- Rejected because the marketing loop needs durable ownership.

### Full password login
- Pros: Familiar account model.
- Cons: Adds password reset, credential storage, and more security surface area than this feature needs.
- Rejected for the first ticket-wallet version.

### Email OTP or magic links
- Pros: Better account recovery and ownership verification.
- Cons: Requires a mail provider and deliverability setup not currently present in the repo.
- Deferred. The ticket-wallet route is the boundary where OTP can replace recovery-code verification later.

## Consequences
- Users can preserve and recover ticket ownership without adding a full auth system.
- Referral tickets can be accumulated into a durable server-side wallet.
- Users must save the recovery code until a real email verification provider is added.
- The wallet is intentionally narrow: it authenticates ticket ownership, not the user's broader identity.
