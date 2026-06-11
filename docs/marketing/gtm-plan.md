# ID 도플갱어 GTM Plan

Last updated: 2026-06-11

## Executive Summary

ID 도플갱어의 첫 90일 홍보 전략은 paid ads가 아니라 **검색 가능한 무료 점검 도구 + 한국어 SEO 가이드 + 앱스토어 신뢰면 + 안전한 크리에이터/브랜드 아웃리치**로 시작한다.

The three bets:

1. **Free scan as acquisition loop**: the homepage scan is the lead magnet. Every channel points to "아이디 하나 넣고 내 흔적 찾기."
2. **Korean search capture**: own Korean intent around 아이디 희소성 테스트, 닉네임 검색, 사칭 계정 확인, 브랜드명 계정 확인, 디지털 풋프린트 점검.
3. **Trust-first positioning**: never market as people search. The safer and clearer the boundary, the easier app stores, communities, and creators will accept it.

90-day target:

- Production domain live and verified in Google Search Console, Bing Webmaster Tools, and Naver Search Advisor.
- 15-25 indexable Korean guide/use-case pages.
- App Store / Google Play listings published or ready for review with Korean-first screenshots.
- 30-50 qualified creator/small-brand outreach conversations started manually.
- Baseline funnel metrics: visit -> scan start -> scan complete -> report unlock -> paid report.

## Strategic Frame

**Category claim:** 아이디/닉네임 공개 사용 현황 점검 도구.

**Primary ICPs:**

- Individuals checking old usernames and public exposure.
- Creators checking activity names and impersonation candidates.
- Small brands/founders checking brand username availability before launch.
- Social/brand operators who need a reportable check.

**Primary conversion:** completed scan.

**Secondary conversions:** detailed report unlock, paid report purchase, monthly monitoring registration, app install, guide share.

**Positioning non-negotiables:**

- Say "공개 username 흔적", not "동일인 계정".
- Say "점검", not "추적".
- Say "사칭 가능성 신호", not "사칭범 찾기".
- Block and avoid real name, phone, email, resident-number-like values, location, photos, and post-content claims.

## Current State

Already prepared:

- Korean landing/scan flow.
- Six SEO guide pages.
- Privacy, terms, responsible-use pages.
- Web/PWA, Toss route, Android/iOS shell, store assets, screenshots, metadata.
- Server telemetry for page views, client errors, unhandled rejections, Core Web Vitals.
- `/llms.txt`, `/pricing.md`, homepage JSON-LD added for AI/search readability.

External blockers:

- Production domain, SSL, DNS.
- Search Console, Bing Webmaster Tools, Naver Search Advisor ownership verification.
- Toss production keys and store credentials.
- App Store / Google Play submission.
- Real analytics destination such as GA4/GTM or another privacy-compatible tool.
- Founder social profiles, company profile pages, demo video URL.

## AARRR Plan

### Acquisition

Organic search:

- Expand from six guides to clusters:
  - 아이디/닉네임: 아이디 검색, 아이디 추천 전 확인, 닉네임 중복 확인.
  - Safety/privacy: 디지털 풋프린트, 오래된 계정 정리, 방치 계정 삭제 체크리스트.
  - Creator/brand: 활동명 검색, 브랜드명 계정 선점, 사칭 계정 신고 준비.
- Each page should have a single H1, FAQ section, clear CTA back to `/`, and no identity-proof language.

App stores:

- Apple: keep title/subtitle keyword-dense but readable. Use screenshots to show scan -> results -> report.
- Google Play: full description should naturally repeat high-intent Korean terms because Google indexes the long description.
- After install data exists, use Apple Product Page Optimization and Google Play Store Listing Experiments for screenshot/title tests.

Directories and communities:

- First submit only after production domain, pricing page, privacy/terms, screenshots, and demo video are live.
- Priority: Naver Search Advisor, Google Search Console, Bing Webmaster Tools, Product Hunt, BetaList, AlternativeTo, SaaSHub, Indie Hackers, Dev.to/Hashnode technical write-up.
- Skip broad AI-tool directories unless the listing can honestly frame the product as an AI-assisted username risk utility.

Manual outbound:

- Target creators, small brands, naming/brand agencies, social media agencies, and startup founders preparing launches.
- Use 1:1 emails or DMs written from a relevant signal. Do not automate sending at this stage.

Paid:

- Defer until analytics and conversion events are verified.
- First budget cap: KRW 20,000-50,000/day test, only after report conversion baseline exists.

### Activation

Activation goal: the first scan must feel useful before any paywall.

Improve:

- Hero CTA should stay outcome-specific: "내 아이디 흔적 찾기" or "아이디 노출 점검".
- The purpose checkbox is not just compliance; it reassures legitimate users.
- After summary, immediately show one next step by persona:
  - Individual: "오래된 계정 정리하기"
  - Creator: "사칭 신호 우선 확인하기"
  - Brand: "공식 계정 선점 플랫폼 정리하기"

### Retention

Retention goal: make repeated checking legitimate and bounded.

- Monthly monitoring is the main retention loop.
- Add lifecycle emails only after an email collection flow exists and consent is explicit.
- Post-report content should teach safe action: account claim, deletion request, official profile setup, impersonation report preparation.

### Referral

Referral goal: make users share the tool without exposing sensitive results.

- Shareable output should be generic: "내 아이디 공개 흔적 점검" rather than sharing found accounts.
- Add a safe share card later: score bands only, no URLs, no platform list if privacy-sensitive.
- Creator angle: "활동명 정하기 전에 확인하는 체크리스트."

### Revenue

Revenue starts with paid detailed reports, not subscriptions.

- Keep the free summary generous enough to build trust.
- Sell time saved and report usefulness, not fear.
- Paid value points:
  - full URLs where available
  - risk labels
  - action guide
  - PDF/HTML download
  - monitoring handoff

## 90-Day Roadmap

### Weeks 1-2: Launch Foundation

- Production domain and SSL.
- Set `SITE_URL`, finalize store URLs/support email.
- Verify `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/pricing.md`.
- Register domain in Google Search Console, Bing Webmaster Tools, Naver Search Advisor.
- Submit sitemap to each search console.
- Add GA4/GTM or equivalent event destination.
- Record 60-90 second product demo.

### Weeks 3-4: Conversion And Store Readiness

- Run CRO pass on hero, scan form, summary results, report unlock, checkout.
- Publish app store metadata and screenshots.
- Create App Store / Google Play A/B hypotheses.
- Prepare Product Hunt assets but do not launch until domain + analytics + support inbox are stable.

### Weeks 5-8: Organic Velocity

- Add 9-12 new guide/use-case pages.
- Publish one "best username check tools" article with honest alternatives.
- Publish one technical post about safe username-string checking and why identity proof is out of scope.
- Begin manual creator/brand outreach: 10-15 prospects/week.
- Submit to low-risk directories and founder communities after destination pages are live.

### Weeks 9-12: Launch Moment

- Run Product Hunt or Korean founder-community launch only after early users can give feedback.
- Push app store launch/update announcement.
- Ask first satisfied users for store reviews.
- Review funnel metrics and decide whether paid tests are justified.

## 12-Month Outlook

Q1 after launch:

- Organic search and app store baseline.
- 25+ Korean pages indexed.
- First 100-300 completed scans from organic/community.

Q2:

- Add comparison/alternative pages.
- Add safe share card or referral loop.
- Run small paid tests if scan-to-report conversion supports it.

Q3:

- Add partner campaigns with creator agencies, brand naming consultants, privacy/security newsletters.
- Consider B2B team/report bundle if agencies ask for repeated scans.

Q4:

- Decide whether monitoring becomes paid subscription, bundled report credit, or retention feature.
- Localize into English only if Korean acquisition has validated.

## Measurement

North-star metric: completed legitimate-purpose scans.

Leading indicators:

| Stage | Metric |
| --- | --- |
| Acquisition | organic clicks, guide page visits, app store product page views, directory referrals |
| Activation | scan starts, scan completions, validation errors, result-section views |
| Revenue | detailed report opens, checkout starts, payment confirmations, report downloads |
| Retention | monitoring registrations, monitoring cancellations |
| Referral | guide shares, referral UTMs, creator/community mentions |

## Open Decisions

- Production domain.
- Final paid report price.
- Whether to collect email for report delivery or keep browser-token-only flow.
- Whether Product Hunt is worth it for a Korean-first utility.
- Which analytics stack to use under privacy constraints.

## Sources Checked

- Product Hunt launch guide: https://www.producthunt.com/launch
- Product Hunt preparation guidance: https://www.producthunt.com/launch/preparing-for-launch
- Google AI search optimization guide: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Google structured data introduction: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- Apple Product Page Optimization: https://developer.apple.com/app-store/product-page-optimization/
- Apple Custom Product Pages: https://developer.apple.com/app-store/custom-product-pages/
- Google Play Store listing experiments: https://play.google.com/console/about/store-listing-experiments/
- Google Play custom store listings: https://play.google.com/console/about/customstorelistings/
- Naver Search Advisor start: https://searchadvisor.naver.com/start
- Naver robots/sitemap guide: https://searchadvisor.naver.com/guide/seo-basic-robots
