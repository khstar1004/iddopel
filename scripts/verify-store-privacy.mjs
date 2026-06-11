import { access, readFile } from "node:fs/promises";

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
  await requiredFile("store-assets/privacy-declarations.json");
  await requiredFile("docs/app-privacy-data-safety.md");

  const declaration = JSON.parse(await readFile("store-assets/privacy-declarations.json", "utf-8"));
  const appleListing = JSON.parse(await readFile("store-assets/apple-app-store.json", "utf-8"));
  const googleListing = JSON.parse(await readFile("store-assets/google-play-listing.json", "utf-8"));
  const docs = await readFile("docs/app-privacy-data-safety.md", "utf-8");

  validateTopLevel(declaration, appleListing, googleListing);
  validateApple(declaration.appleAppPrivacy);
  validateGoogle(declaration.googlePlayDataSafety);
  validateDocs(docs);

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

function validateTopLevel(declaration, appleListing, googleListing) {
  addCheck("Privacy declaration schema version", declaration.schemaVersion === 1, "schemaVersion must be 1.");
  addCheck("Privacy declaration disables tracking", declaration.tracking === false, "Tracking must be false for the current app.");
  addCheck("Privacy declaration disables third-party ads", declaration.thirdPartyAdvertising === false, "No ads SDK should be declared for the current app.");
  addCheck("Native paid reports disabled", declaration.nativePaidReportsEnabled === false, "Native paid reports stay disabled until StoreKit / Play Billing setup is complete.");
  addCheck("Privacy policy URL matches Apple listing", declaration.privacyPolicyUrl === appleListing.privacyPolicyUrl, "Keep App Store privacy URL and declaration in sync.");
  addCheck("Privacy policy URL matches Google listing", declaration.privacyPolicyUrl === googleListing.privacyPolicyUrl, "Keep Google Play privacy URL and declaration in sync.");

  if (releaseCheck) {
    addCheck("Privacy URL finalized", isHttpsUrl(declaration.privacyPolicyUrl) && !hasPlaceholder(declaration.privacyPolicyUrl), "Use the production HTTPS privacy URL.");
    addCheck("Support URL finalized", isHttpsUrl(declaration.supportUrl) && !hasPlaceholder(declaration.supportUrl), "Use the production HTTPS support URL.");
  } else if (hasPlaceholder(declaration.privacyPolicyUrl) || hasPlaceholder(declaration.supportUrl)) {
    addWarning("Privacy URLs are placeholders", "Finalize store-assets/privacy-declarations.json before release submission.");
  }
}

function validateApple(apple) {
  addCheck("Apple privacy section exists", Boolean(apple), "appleAppPrivacy is required.");
  if (!apple) return;

  addCheck("Apple privacy policy required", apple.privacyPolicyRequired === true, "Apple requires a privacy policy URL.");
  addCheck("Apple tracking false", apple.tracking === false && apple.dataUsedForTracking === false, "The app must not declare tracking unless tracking code is added.");
  addCheck("Apple data not linked to user", apple.dataLinkedToUser === false, "Current native shell has no account identity linkage.");

  const dataTypes = apple.dataTypes ?? [];
  requireDataType("Apple", dataTypes, "Search History", "Search History");
  requireDataType("Apple", dataTypes, "User Content", "Other User Content");
  requireDataType("Apple", dataTypes, "Diagnostics", "Performance Data");
  requireDataType("Apple", dataTypes, "Diagnostics", "Other Diagnostic Data");
  requireDataType("Apple", dataTypes, "Identifiers", "User ID");

  for (const item of dataTypes) {
    addCheck(`Apple ${item.dataType} not linked`, item.linkedToUser === false, `${item.dataType} should not be linked to user identity.`);
    addCheck(`Apple ${item.dataType} not tracking`, item.usedForTracking === false, `${item.dataType} should not be used for tracking.`);
    addCheck(`Apple ${item.dataType} has purpose`, Array.isArray(item.purposes) && item.purposes.length > 0, `${item.dataType} needs at least one purpose.`);
  }

  for (const forbidden of ["Location", "Contact Info", "Financial Info", "Photos or Videos"]) {
    addCheck(`Apple not collected ${forbidden}`, apple.notCollected?.includes(forbidden), `${forbidden} should remain explicitly not collected.`);
  }
}

function validateGoogle(google) {
  addCheck("Google data safety section exists", Boolean(google), "googlePlayDataSafety is required.");
  if (!google) return;

  addCheck("Google privacy policy required", google.privacyPolicyRequired === true, "Google Play Data safety requires a privacy policy.");
  addCheck("Google data encrypted in transit", google.dataEncryptedInTransit === true, "Declare HTTPS/TLS transport.");
  addCheck("Google deletion supported", google.usersCanRequestDeletion === true, "User deletion requests must be supported.");
  addCheck("Google no data sharing", google.dataShared === false, "Current app should not declare data sharing.");

  const dataTypes = google.dataTypes ?? [];
  requireDataType("Google", dataTypes, "App activity", "Search history");
  requireDataType("Google", dataTypes, "App activity", "App interactions");
  requireDataType("Google", dataTypes, "App info and performance", "Crash logs");
  requireDataType("Google", dataTypes, "App info and performance", "Diagnostics");
  requireDataType("Google", dataTypes, "Personal info", "User IDs");

  for (const item of dataTypes) {
    addCheck(`Google ${item.dataType} collected`, item.collected === true, `${item.dataType} should be marked collected if listed.`);
    addCheck(`Google ${item.dataType} not shared`, item.shared === false, `${item.dataType} must remain not shared.`);
    addCheck(`Google ${item.dataType} has purpose`, Array.isArray(item.purposes) && item.purposes.length > 0, `${item.dataType} needs at least one purpose.`);
  }

  for (const forbidden of ["Email address", "Phone number", "Precise location", "Contacts"]) {
    addCheck(`Google not collected ${forbidden}`, google.notCollected?.includes(forbidden), `${forbidden} should remain explicitly not collected.`);
  }
}

function validateDocs(docs) {
  const normalizedDocs = docs.toLowerCase();
  for (const phrase of [
    "Apple App Privacy",
    "Google Play Data safety",
    "Search History",
    "App activity",
    "not a people-search service",
    "native paid reports are disabled"
  ]) {
    addCheck(
      `Privacy docs mention ${phrase}`,
      normalizedDocs.includes(phrase.toLowerCase()),
      `docs/app-privacy-data-safety.md should mention ${phrase}.`
    );
  }
}

function requireDataType(platform, dataTypes, category, dataType) {
  addCheck(
    `${platform} declares ${category} / ${dataType}`,
    dataTypes.some((item) => item.category === category && item.dataType === dataType),
    `${platform} declaration must include ${category} / ${dataType}.`
  );
}

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function hasPlaceholder(value = "") {
  return /YOUR_|replace-with|example/i.test(value);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
