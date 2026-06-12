import { afterEach, describe, expect, it } from "vitest";
import { publicScanResponse } from "./scan-response";
import { createScanJobFromResults } from "./scanner";

describe("publicScanResponse", () => {
  const originalInlineArtifacts = process.env.INLINE_SCAN_ARTIFACTS;

  afterEach(() => {
    restoreEnv("INLINE_SCAN_ARTIFACTS", originalInlineArtifacts);
  });

  it("keeps full results and source HTML out of the default public response", () => {
    delete process.env.INLINE_SCAN_ARTIFACTS;

    const response = publicScanResponse(scanFixture());

    expect(response).not.toHaveProperty("fullResults");
    expect(response).not.toHaveProperty("sourceReportHtml");
  });

  it("keeps full results and source HTML out even when legacy inline artifacts are enabled", () => {
    process.env.INLINE_SCAN_ARTIFACTS = "true";

    const response = publicScanResponse(scanFixture());

    expect(response).not.toHaveProperty("fullResults");
    expect(response).not.toHaveProperty("sourceReportHtml");
  });

  it("returns safe locked previews without exact URLs or cleanup guidance", () => {
    const response = publicScanResponse(scanWithLockedFixture());

    expect(response.lockedResults).toEqual([
      expect.objectContaining({
        platform: "LinkedIn",
        category: "GLOBAL",
        country: "GLOBAL",
        riskLevel: "LOW"
      })
    ]);
    expect(JSON.stringify(response.lockedResults)).not.toContain("https://");
    expect(JSON.stringify(response.lockedResults)).not.toContain("Check profile.");
  });
});

function scanFixture() {
  return createScanJobFromResults(
    {
      username: "inlinebeta",
      purpose: "SELF_CHECK",
      mode: "QUICK"
    },
    [
      {
        id: "inline-github",
        platform: "GitHub",
        url: "https://github.com/inlinebeta",
        category: "DEVELOPER",
        country: "GLOBAL",
        status: "FOUND",
        riskLevel: "MEDIUM",
        cleanupHint: "Check profile."
      }
    ],
    {
      checkedCount: 25,
      maigretReport: {
        html: "<!doctype html><html><head><script>alert(1)</script></head><body><h1>Source</h1></body></html>",
        htmlFilename: "report_inlinebeta_plain.html"
      },
      scanSource: "PUBLIC_SCAN",
      now: new Date("2026-06-12T00:00:00.000Z")
    }
  );
}

function scanWithLockedFixture() {
  return createScanJobFromResults(
    {
      username: "lockedinline",
      purpose: "SELF_CHECK",
      mode: "QUICK"
    },
    [
      {
        id: "locked-github",
        platform: "GitHub",
        url: "https://github.com/lockedinline",
        category: "DEVELOPER",
        country: "GLOBAL",
        status: "FOUND",
        riskLevel: "MEDIUM",
        cleanupHint: "Check profile."
      },
      {
        id: "locked-linkedin",
        platform: "LinkedIn",
        url: "https://www.linkedin.com/in/lockedinline",
        category: "GLOBAL",
        country: "GLOBAL",
        status: "FOUND",
        riskLevel: "LOW",
        cleanupHint: "Check profile."
      }
    ],
    {
      checkedCount: 25,
      now: new Date("2026-06-12T00:00:00.000Z")
    }
  );
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
