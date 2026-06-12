# Store Assets

Generated app submission assets for ID 도플갱어.

## Generate

```bash
npm run assets:store
```

## Key Files
- `app-icon-1024.png`: Apple App Store app icon source
- `play-icon-512.png`: Google Play high-resolution app icon
- `play-feature-graphic-1024x500.png`: Google Play feature graphic
- `screenshots/iphone-6.7-*.png`: Apple iPhone 6.7-inch screenshots
- `screenshots/ipad-12.9-*.png`: Apple iPad 12.9-inch screenshots
- `screenshots/android-phone-*.png`: Google Play phone screenshots
- `screenshots/android-tablet-*.png`: Google Play tablet screenshots
- `apple-app-store.json`: App Store Connect copy draft
- `google-play-listing.json`: Google Play Console copy draft
- `privacy-declarations.json`: App Store App Privacy and Google Play Data safety source of truth
- `../fastlane/metadata/`: Fastlane-ready metadata and copied image assets

Current production URLs are finalized for the Vercel beta domain. Re-run this only if the production domain or support mailbox changes:

```bash
STORE_PRODUCTION_ORIGIN="https://iddopel.vercel.app" \
STORE_SUPPORT_EMAIL="khstar1004@yonsei.ac.kr" \
npm run store:finalize
npm run privacy:verify
```
