import { describe, expect, it } from "vitest";
import { createScanJob, createScanJobFromResults, publicSummary } from "./scanner";

describe("createScanJob", () => {
  it("creates a deterministic completed summary shape for a valid username", () => {
    const job = createScanJob({
      username: "khstar104",
      purpose: "SELF_CHECK",
      mode: "QUICK"
    });

    expect(job.status).toBe("COMPLETED");
    expect(job.progress).toBe(100);
    expect(job.checkedCount).toBeGreaterThan(10);
    expect(job.foundCount).toBe(job.results.filter((result) => result.status === "FOUND").length);
    expect(job.scanSource).toBe("LOCAL_FALLBACK");
    expect(job.rarityScore).toBeGreaterThanOrEqual(5);
    expect(job.rarityScore).toBeLessThanOrEqual(99);
    expect(job.previewResults.length).toBeLessThanOrEqual(4);
  });

  it("raises impersonation score for brand purpose compared with self check", () => {
    const username = "openbrand";
    const self = createScanJob({ username, purpose: "SELF_CHECK", mode: "DEEP" });
    const brand = createScanJob({ username, purpose: "BRAND_CHECK", mode: "DEEP" });

    expect(brand.impersonationScore).toBeGreaterThanOrEqual(self.impersonationScore);
  });
});

describe("createScanJobFromResults", () => {
  it("builds a summary from external scan results", () => {
    const job = createScanJobFromResults(
      {
        username: "external",
        purpose: "SELF_CHECK",
        mode: "QUICK"
      },
      [
        {
          id: "external-github",
          platform: "GitHub",
          url: "https://github.com/external",
          category: "DEVELOPER",
          country: "GLOBAL",
          status: "FOUND",
          riskLevel: "MEDIUM",
          cleanupHint: "Check profile."
        }
      ],
      {
        checkedCount: 100,
        failedRate: 3,
        maigretReport: {
          html: "<!doctype html><h1>Maigret</h1>",
          htmlFilename: "report_external_plain.html",
          generatedAt: "2026-06-11T00:00:01.000Z"
        },
        scanSource: "PUBLIC_SCAN",
        now: new Date("2026-06-11T00:00:00.000Z")
      }
    );

    expect(job.foundCount).toBe(1);
    expect(job.checkedCount).toBe(100);
    expect(job.failedRate).toBe(3);
    expect(job.scanSource).toBe("PUBLIC_SCAN");
    expect(job.maigretReportAvailable).toBe(true);
    expect(job.maigretReportFilename).toBe("report_external_plain.html");
    expect(job.previewResults).toHaveLength(1);
    expect(job.expiresAt).toBe("2026-06-12T00:00:00.000Z");
    expect(publicSummary(job)).not.toHaveProperty("maigretReport");
  });
});
