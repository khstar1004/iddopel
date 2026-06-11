# Privacy Data Map

## Stored
| Field | Purpose | Retention |
| --- | --- | --- |
| Username string | Scan target and report generation | 24h non-member / 7d free / 90d paid |
| Scan purpose | User intent alignment and abuse prevention | Same as scan |
| Platform name and candidate URL | Report result | Same as report |
| Category and country | Distribution summary | Same as scan |
| Risk level and score | Result explanation | Same as report |
| Report id | Retrieval and deletion | Same as report |
| Monitoring username list | Monthly public username re-check | Until monitoring deletion |
| Hashed browser owner token | Browser-scoped monitoring ownership and deletion | Until monitoring deletion |
| Monitoring latest scan ids and schedule | Monthly re-check status and next run | Until monitoring deletion |
| Page path, client error type, Core Web Vitals metric | Service reliability, launch monitoring, abuse/debug signal | Deployment log retention period |

## Store Privacy Declaration Mapping
| Store console area | Declared data | Notes |
| --- | --- | --- |
| Apple App Privacy / Search History | Username string | Used only to run public username usage checks |
| Apple App Privacy / Other User Content | Scan purpose, generated scan summary, generated report result | Not linked to a user identity in the native shell |
| Apple App Privacy / Diagnostics | Core Web Vitals metric, client error type, page path, release version | First-party reliability telemetry |
| Apple App Privacy / Identifiers | Hashed browser owner token | Used only for monthly monitoring ownership, not tracking |
| Google Play Data safety / App activity | Search history, app interactions | Username string, scan purpose, scan mode, result view path |
| Google Play Data safety / App info and performance | Crash logs, diagnostics | First-party client error and performance telemetry |
| Google Play Data safety / Personal info / User IDs | Hashed browser owner token | Used only for monthly monitoring ownership, not shared |

The full console answer source is `store-assets/privacy-declarations.json` and `docs/app-privacy-data-safety.md`.

## Not Stored
- Real name
- Phone number
- Email address as a search target
- Resident registration number
- Precise location
- Workplace or school inference
- Profile photo
- Post or comment content
- Same-person probability
- Telemetry cookies or cross-site tracking identifiers

## Abuse Controls
- Input validation blocks email, phone-number-like, resident-number-like, URL-like values.
- The UI requires a legitimate-purpose acknowledgment before scanning.
- Results include a fixed disclaimer that discovered accounts are not identity proof.
- Search history can be deleted by the user.
