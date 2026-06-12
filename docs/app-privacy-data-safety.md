# App Privacy And Data Safety Answers

This file is the console-entry source of truth for App Store Connect App Privacy and Google Play Data safety. Keep it aligned with `store-assets/privacy-declarations.json` before every app submission.

## Product Position
ID 도플갱어 is not a people-search service. It checks public usage of a username string and never states that discovered account candidates belong to the same person.

## Current Native Release Scope
The App Store / Play Store native shell supports the free scan and result preview flow. Native paid reports are bridge-ready but disabled by default until `MOBILE_PAYMENTS_ENABLED=true`, StoreKit and Google Play Billing products, the native billing bridge, and production receipt verification credentials are configured.
Native paid reports are disabled in the current default native submission build.

## Native Paid Report Switch
Run `MOBILE_PAYMENTS_ENABLED=true STORE_RELEASE_CHECK=true npm run privacy:verify` before any native build that unlocks paid report details through StoreKit or Google Play Billing.

That check must fail until native paid reports are enabled in `store-assets/privacy-declarations.json`, Apple App Privacy declares Purchases / Purchase History, Google Play Data safety declares Financial info / Purchase history, and purchase token / transaction identifier handling is documented.

## Apple App Privacy
- Privacy policy URL: `https://iddopel.vercel.app/privacy`
- Tracking: No
- Data linked to the user: No
- Data used for tracking: No
- Third-party advertising: No

Declare these data types:

| Category | Data type | Fields | Purposes | Linked | Tracking |
| --- | --- | --- | --- | --- | --- |
| Search History | Search History | username string | App Functionality, Fraud Prevention | No | No |
| User Content | Other User Content | scan purpose, generated scan summary, generated report result | App Functionality, Fraud Prevention | No | No |
| Diagnostics | Performance Data | Core Web Vitals metric name and bounded value | Analytics, App Functionality | No | No |
| Diagnostics | Other Diagnostic Data | client error type, page path without query string, release version | Analytics, App Functionality | No | No |
| Identifiers | User ID | hashed browser owner token for monthly monitoring, hashed beta quota key for free-scan abuse prevention | App Functionality, Fraud Prevention | No | No |

Do not declare collection for contact info, financial info, location, contacts, photos/videos, sensitive info, purchases, browsing history, or advertising data while native paid reports remain disabled.

## Google Play Data safety
- Privacy policy URL: `https://iddopel.vercel.app/privacy`
- Data encrypted in transit: Yes
- Users can request deletion: Yes
- Data shared with third parties: No
- Ads SDK: No
- Third-party analytics SDK: No

Declare these data types:

| Category | Data type | Fields | Required | Purposes | Shared |
| --- | --- | --- | --- | --- | --- |
| App activity | Search history | username string | Yes | App functionality; Fraud prevention, security, and compliance | No |
| App activity | App interactions | scan purpose, scan mode, result view path | Yes | App functionality; Fraud prevention, security, and compliance | No |
| App info and performance | Crash logs | client error type, unhandled rejection type | No | Analytics; App functionality | No |
| App info and performance | Diagnostics | Core Web Vitals metric name and bounded value, release version | No | Analytics; App functionality | No |
| Personal info | User IDs | hashed browser owner token for monthly monitoring, hashed beta quota key for free-scan abuse prevention | No | App functionality; Fraud prevention, security, and compliance | No |

Do not declare collection for name, email address, phone number, precise/approximate location, contacts, photos, videos, audio files, health info, financial info, device IDs, web browsing history, SMS/MMS, or calendar events while native paid reports remain disabled.

## Before Enabling Native Paid Reports
Update this file and `store-assets/privacy-declarations.json` if `MOBILE_PAYMENTS_ENABLED=true`. At minimum, re-evaluate purchase history, entitlement identifiers, product IDs, transaction IDs, purchase tokens, restore purchases, and any store SDK data handling.

## Before Adding SDKs
Update both store privacy declarations if adding crash reporting, analytics, advertising, attribution, push notifications, login, or customer support chat SDKs. Google Play requires third-party code collection/sharing to be reflected in the Data safety form, and Apple requires app privacy practices including third-party partner code to be entered in App Store Connect.

## Sources
- Apple App Privacy details: https://developer.apple.com/app-store/app-privacy-details/
- Apple App Store Connect app privacy management: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- Google Play Data safety form: https://support.google.com/googleplay/android-developer/answer/10787469
