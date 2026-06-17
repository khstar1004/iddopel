import { describe, expect, it } from "vitest";
// @ts-ignore - This test exercises the Node release gate script directly.
import { scanTextForIdentityAssurance, shouldScanIdentityAssurancePath } from "../../scripts/verify-identity-assurance.mjs";

describe("identity assurance verifier", () => {
  it("blocks CI and DI exposure in client-visible code", () => {
    const source = [
      "export function IdentityResult({ result }) {",
      "  return <pre>{result.unique_key}</pre>;",
      "}"
    ].join("\n");

    const findings = scanTextForIdentityAssurance("src/components/IdentityResult.tsx", source);

    expect(findings).toContainEqual(expect.objectContaining({ line: 2, type: "ci-plain-exposure" }));
  });

  it("blocks identity verification tokens in browser storage", () => {
    const source = "localStorage.setItem('identityVerificationToken', token);";

    const findings = scanTextForIdentityAssurance("native-web/app.js", source);

    expect(findings).toContainEqual(expect.objectContaining({ line: 1, type: "identity-token-client-storage" }));
  });

  it("requires a server verification marker for new identity integrations", () => {
    const source = "await PortOne.requestIdentityVerification({ storeId });";

    const findings = scanTextForIdentityAssurance("src/components/CheckoutClient.tsx", source);

    expect(findings).toContainEqual(expect.objectContaining({ type: "identity-flow-without-server-verification-marker" }));
  });

  it("allows documented server-verified identity integrations", () => {
    const source = [
      "/* IDENTITY_ASSURANCE_SERVER_VERIFIED */",
      "await PortOne.requestIdentityVerification({ storeId });"
    ].join("\n");

    expect(scanTextForIdentityAssurance("src/components/CheckoutClient.tsx", source)).toEqual([]);
  });

  it("keeps scanning focused on release-relevant files", () => {
    expect(shouldScanIdentityAssurancePath("src/components/CheckoutClient.tsx")).toBe(true);
    expect(shouldScanIdentityAssurancePath("native-web/app.js")).toBe(true);
    expect(shouldScanIdentityAssurancePath("docs/privacy-data-map.md")).toBe(true);
    expect(shouldScanIdentityAssurancePath("node_modules/pkg/index.js")).toBe(false);
    expect(shouldScanIdentityAssurancePath("store-assets/google-play-listing.json")).toBe(false);
  });
});
