import { writeFile } from "node:fs/promises";

const origin = requiredUrl("MOBILE_APP_ORIGIN", process.env.MOBILE_APP_ORIGIN);
const supportUrl = process.env.MOBILE_SUPPORT_URL || `${origin}/responsible-use`;
const privacyUrl = process.env.MOBILE_PRIVACY_URL || `${origin}/privacy`;
const termsUrl = process.env.MOBILE_TERMS_URL || `${origin}/terms`;
const paymentsEnabled = process.env.MOBILE_PAYMENTS_ENABLED === "true";
const appleDetailedReportProductId = process.env.APPLE_DETAILED_REPORT_PRODUCT_ID || "detailed_report";
const googlePlayDetailedReportProductId = process.env.GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID || "detailed_report";

const config = `window.IDD_APP_CONFIG = ${JSON.stringify(
  {
    apiBaseUrl: origin,
    paymentsEnabled,
    appleDetailedReportProductId,
    googlePlayDetailedReportProductId,
    supportUrl,
    privacyUrl,
    termsUrl
  },
  null,
  2
)};
`;

await writeFile("native-web/app-config.js", config, "utf-8");
console.log(`Configured native-web/app-config.js for ${origin}`);

function requiredUrl(name, value) {
  if (!value) {
    throw new Error(`${name} is required, for example: ${name}=https://example.com`);
  }

  const parsed = new URL(value);
  if (parsed.protocol !== "https:") {
    throw new Error(`${name} must be an https URL for store builds`);
  }
  return parsed.origin;
}
