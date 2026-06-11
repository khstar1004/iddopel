import { describe, expect, it } from "vitest";
// @ts-ignore - This test exercises the Node release gate script directly.
import { scanTextForSecrets, shouldScanPath } from "../../scripts/verify-secret-scan.mjs";

describe("secret scan verifier", () => {
  it("allows documented placeholders and environment references", () => {
    const findings = scanTextForSecrets(
      ".env.example",
      [
        "TOSS_SECRET_KEY=replace-with-toss-secret-key",
        "APPLE_PRIVATE_KEY=",
        "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON='...'",
        'TOSS_SECRET_KEY: "${TOSS_SECRET_KEY:?Set TOSS_SECRET_KEY}"',
        'DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DB"'
      ].join("\n")
    );

    expect(findings).toEqual([]);
  });

  it("flags real-looking payment secret assignments", () => {
    const token = "test" + "_sk_" + "a".repeat(32);
    const findings = scanTextForSecrets("docs/leak.md", `TOSS_SECRET_KEY=${token}`);

    expect(findings).toContainEqual(
      expect.objectContaining({
        file: "docs/leak.md",
        line: 1,
        type: "payment-secret-token"
      })
    );
  });

  it("flags private key material", () => {
    const privateKey = ["-----BEGIN " + "PRIVATE KEY-----", "abc123", "-----END " + "PRIVATE KEY-----"].join("\n");
    const findings = scanTextForSecrets("ios/AuthKey.p8", privateKey);

    expect(findings).toContainEqual(
      expect.objectContaining({
        file: "ios/AuthKey.p8",
        line: 1,
        type: "private-key"
      })
    );
  });

  it("flags production database URLs with embedded passwords", () => {
    const findings = scanTextForSecrets("README.md", 'DATABASE_URL="postgres://realuser:realpass@db.prod-domain.test:5432/app"');

    expect(findings).toContainEqual(
      expect.objectContaining({
        file: "README.md",
        line: 1,
        type: "sensitive-env-assignment"
      })
    );
  });

  it("skips generated, dependency, and local secret-bearing env files", () => {
    expect(shouldScanPath("node_modules/pkg/index.js")).toBe(false);
    expect(shouldScanPath(".maigret-venv/Lib/site-packages/pkg/key.pem")).toBe(false);
    expect(shouldScanPath(".next/server/app.js")).toBe(false);
    expect(shouldScanPath("test-results/trace.zip")).toBe(false);
    expect(shouldScanPath(".env")).toBe(false);
    expect(shouldScanPath("deploy/compose/.env")).toBe(false);
    expect(shouldScanPath(".env.example")).toBe(true);
    expect(shouldScanPath("deploy/compose/.env.example")).toBe(true);
  });
});
