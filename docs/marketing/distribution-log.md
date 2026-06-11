# Distribution Log

Last updated: 2026-06-11

## Completed

- Generated social card: `docs/marketing/assets/social-card-1200x630.png`
- Generated square card: `docs/marketing/assets/square-card-1080x1080.png`
- Generated Product Hunt gallery card: `docs/marketing/assets/product-hunt-gallery-1270x760.png`
- Generated V2 brand card: `docs/marketing/assets/brand-risk-check-1080x1080.png`
- Generated V2 Product Hunt sequence:
  - `docs/marketing/assets/product-hunt-01-scan-1270x760.png`
  - `docs/marketing/assets/product-hunt-02-results-1270x760.png`
  - `docs/marketing/assets/product-hunt-03-report-1270x760.png`
- Generated V2 press one-pager: `docs/marketing/assets/press-onepager-1600x2000.png`
- Created press release: `docs/marketing/press-release.md`
- Created press email: `docs/marketing/press-email.md`
- Created V2 launch campaign: `docs/marketing/launch-campaign-v2.md`
- Created V2 social copy bank: `docs/marketing/social-copy-v2.md`
- Created media pitch list: `docs/marketing/media-pitch-list.csv`
- Created press kit archive: `docs/marketing/id-doppelganger-press-kit.zip`
- Created V2 launch kit archive: `docs/marketing/id-doppelganger-launch-kit-v2.zip`
- Created Gmail review draft to `khstar1004@yonsei.ac.kr`
  - Draft ID: `r3341354079062316772`
- Created Gmail press draft to verified public press contacts with launch kit attached
  - Draft ID: `r-7662736001992906497`
  - Message ID: `19eb599fee7a0a08`
  - Recipients: `editor@platum.kr`, `editor@venturesquare.net`, `contact@startupdaily.kr`

## External Sends

External press sends were not performed because the production public URL is not configured in `.env.local`, and the press copy still contains `[PUBLIC_URL]`.

Sending without a real URL would waste the launch contact and make the product look unfinished.

## Verified Public Press Contacts

| Outlet | Email | Source |
| --- | --- | --- |
| Platum | editor@platum.kr | https://platum.kr/press_release |
| VentureSquare | editor@venturesquare.net | https://www.venturesquare.net/faq-2/interview-inquiry/ |
| StartupDaily June 2026 startup PR support | contact@startupdaily.kr | https://www.venturesquare.net/announcement/1087526 |

## Ready-To-Send Steps

1. Replace `[PUBLIC_URL]` in `docs/marketing/press-release.md`.
2. Replace `[PUBLIC_URL]` in `docs/marketing/press-email.md`.
3. Confirm the URL returns 200 for `/`, `/privacy`, `/terms`, `/responsible-use`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`, and `/pricing.md`.
4. Send the press email to the verified contacts.
5. Log sent timestamp and message IDs here.

## Notes

- Keep attachments light. Prefer plain text body plus a press-kit link once a public file URL exists.
- Do not send the same body repeatedly.
- Do not claim app store availability until App Store / Google Play listings are live.
- Do not claim user metrics, reviews, or press coverage until they exist.
