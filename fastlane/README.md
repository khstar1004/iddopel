# Fastlane Metadata Package

This directory contains Korean launch metadata and generated image assets for store upload tooling.

Run before packaging:

```bash
npm run assets:store
npm run assets:verify
npm run privacy:verify
npm run store:verify
```

Finalize production URLs before upload:

```bash
STORE_PRODUCTION_ORIGIN="https://YOUR_PRODUCTION_DOMAIN" \
STORE_SUPPORT_EMAIL="support@YOUR_DOMAIN" \
npm run store:finalize
STORE_RELEASE_CHECK=true npm run store:verify
```

Upload lanes:

```bash
bundle install
bundle exec fastlane ios metadata
bundle exec fastlane ios testflight
bundle exec fastlane ios submit_review
bundle exec fastlane android metadata
bundle exec fastlane android validate_internal
bundle exec fastlane android internal
```

Remaining account-specific values:
- Apple team id, bundle id, SKU, support URL, privacy URL, and copyright owner
- Google Play package name, support email, privacy URL, and release track
- Production domain and final legal URLs
- App Store Connect API key
- Google Play Android Publisher service account JSON

The current metadata intentionally states that ID 도플갱어 is not a people-search service and does not support real name, phone number, email, resident-registration-number-like value, location, post content, or profile-photo search.

App Store Connect App Privacy and Google Play Data safety answers are maintained outside Fastlane in `docs/app-privacy-data-safety.md` and `store-assets/privacy-declarations.json`; run `npm run privacy:verify` before uploading.
