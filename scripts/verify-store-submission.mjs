import { access, readdir, readFile } from "node:fs/promises";
import sharp from "sharp";

const releaseCheck = process.env.STORE_RELEASE_CHECK === "true";
const checks = [];
const warnings = [];

function addCheck(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function addWarning(name, detail) {
  warnings.push({ name, detail });
}

async function main() {
  await requiredFile("Gemfile");
  await requiredFile("fastlane/Appfile");
  await requiredFile("fastlane/Fastfile");

  const fastfile = await readFile("fastlane/Fastfile", "utf-8");
  for (const lane of ["ios", "android", "metadata", "testflight", "submit_review", "validate_internal", "internal"]) {
    addCheck(`Fastlane contains ${lane}`, fastfile.includes(lane), `Expected fastlane/Fastfile to include ${lane}.`);
  }

  const iosName = await text("fastlane/metadata/ko-KR/name.txt");
  const iosSubtitle = await text("fastlane/metadata/ko-KR/subtitle.txt");
  const iosKeywords = await text("fastlane/metadata/ko-KR/keywords.txt");
  const iosDescription = await text("fastlane/metadata/ko-KR/description.txt");
  addCheck("Apple app name length", iosName.length > 0 && iosName.length <= 30, "Apple app name must be 1-30 characters.");
  addCheck("Apple subtitle length", iosSubtitle.length > 0 && iosSubtitle.length <= 30, "Apple subtitle must be 1-30 characters.");
  addCheck("Apple keywords length", iosKeywords.length > 0 && iosKeywords.length <= 100, "Apple keywords must be 1-100 characters.");
  addCheck("Apple description length", iosDescription.length > 0 && iosDescription.length <= 4000, "Apple description must be 1-4000 characters.");

  const appleUrls = [
    ["Apple privacy URL", await text("fastlane/metadata/ko-KR/privacy_url.txt")],
    ["Apple support URL", await text("fastlane/metadata/ko-KR/support_url.txt")],
    ["Apple marketing URL", await text("fastlane/metadata/ko-KR/marketing_url.txt")]
  ];
  for (const [name, value] of appleUrls) {
    validateUrl(name, value);
  }

  const googleTitle = await text("fastlane/metadata/android/ko-KR/title.txt");
  const googleShort = await text("fastlane/metadata/android/ko-KR/short_description.txt");
  const googleFull = await text("fastlane/metadata/android/ko-KR/full_description.txt");
  addCheck("Google title length", googleTitle.length > 0 && googleTitle.length <= 30, "Google Play title must be 1-30 characters.");
  addCheck("Google short description length", googleShort.length > 0 && googleShort.length <= 80, "Google Play short description must be 1-80 characters.");
  addCheck("Google full description length", googleFull.length > 0 && googleFull.length <= 4000, "Google Play full description must be 1-4000 characters.");

  const appleListing = JSON.parse(await readFile("store-assets/apple-app-store.json", "utf-8"));
  const googleListing = JSON.parse(await readFile("store-assets/google-play-listing.json", "utf-8"));
  validateUrl("Apple listing privacy URL", appleListing.privacyPolicyUrl);
  validateUrl("Google Play listing privacy URL", googleListing.privacyPolicyUrl);
  validateSupportEmail(googleListing.contactEmail);

  await image("Apple app icon", "store-assets/app-icon-1024.png", 1024, 1024);
  await image("Google Play icon", "fastlane/metadata/android/ko-KR/images/icon.png", 512, 512);
  await image("Google Play feature graphic", "fastlane/metadata/android/ko-KR/images/featureGraphic.png", 1024, 500);

  const appleScreenshots = await readdir("fastlane/screenshots/ko-KR");
  addCheck("Apple iPhone screenshots", appleScreenshots.filter((file) => file.startsWith("iPhone-6.7-") && file.endsWith(".png")).length >= 3, "Provide at least 3 iPhone screenshots.");
  addCheck("Apple iPad screenshots", appleScreenshots.filter((file) => file.startsWith("iPad-12.9-") && file.endsWith(".png")).length >= 3, "Universal iOS app requires iPad screenshots.");

  const phoneScreenshots = await readdir("fastlane/metadata/android/ko-KR/images/phoneScreenshots");
  const tabletScreenshots = await readdir("fastlane/metadata/android/ko-KR/images/tenInchScreenshots");
  addCheck("Google phone screenshots", phoneScreenshots.filter((file) => file.endsWith(".png")).length >= 3, "Provide at least 3 phone screenshots.");
  addCheck("Google tablet screenshots", tabletScreenshots.filter((file) => file.endsWith(".png")).length >= 3, "Provide at least 3 tablet screenshots.");

  if (releaseCheck) {
    requireOneOf(["APP_STORE_CONNECT_KEY_ID", "APPLE_KEY_ID"], "Apple metadata/review upload requires an App Store Connect API key id.");
    requireOneOf(["APP_STORE_CONNECT_ISSUER_ID", "APPLE_ISSUER_ID"], "Apple metadata/review upload requires an App Store Connect issuer id.");
    addCheck(
      "App Store Connect API key configured",
      Boolean(
        process.env.APP_STORE_CONNECT_API_KEY_P8_BASE64 ||
          process.env.APP_STORE_CONNECT_API_KEY_P8 ||
          process.env.APPLE_PRIVATE_KEY
      ),
      "Set APP_STORE_CONNECT_API_KEY_P8_BASE64, APP_STORE_CONNECT_API_KEY_P8, or APPLE_PRIVATE_KEY."
    );
    requireEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "Google Play upload requires Android Publisher service account JSON.");
    requireOneOf(
      ["GOOGLE_PLAY_UPLOAD_KEYSTORE_BASE64", "GOOGLE_PLAY_UPLOAD_KEYSTORE_PATH"],
      "Google Play internal upload requires the upload keystore as base64 for CI signing or a local upload keystore path."
    );
    requireEnv("GOOGLE_PLAY_UPLOAD_KEYSTORE_PASSWORD", "Google Play internal upload requires the upload keystore password.");
    requireEnv("GOOGLE_PLAY_UPLOAD_KEY_ALIAS", "Google Play internal upload requires the upload key alias.");
    requireEnv("GOOGLE_PLAY_UPLOAD_KEY_PASSWORD", "Google Play internal upload requires the upload key password.");
    requireEnv("MOBILE_APP_ORIGIN", "Native release requires MOBILE_APP_ORIGIN.");
    addCheck("Mobile origin is HTTPS", isHttpsUrl(process.env.MOBILE_APP_ORIGIN ?? ""), "MOBILE_APP_ORIGIN must be the production HTTPS origin.");
  } else {
    addWarning("Release credential check skipped", "Set STORE_RELEASE_CHECK=true to require App Store Connect and Google Play credentials.");
  }

  const failed = checks.filter((check) => !check.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, failed: failed.length, warningCount: warnings.length, checks, warnings }, null, 2));
  if (failed.length > 0) process.exit(1);
}

async function requiredFile(path) {
  try {
    await access(path);
    addCheck(`Required file ${path}`, true, path);
  } catch {
    addCheck(`Required file ${path}`, false, `${path} is missing.`);
  }
}

async function text(path) {
  const value = (await readFile(path, "utf-8")).trim();
  addCheck(`Text exists ${path}`, value.length > 0, `${path} must not be empty.`);
  return value;
}

async function image(name, path, width, height) {
  const metadata = await sharp(path).metadata();
  addCheck(name, metadata.format === "png" && metadata.width === width && metadata.height === height, `${path} must be ${width}x${height} PNG.`);
}

function validateUrl(name, value) {
  const ok = isHttpsUrl(value) && !value.includes("YOUR_PRODUCTION_DOMAIN");
  if (releaseCheck) {
    addCheck(name, ok, `${name} must be a final HTTPS production URL.`);
  } else if (!ok) {
    addWarning(name, `${name} still uses a placeholder and must be finalized before submission.`);
  }
}

function requireEnv(name, detail) {
  addCheck(`Env ${name}`, Boolean(process.env[name]?.trim()), detail);
}

function requireOneOf(names, detail) {
  addCheck(`Env ${names.join(" or ")}`, names.some((name) => Boolean(process.env[name]?.trim())), detail);
}

function validateSupportEmail(value) {
  const ok = typeof value === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) && !value.includes("YOUR_DOMAIN");
  if (releaseCheck) {
    addCheck("Google Play contact email", ok, "Set a final Google Play support contact email.");
  } else if (!ok) {
    addWarning("Google Play contact email", "Google Play support contact email still uses a placeholder.");
  }
}

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
