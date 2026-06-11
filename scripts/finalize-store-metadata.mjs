import { readFile, writeFile } from "node:fs/promises";

const origin = normalizeOrigin(process.env.STORE_PRODUCTION_ORIGIN || process.env.MOBILE_APP_ORIGIN || process.env.SITE_URL || "");
const supportEmail = process.env.STORE_SUPPORT_EMAIL?.trim() || "";
const dryRun = process.env.STORE_FINALIZE_DRY_RUN === "true";

if (!origin) {
  throw new Error("Set STORE_PRODUCTION_ORIGIN, MOBILE_APP_ORIGIN, or SITE_URL to a production HTTPS origin.");
}

const updates = [
  ["fastlane/metadata/ko-KR/privacy_url.txt", `${origin}/privacy\n`],
  ["fastlane/metadata/ko-KR/support_url.txt", `${origin}/responsible-use\n`],
  ["fastlane/metadata/ko-KR/marketing_url.txt", `${origin}/\n`]
];

const appleListing = JSON.parse(await readFile("store-assets/apple-app-store.json", "utf-8"));
appleListing.privacyPolicyUrl = `${origin}/privacy`;
appleListing.supportUrl = `${origin}/responsible-use`;
appleListing.marketingUrl = `${origin}/`;
updates.push(["store-assets/apple-app-store.json", `${JSON.stringify(appleListing, null, 2)}\n`]);

const googleListing = JSON.parse(await readFile("store-assets/google-play-listing.json", "utf-8"));
googleListing.privacyPolicyUrl = `${origin}/privacy`;
if (supportEmail) {
  googleListing.contactEmail = supportEmail;
}
updates.push(["store-assets/google-play-listing.json", `${JSON.stringify(googleListing, null, 2)}\n`]);

const privacyDeclarations = JSON.parse(await readFile("store-assets/privacy-declarations.json", "utf-8"));
privacyDeclarations.privacyPolicyUrl = `${origin}/privacy`;
privacyDeclarations.supportUrl = `${origin}/responsible-use`;
updates.push(["store-assets/privacy-declarations.json", `${JSON.stringify(privacyDeclarations, null, 2)}\n`]);

for (const [file, content] of updates) {
  if (!dryRun) {
    await writeFile(file, content);
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      dryRun,
      origin,
      supportEmailConfigured: Boolean(supportEmail),
      updatedFiles: updates.map(([file]) => file)
    },
    null,
    2
  )
);

function normalizeOrigin(value) {
  if (!value) return "";
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("Store production origin must use HTTPS.");
  }
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error("Store production origin must not be localhost.");
  }
  return `${url.protocol}//${url.host}`;
}
