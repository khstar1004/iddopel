# Store Submission Drafts

## App Name
ID 도플갱어

## Subtitle
공개 흔적 점검

## Short Description
아이디 하나로 남아 있는 공개 흔적을 먼저 확인하세요.

## Full Description
ID 도플갱어는 사용자가 입력한 아이디 문자열이 공개 플랫폼 어디에 남아 있는지 먼저 보여주는 username 점검 서비스입니다.

무료 점검에서는 발견된 플랫폼 카드와 잠긴 상세 URL을 바로 확인하고, 점수는 보조 분석으로 정리합니다.

본인 아이디, 브랜드명, 활동명, 새 닉네임 겹침을 점검할 수 있으며, 발견된 결과는 동일인 여부를 의미하지 않습니다. 실명, 전화번호, 이메일, 주민번호, 위치 정보 검색은 지원하지 않습니다.

## Keywords
아이디, 닉네임, 계정 점검, 사칭 확인, 브랜드 보호, 노출 점검, 디지털 풋프린트

## Category
Utilities / Productivity

## Privacy Nutrition / Data Safety Notes
- User-provided data: username string, scan purpose
- Generated data: scan results, score, report id
- Monitoring and abuse-prevention data: monitored username list, schedule, latest scan ids, hashed browser owner token, hashed beta quota key
- Not collected: real name, phone number, email search value, profile photo, post content, precise location
- Purpose: app functionality, abuse prevention, customer support, paid report delivery
- Retention: non-member 24 hours, free account 7 days, paid report 90 days, subscription during subscription period
- Console entry source of truth: `docs/app-privacy-data-safety.md` and `store-assets/privacy-declarations.json`
- Verification: `npm run privacy:verify`

## Review Notes
This app is not a people-search service. It only checks public username-string usage and does not identify whether discovered accounts belong to the same person.

## Required Before Actual Submission
- Apple Developer team id and bundle id
- Google Play package name
- Final privacy policy URL on production domain
- Support URL and support email
- App icon PNG at required sizes: prepared in `store-assets/app-icon-1024.png`
- App screenshots for iPhone, Android phone, and Android tablet: prepared in `store-assets/screenshots/`
- Google Play feature graphic: prepared in `store-assets/play-feature-graphic-1024x500.png`
- Payment/subscription terms if in-app purchase is enabled
- Toss Payments merchant review and production API keys for web checkout
- App Store / Play Store in-app purchase setup if native app unlocks digital reports inside the app

## Asset Commands
```bash
npm run assets:store
npm run assets:all
npm run assets:verify
npm run privacy:verify
npm run store:verify
```

Finalize store URLs and support email after the production domain is live:

```bash
STORE_PRODUCTION_ORIGIN="https://YOUR_PRODUCTION_DOMAIN" \
STORE_SUPPORT_EMAIL="support@YOUR_DOMAIN" \
npm run store:finalize
STORE_RELEASE_CHECK=true npm run store:verify
```

## Upload-Oriented Metadata
- Apple fastlane metadata: `fastlane/metadata/ko-KR/`
- Apple fastlane screenshots: `fastlane/screenshots/ko-KR/` for iPhone 6.7-inch and iPad 12.9-inch
- Google Play fastlane metadata and images: `fastlane/metadata/android/ko-KR/`
- Google Play icon: `fastlane/metadata/android/ko-KR/images/icon.png` at 512x512 PNG
- Google Play feature graphic: `fastlane/metadata/android/ko-KR/images/featureGraphic.png` at 1024x500 PNG
- Store privacy declarations: `store-assets/privacy-declarations.json`

## Fastlane Upload Commands
Install Ruby and Bundler, then:

```bash
bundle install
```

Apple App Store Connect:

```bash
APP_STORE_CONNECT_KEY_ID="..." \
APP_STORE_CONNECT_ISSUER_ID="..." \
APP_STORE_CONNECT_API_KEY_P8_BASE64="..." \
bundle exec fastlane ios metadata
```

```bash
APP_STORE_CONNECT_KEY_ID="..." \
APP_STORE_CONNECT_ISSUER_ID="..." \
APP_STORE_CONNECT_API_KEY_P8_BASE64="..." \
bundle exec fastlane ios submit_review
```

The launch env names also work for Fastlane and `STORE_RELEASE_CHECK=true npm run store:verify`:

```bash
APPLE_KEY_ID="..." \
APPLE_ISSUER_ID="..." \
APPLE_PRIVATE_KEY="..." \
APPLE_APP_APPLE_ID="..." \
bundle exec fastlane ios metadata
```

Google Play:

```bash
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON='...' \
bundle exec fastlane android metadata
```

```bash
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON='...' \
bundle exec fastlane android validate_internal
```

GitHub Actions also includes a manual `Store Submission` workflow with `verify-only`, `android-metadata`, `android-internal-validate`, `ios-metadata`, `ios-testflight`, and `ios-submit-review` lanes.

## Native Projects
- Capacitor config: `capacitor.config.ts`
- Android project: `android/`
- iOS project: `ios/`
- Mobile packaging guide: `docs/mobile-packaging.md`
- Android debug compile gate: `npm run android:debug`
- Android release AAB compile gate: `npm run android:bundle`

The native app shell is configured for the free scan/preview flow. Native paid reports include the WebView adapter plus Android Google Play Billing and iOS StoreKit Capacitor plugins, but must stay disabled by default until Apple IAP and Google Play Billing products and server-side receipt verification credentials are configured.

Server receipt verification endpoints are prepared:
- App Store: `POST /api/mobile/entitlements/apple`
- Google Play: `POST /api/mobile/entitlements/google`

Enable native paid reports only after production product IDs, service credentials, receipt verification, sandbox purchase testing, restore or pending-purchase recovery testing, and store review notes are configured.

## Sources
- Fastlane `deliver` uploads App Store metadata and screenshots from `fastlane/metadata`: https://docs.fastlane.tools/actions/deliver/
- Fastlane `upload_to_play_store` uploads Google Play metadata, screenshots, and app bundles: https://docs.fastlane.tools/actions/upload_to_play_store/
- Google Play preview assets require a 512x512 app icon and 1024x500 feature graphic: https://support.google.com/googleplay/android-developer/answer/9866151
- Apple App Store Connect accepts PNG/JPG screenshots and requires one to ten screenshots per display class: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
- Apple requires app privacy practices in App Store Connect and a privacy policy URL for iOS apps: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- Google Play Data safety requires privacy policy, collection/sharing, security, deletion, and third-party code review declarations: https://support.google.com/googleplay/android-developer/answer/10787469
