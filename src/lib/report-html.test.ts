import { describe, expect, it } from "vitest";
import { buildHtmlReport } from "./report-html";
import type { ScanJob } from "./types";

describe("buildHtmlReport", () => {
  it("escapes result fields before rendering HTML", () => {
    const scan = {
      scanId: "scan_test",
      username: "<script>alert(1)</script>",
      purpose: "SELF_CHECK",
      mode: "QUICK",
      status: "COMPLETED",
      progress: 100,
      foundCount: 1,
      checkedCount: 1,
      failedRate: 0,
      doppelgangerScore: 10,
      rarityScore: 90,
      exposureScore: 10,
      impersonationScore: 10,
      cleanupScore: 10,
      countryDistribution: { GLOBAL: 1 },
      categoryDistribution: { SNS: 1 },
      previewResults: [],
      results: [],
      createdAt: "2026-06-11T00:00:00.000Z",
      finishedAt: "2026-06-11T00:00:00.000Z",
      expiresAt: "2026-06-12T00:00:00.000Z"
    } satisfies ScanJob;

    const html = buildHtmlReport(scan, [
      {
        id: "xss",
        platform: "<img src=x onerror=alert(1)>",
        url: "https://example.com/?q=<script>",
        category: "SNS",
        country: "GLOBAL",
        status: "FOUND",
        riskLevel: "HIGH",
        cleanupHint: "Remove <b>bad</b>"
      }
    ]);

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
  });
});
