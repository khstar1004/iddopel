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

  it("includes sanitized inline artifacts for Vercel beta client-side rendering", () => {
    process.env.INLINE_SCAN_ARTIFACTS = "true";

    const response = publicScanResponse(scanFixture());

    expect(response.fullResults).toHaveLength(1);
    expect(response.sourceReportHtml).toContain("<h1>Source</h1>");
    expect(response.sourceReportHtml).not.toContain("<script>");
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

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
