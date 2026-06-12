import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-ignore - This test exercises the Node release gate script directly.
import { createStorePrivacyReport } from "../../scripts/verify-store-privacy.mjs";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function readCurrentStorePrivacyInputs() {
  return {
    declaration: readJson<Record<string, any>>("store-assets/privacy-declarations.json"),
    appleListing: readJson<Record<string, any>>("store-assets/apple-app-store.json"),
    googleListing: readJson<Record<string, any>>("store-assets/google-play-listing.json"),
    docs: readFileSync("docs/app-privacy-data-safety.md", "utf-8")
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildPaidNativeDeclaration(declaration: Record<string, any>) {
  const paidDeclaration = cloneJson(declaration);
  paidDeclaration.nativePaidReportsEnabled = true;

  paidDeclaration.appleAppPrivacy.dataTypes.push({
    category: "Purchases",
    dataType: "Purchase History",
    fields: ["App Store transaction id", "StoreKit product id"],
    purposes: ["App Functionality", "Fraud Prevention"],
    linkedToUser: false,
    usedForTracking: false
  });
  paidDeclaration.appleAppPrivacy.notCollected = paidDeclaration.appleAppPrivacy.notCollected.filter(
    (item: string) => item !== "Purchases"
  );

  paidDeclaration.googlePlayDataSafety.dataTypes.push({
    category: "Financial info",
    dataType: "Purchase history",
    fields: ["Google Play purchase token", "Play product id"],
    collected: true,
    shared: false,
    required: false,
    purposes: ["App functionality", "Fraud prevention, security, and compliance"]
  });
  paidDeclaration.googlePlayDataSafety.notCollected = paidDeclaration.googlePlayDataSafety.notCollected.filter(
    (item: string) => item !== "Financial info"
  );

  return paidDeclaration;
}

function checkNames(report: { checks: Array<{ name: string; ok: boolean }> }, ok: boolean) {
  return report.checks.filter((check) => check.ok === ok).map((check) => check.name);
}

describe("store privacy verification", () => {
  it("passes the current beta declarations while native paid reports are disabled", () => {
    const inputs = readCurrentStorePrivacyInputs();

    const report = createStorePrivacyReport({
      ...inputs,
      mobilePaymentsEnabled: false
    });

    expect(report.ok).toBe(true);
    expect(checkNames(report, false)).toEqual([]);
  });

  it("blocks native paid reports when store purchase privacy declarations are still disabled", () => {
    const inputs = readCurrentStorePrivacyInputs();

    const report = createStorePrivacyReport({
      ...inputs,
      mobilePaymentsEnabled: true
    });

    expect(report.ok).toBe(false);
    expect(checkNames(report, false)).toEqual(
      expect.arrayContaining([
        "Native paid reports declared enabled",
        "Apple declares Purchases / Purchase History",
        "Apple purchase history no longer marked not collected",
        "Google declares Financial info / Purchase history",
        "Google purchase history no longer marked not collected"
      ])
    );
  });

  it("passes native paid reports only after Apple and Google purchase history declarations are aligned", () => {
    const inputs = readCurrentStorePrivacyInputs();
    const paidDeclaration = buildPaidNativeDeclaration(inputs.declaration);
    const paidDocs = [
      inputs.docs,
      "Native paid reports are enabled only after App Store and Play Store console answers are updated.",
      "Apple App Privacy declares Purchases / Purchase History for native report unlocks.",
      "Google Play Data safety declares Financial info / Purchase history and the purchase token used for entitlement verification."
    ].join("\n");

    const report = createStorePrivacyReport({
      ...inputs,
      declaration: paidDeclaration,
      docs: paidDocs,
      mobilePaymentsEnabled: true
    });

    expect(report.ok).toBe(true);
    expect(checkNames(report, false)).toEqual([]);
  });
});
