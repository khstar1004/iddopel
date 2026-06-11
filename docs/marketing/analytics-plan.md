# Marketing Analytics Plan

Last updated: 2026-06-11

## Decisions This Data Must Support

- Which acquisition channels create completed scans, not just visits?
- Which guide pages lead to scan starts?
- Does the free summary create enough trust to open or buy detailed reports?
- Where do users stop: input validation, purpose checkbox, scan wait, result summary, checkout?
- Do app-store visitors and web visitors behave differently?

## Event Naming

Use lowercase object-action names. Keep PII out of event names and properties.

## Core Events

| Event | Trigger | Key properties | Conversion? |
| --- | --- | --- | --- |
| `page_view` | page loaded | `path`, `referrer`, `utm_source`, `utm_medium`, `utm_campaign` | no |
| `scan_form_started` | username input focused or example clicked | `entry_surface`, `guide_slug` | no |
| `scan_purpose_selected` | purpose changed | `purpose` | no |
| `scan_guardrail_acknowledged` | legitimate-purpose checkbox checked | `purpose` | no |
| `scan_submitted` | scan API submitted | `purpose`, `source_page` | yes |
| `scan_validation_failed` | client/server validation blocks input | `reason`, `source_page` | no |
| `scan_completed` | summary returned | `purpose`, `result_count_bucket`, `score_bucket` | yes |
| `report_preview_viewed` | preview results section visible | `scan_id_present` | no |
| `report_unlock_clicked` | detailed report CTA clicked | `access_state` | yes |
| `checkout_started` | order/checkout created | `provider`, `source_page` | yes |
| `payment_confirmed` | payment confirmed | `provider`, `amount_bucket` | yes |
| `report_downloaded` | HTML/PDF downloaded | `format` | yes |
| `monitoring_started` | monthly monitoring registered | `username_count_bucket` | yes |
| `monitoring_cancelled` | monitoring cancelled | `username_count_bucket` | no |
| `guide_cta_clicked` | guide page CTA clicked | `guide_slug`, `cta_text` | no |
| `store_badge_clicked` | store badge clicked | `store`, `source_page` | no |
| `outbound_link_clicked` | external marketing link clicked | `destination_type` | no |

## Funnel Definitions

Primary funnel:

1. Landing or guide visit
2. `scan_form_started`
3. `scan_submitted`
4. `scan_completed`
5. `report_unlock_clicked`
6. `checkout_started`
7. `payment_confirmed`

SEO funnel:

1. Guide page visit
2. `guide_cta_clicked`
3. `scan_submitted`
4. `scan_completed`

Retention funnel:

1. `scan_completed`
2. `monitoring_started`
3. monitoring re-check due
4. repeat report interaction

## UTM Conventions

| Channel | Example URL parameters |
| --- | --- |
| Product Hunt | `utm_source=product_hunt&utm_medium=launch&utm_campaign=public_launch_2026&utm_content=profile` |
| LinkedIn founder post | `utm_source=linkedin&utm_medium=social&utm_campaign=public_launch_2026&utm_content=founder_story` |
| X / Threads | `utm_source=x&utm_medium=social&utm_campaign=public_launch_2026&utm_content=build_in_public` |
| Directory | `utm_source=alternative_to&utm_medium=directory&utm_campaign=directory_foundation_2026` |
| Cold email | `utm_source=cold_email&utm_medium=outreach&utm_campaign=creator_brand_outreach_2026&utm_content=creator_v1` |
| App store listing | `utm_source=app_store&utm_medium=store&utm_campaign=store_launch_2026` |

Rules:

- Lowercase.
- No spaces.
- Never include recipient names, emails, usernames, or sensitive input in UTM values.

## Dashboards

Weekly launch dashboard:

- Visits by channel and landing page.
- Guide page clicks and scan conversion.
- Scan completion rate.
- Validation failure rate by reason.
- Report unlock rate.
- Checkout start and payment confirmation.
- Core Web Vitals by route.
- Client error rate by route.

Monthly SEO dashboard:

- Indexed pages.
- Organic clicks and impressions.
- Top queries by scan conversion.
- New referring domains.
- AI visibility manual checks for 10 target queries.
- Naver collection/index status.

## Implementation Notes

Current code already logs `page_view`, `client_error`, `unhandled_rejection`, and `web_vital` to server logs. The next implementation slice should add explicit product/conversion events from `ScanExperience` and checkout/report components.

Do not send raw usernames, result URLs, report tokens, owner tokens, emails, phone numbers, or resident-number-like values to analytics.

## Launch Targets

First 30 days:

- 1,000 sessions.
- 300 scan starts.
- 200 scan completions.
- 40 report unlock clicks.
- 10 paid report attempts.
- 20 monitoring registrations.

These are working targets, not forecasts. Replace them with observed baselines after the first two weeks.
