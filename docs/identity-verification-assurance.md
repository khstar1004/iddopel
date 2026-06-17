# Identity Verification Assurance

This service currently uses PortOne for payment only. PortOne identity verification, CI, DI, phone verification, and integrated certificate authentication are not active in the production user flow.

If identity verification is enabled later, the release must satisfy every control below before the feature is exposed to users.

## Controls

| Checklist item | Required control |
| --- | --- |
| CI/DI plain exposure | CI, DI, `unique_key`, and `unique_in_site` must never be rendered in client HTML, returned from public APIs, stored in browser storage, or written to telemetry. |
| Parameter tampering | The browser may send only an opaque verification identifier and a one-time nonce. Name, birth date, phone number, result status, CI, and DI must be fetched server-to-server from PortOne or the identity provider. |
| Input matching | Server code must compare provider-returned name, birth date, phone number, and success status with the user-submitted purpose-specific fields before granting access or account changes. |
| Data reuse | Verification nonce, transaction id, token, and session binding must be single-use, short-lived, and bound to the current browser/session intent. Replayed values must be rejected. |
| Key/module exposure | Identity verification secrets, decrypt keys, sample keys, and provider credentials must stay in server environment variables only. Test and production credentials must be different. |
| Process verification | Protected account, admin, purchase entitlement, and report access endpoints must continue to enforce server-side authorization. |
| Secure protocol | Production identity verification endpoints and provider callbacks must use HTTPS with TLS 1.2 or higher. |

## Release Gate

`npm run identity:verify` fails if client-visible source starts exposing CI/DI-like identity keys or stores identity verification material in browser storage. `npm run release:local` includes this gate.

## Checklist Response

Until identity verification is actually enabled, the accurate response is "not applicable because the service does not operate identity verification or collect CI/DI." If the provider requires a Y/N checklist anyway, attach this document as the implemented control standard and note that the current production flow is payment-only.
