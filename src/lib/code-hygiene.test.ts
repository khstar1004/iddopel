import { describe, expect, it } from "vitest";
// @ts-ignore - This test exercises the Node release gate script directly.
import { scanTextForCodeHygiene, shouldScanPath } from "../../scripts/verify-code-hygiene.mjs";

describe("code hygiene verifier", () => {
  it("flags unresolved task markers", () => {
    const taskMarker = "TO" + "DO";
    const repairMarker = "FIX" + "ME";
    const findings = scanTextForCodeHygiene("src/app/page.tsx", [`// ${taskMarker}: later`, `// ${repairMarker}: later`].join("\n"));

    expect(findings).toEqual([
      expect.objectContaining({ file: "src/app/page.tsx", line: 1, type: "unresolved-task-marker" }),
      expect.objectContaining({ file: "src/app/page.tsx", line: 2, type: "unresolved-task-marker" })
    ]);
  });

  it("flags interactive breakpoints", () => {
    const statement = "debug" + "ger";
    const findings = scanTextForCodeHygiene("src/app/page.tsx", statement);

    expect(findings).toContainEqual(expect.objectContaining({ line: 1, type: "debug-statement" }));
  });

  it("flags leftover console tracing", () => {
    const statement = "console" + ".log" + "('leftover')";
    const findings = scanTextForCodeHygiene("native-web/app.js", statement);

    expect(findings).toContainEqual(expect.objectContaining({ line: 1, type: "console-debug-call" }));
  });

  it("flags narrowed test execution", () => {
    const statement = "it" + ".only" + "('leftover', () => {})";
    const findings = scanTextForCodeHygiene("tests/e2e/scan-flow.spec.ts", statement);

    expect(findings).toContainEqual(expect.objectContaining({ line: 1, type: "focused-or-skipped-test" }));
  });

  it("keeps the scan focused on release-relevant source paths", () => {
    expect(shouldScanPath("src/app/page.tsx")).toBe(true);
    expect(shouldScanPath("tests/e2e/scan-flow.spec.ts")).toBe(true);
    expect(shouldScanPath("native-web/app.js")).toBe(true);
    expect(shouldScanPath("ios/App/App/NativeBillingPlugin.swift")).toBe(true);
    expect(shouldScanPath("android/app/src/main/java/com/iddoppelganger/app/NativeBillingPlugin.java")).toBe(true);
    expect(shouldScanPath("scripts/verify-release-candidate.mjs")).toBe(false);
    expect(shouldScanPath("android/build/reports/problems/problems-report.html")).toBe(false);
    expect(shouldScanPath("node_modules/pkg/index.js")).toBe(false);
    expect(shouldScanPath("store-assets/google-play-listing.json")).toBe(false);
  });
});
