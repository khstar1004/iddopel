# Native App Packaging

## Scope
The repository now includes Capacitor native projects for:

- Android: `android/`
- iOS: `ios/`
- Local bundled app shell: `native-web/`

The native shell provides the free username scan and preview flow against the production API. Paid detailed reports are bridge-ready but stay disabled by default until App Store / Google Play in-app purchase products, receipt verification credentials, and the native billing bridge are configured.

The web/PWA launch surface includes browser-token monthly monitoring. The native shell does not expose native paid monitoring yet; if it is surfaced in native builds, keep the existing App Privacy / Data safety declarations aligned with the hashed browser owner token behavior.

The shell also includes review-facing responsible-use guardrails:
- legitimate-purpose acknowledgement before scanning
- client-side blocking for email, phone-number-like, resident-number-like, and URL-style input
- visible copy that the app is not a people-search or same-person identification service
- immediate scan deletion from the result screen

## Why The Native Shell Is Local
Capacitor's production config uses `webDir: "native-web"` and does not use `server.url`.

Official Capacitor docs say:
- Install `@capacitor/core` and `@capacitor/cli`, add `@capacitor/android` and `@capacitor/ios`, then run `npx cap add android`, `npx cap add ios`, and `npx cap sync`.
- `server.url` loads an external URL in the WebView and is intended for live reload; it is not intended for production.
- `CapacitorHttp.enabled` can patch `fetch` and `XMLHttpRequest` to use native HTTP.

Sources:
- https://capacitorjs.com/docs/getting-started
- https://capacitorjs.com/docs/config
- https://capacitorjs.com/docs/apis/http

## Configure For Release
Set the production HTTPS origin and write it into the native shell config:

```bash
MOBILE_APP_ORIGIN="https://YOUR_PRODUCTION_DOMAIN" npm run mobile:configure
MOBILE_RELEASE_CHECK=true npm run mobile:verify
npm run mobile:icons
npm run mobile:sync
```

The current default `native-web/app-config.js` contains `YOUR_PRODUCTION_DOMAIN` so accidental release builds fail when `MOBILE_RELEASE_CHECK=true`.

## Android
Generated project:

```bash
npm run mobile:add:android
npm run mobile:icons
npm run mobile:sync
```

Build on a machine with Android Studio / JDK configured:

```bash
cd android
./gradlew bundleRelease
```

For a local debug APK compile gate, run:

```bash
npm run android:debug
```

For a Play Store release bundle compile gate, run:

```bash
npm run android:bundle
```

The script uses `JAVA_HOME` and `ANDROID_HOME` / `ANDROID_SDK_ROOT` when set, and also checks the local Codex tool caches at `~/.codex/jdks/temurin21` and `~/.codex/android-sdk`.

Release signing still requires Google Play upload key or Play App Signing setup in the Play Console.

## iOS
Generated project:

```bash
npm run mobile:add:ios
npm run mobile:icons
npm run mobile:sync
```

Build/archive on macOS with Xcode:

```bash
npx cap open ios
```

Then select the Apple Developer team, bundle identifier, signing profile, and archive for App Store Connect.

## Payment Policy Guardrail
Apple App Review Guideline 3.1.1 requires in-app purchase when unlocking paid digital features or functionality inside the app. Google Play's billing documentation states Play Billing is for selling digital products and content in Android apps and recommends server backend verification for entitlements.

Sources:
- https://developer.apple.com/app-store/review/guidelines/#in-app-purchase
- https://developer.apple.com/documentation/storekit
- https://developer.android.com/google/play/billing
- https://developer.android.com/google/play/billing/integrate
- https://capacitorjs.com/docs/android/custom-code
- https://capacitorjs.com/docs/ios/custom-code

For that reason:
- Web/Toss build: uses Toss Payments checkout.
- Toss in-app route: uses Toss Payments provider after Toss review.
- App Store / Play Store shell: uses StoreKit / Play Billing through the native bridge when `MOBILE_PAYMENTS_ENABLED=true`; otherwise paid report purchase remains disabled.

Required product setup before enabling native paid reports:
- Apple consumable in-app purchase product id for a per-report unlock, for example `detailed_report`
- Google Play one-time product id for a per-report unlock, for example `detailed_report`
- Server receipt verification endpoints:
  - `POST /api/mobile/entitlements/apple` with `{ scanId, transactionId }`
  - `POST /api/mobile/entitlements/google` with `{ scanId, productId, purchaseToken }`
- Restore / pending-purchase recovery flow exposed through the native bridge
- App review notes explaining that username results do not identify people

Implemented native bridge files:
- Web adapter: `native-web/native-billing-bridge.js`
- Android Play Billing plugin: `android/app/src/main/java/com/iddoppelganger/app/NativeBillingPlugin.java`
- iOS StoreKit plugin: `ios/App/App/NativeBillingPlugin.swift`

## Native Billing Bridge Contract
The native layer registers a Capacitor plugin named `NativeBilling`. `native-web/native-billing-bridge.js` maps `window.Capacitor.Plugins.NativeBilling` into `window.IDD_NATIVE_BILLING` before `native-web/app.js` runs:

```js
window.IDD_NATIVE_BILLING = {
  async purchaseDetailedReport({ scanId, appleProductId, googlePlayProductId }) {
    // App Store example:
    // return { provider: "APP_STORE", transactionId: "1000000000001" };
    // Google Play example:
    return { provider: "GOOGLE_PLAY", productId: googlePlayProductId, purchaseToken: "..." };
  },
  async restoreDetailedReport({ scanId, appleProductId, googlePlayProductId }) {
    // App Store example:
    // return { provider: "APP_STORE", transactionId: "1000000000001" };
    // Google Play example:
    return { provider: "GOOGLE_PLAY", productId: googlePlayProductId, purchaseToken: "..." };
  }
};
```

The bundled app shell automatically maps `window.Capacitor.Plugins.NativeBilling` into `window.IDD_NATIVE_BILLING`. The WebView posts the purchase result to the server entitlement endpoint, receives `reportUrl`, and opens the detailed report. The native layer should only resolve the bridge promise after StoreKit or Play Billing has returned a purchased transaction. Android returns `{ provider: "GOOGLE_PLAY", productId, purchaseToken }`; iOS returns `{ provider: "APP_STORE", transactionId }`. After server entitlement succeeds, the shell calls `completeDetailedReportPurchase(...)` so Android can consume the one-time product and iOS can finish the StoreKit transaction.

## Native Receipt Verification Environment
Apple:
- `APPLE_BUNDLE_ID`
- `APPLE_DETAILED_REPORT_PRODUCT_ID`
- `APPLE_ENVIRONMENT=sandbox|production`
- `APPLE_KEY_ID`
- `APPLE_ISSUER_ID`
- `APPLE_PRIVATE_KEY`
- `APPLE_REQUIRE_JWS_VERIFICATION`
- `APPLE_ROOT_CERTIFICATES_BASE64`
- `APPLE_APP_APPLE_ID`

Google Play:
- `GOOGLE_PLAY_PACKAGE_NAME`
- `GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

The server hashes native purchase identifiers into `report_orders.payment_key` and rejects reuse of the same purchase for a different scan.

If `APPLE_ROOT_CERTIFICATES_BASE64` is set, the server uses Apple's official `SignedDataVerifier` before trusting the signed transaction payload. Set `APPLE_REQUIRE_JWS_VERIFICATION=true` for release once the Apple root certificates are configured.

## Verification Commands
```bash
npm run mobile:verify
npm run android:debug
npm run android:bundle
npm run assets:verify
npm run privacy:verify
npm run store:verify
npm run verify
npm run code:hygiene
npm run security:audit
npm run security:secrets
npm run e2e
```

`npm run e2e` includes `chromium-native-shell`, which serves `native-web/` over HTTP and verifies native shell guardrails, default paid-report disabled state, missing-bridge disabled state, App Store-style entitlement redemption, Capacitor `NativeBilling` adapter mapping, and Google Play consumable completion after server entitlement.

## Store Privacy Declarations
App Store Connect App Privacy and Google Play Data safety answers are prepared in:

- `docs/app-privacy-data-safety.md`
- `store-assets/privacy-declarations.json`

Run `npm run privacy:verify` before submitting native builds. Native paid reports are currently declared disabled by default; update the declarations before enabling `MOBILE_PAYMENTS_ENABLED=true`.

Before any store build with native paid reports enabled, run:

```bash
MOBILE_PAYMENTS_ENABLED=true STORE_RELEASE_CHECK=true npm run privacy:verify
```

This gate should fail until Apple App Privacy includes Purchases / Purchase History, Google Play Data safety includes Financial info / Purchase history, and purchase token / transaction identifier handling is documented.

## CI
`.github/workflows/release-verification.yml` runs:
- web verify, store asset generation/verification, code hygiene, high-severity `npm run security:audit`, and committed-secret `npm run security:secrets`
- store submission package verification
- mobile release-domain configuration check
- Capacitor sync
- Android debug APK build on Ubuntu with JDK 21 and Android SDK 36

iOS archive still requires macOS/Xcode and Apple signing credentials.

The manual `.github/workflows/store-submission.yml` workflow is prepared for account-backed store uploads after production URLs and store credentials are configured.
