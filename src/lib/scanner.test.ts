import { describe, expect, it } from "vitest";
import { createScanJob, createScanJobFromResults, lockedPreviewInsightFor, lockedPreviewResultsFor, publicSummary } from "./scanner";
import type { ScanResult } from "./types";

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
    expect(job.previewResults.length).toBeLessThanOrEqual(5);
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

  it("picks only free-preview-enabled platforms for the preview section", () => {
    const job = createScanJobFromResults(
      {
        username: "externallist",
        purpose: "SELF_CHECK",
        mode: "QUICK"
      },
      [
        {
          id: "threads-1",
          platform: "Threads",
          url: "https://www.threads.net/@externallist",
          category: "SNS",
          country: "GLOBAL",
          status: "FOUND",
          riskLevel: "LOW",
          cleanupHint: "Check profile."
        },
        {
          id: "github-2",
          platform: "GitHub",
          url: "https://github.com/externallist",
          category: "DEVELOPER",
          country: "GLOBAL",
          status: "FOUND",
          riskLevel: "LOW",
          cleanupHint: "Check profile."
        },
        {
          id: "instagram-3",
          platform: "Instagram",
          url: "https://www.instagram.com/externallist",
          category: "SNS",
          country: "GLOBAL",
          status: "FOUND",
          riskLevel: "LOW",
          cleanupHint: "Check profile."
        },
        {
          id: "linkedin-4",
          platform: "LinkedIn",
          url: "https://www.linkedin.com/in/externallist",
          category: "GLOBAL",
          country: "GLOBAL",
          status: "FOUND",
          riskLevel: "LOW",
          cleanupHint: "Check profile."
        },
        {
          id: "tistory-5",
          platform: "Tistory",
          url: "https://externallist.tistory.com",
          category: "BLOG",
          country: "KR",
          status: "FOUND",
          riskLevel: "LOW",
          cleanupHint: "Check profile."
        },
        {
          id: "velog-6",
          platform: "Velog",
          url: "https://velog.io/@externallist",
          category: "DEVELOPER",
          country: "KR",
          status: "FOUND",
          riskLevel: "LOW",
          cleanupHint: "Check profile."
        },
        {
          id: "x-7",
          platform: "X",
          url: "https://x.com/externallist",
          category: "SNS",
          country: "GLOBAL",
          status: "FOUND",
          riskLevel: "LOW",
          cleanupHint: "Check profile."
        },
        {
          id: "kakao-story-8",
          platform: "KakaoStory",
          url: "https://story.kakao.com/externallist",
          category: "SNS",
          country: "KR",
          status: "FOUND",
          riskLevel: "LOW",
          cleanupHint: "Check profile."
        }
      ],
      {
        checkedCount: 100,
        now: new Date("2026-06-11T00:00:00.000Z")
      }
    );

    expect(job.foundCount).toBe(8);
    expect(job.previewResults.map((result) => result.platform)).toEqual([
      "GitHub",
      "Instagram",
      "KakaoStory",
      "Tistory",
      "Velog"
    ]);
    expect(job.previewResults).toHaveLength(5);
    expect(lockedPreviewResultsFor(job.results).map((result) => result.platform)).toEqual([
      "LinkedIn",
      "Threads",
      "X"
    ]);
    expect(JSON.stringify(lockedPreviewResultsFor(job.results))).not.toContain("https://");
  });

  it("keeps locked previews URL-safe and summarizes all locked candidates", () => {
    const results = [
      {
        id: "github-safe",
        platform: "GitHub",
        url: "https://github.com/safeteaser",
        platformIconUrl: "https://github.com/favicon.ico",
        category: "DEVELOPER",
        country: "GLOBAL",
        status: "FOUND",
        riskLevel: "HIGH",
        cleanupHint: "Check profile."
      },
      {
        id: "naver-safe",
        platform: "Naver",
        url: "https://blog.naver.com/safeteaser",
        platformIconUrl: "https://naver.com/favicon.ico",
        category: "BLOG",
        country: "KR",
        status: "FOUND",
        riskLevel: "MEDIUM",
        cleanupHint: "Check profile."
      },
      {
        id: "missing-safe",
        platform: "Missing",
        url: "https://missing.example/safeteaser",
        category: "GLOBAL",
        country: "US",
        status: "UNAVAILABLE",
        riskLevel: "LOW",
        cleanupHint: "Check profile."
      }
    ] satisfies ScanResult[];

    const locked = lockedPreviewResultsFor(results, { includeFreePreview: true });
    const insight = lockedPreviewInsightFor(results, { includeFreePreview: true });

    expect(locked).toHaveLength(2);
    expect(locked[0]).not.toHaveProperty("platformIconUrl");
    expect(JSON.stringify(locked)).not.toContain("https://");
    expect(insight).toEqual({
      totalCount: 2,
      riskDistribution: { HIGH: 1, MEDIUM: 1, LOW: 0 },
      countryDistribution: { GLOBAL: 1, KR: 1 },
      categoryDistribution: { DEVELOPER: 1, BLOG: 1 }
    });
  });

  it("uses URL host patterns when external scan platform names do not match local definitions", () => {
    const job = createScanJobFromResults(
      {
        username: "hostmatch",
        purpose: "SELF_CHECK",
        mode: "QUICK"
      },
      [
        {
          id: "maigret-tistory",
          platform: "External Blog",
          url: "https://hostmatch.tistory.com",
          category: "BLOG",
          country: "KR",
          status: "FOUND",
          riskLevel: "LOW",
          cleanupHint: "Check profile."
        },
        {
          id: "maigret-domain",
          platform: "External Domain",
          url: "https://hostmatch.com",
          category: "DOMAIN",
          country: "GLOBAL",
          status: "FOUND",
          riskLevel: "LOW",
          cleanupHint: "Check profile."
        }
      ],
      {
        checkedCount: 100,
        now: new Date("2026-06-11T00:00:00.000Z")
      }
    );

    expect(job.previewResults.map((result) => result.platform)).toEqual(["External Blog"]);
  });

  it("recognizes legacy Twitter results as X preview candidates", () => {
    const job = createScanJobFromResults(
      {
        username: "legacyx",
        purpose: "SELF_CHECK",
        mode: "QUICK"
      },
      [
        {
          id: "maigret-twitter",
          platform: "Twitter",
          url: "https://twitter.com/legacyx",
          category: "SNS",
          country: "GLOBAL",
          status: "FOUND",
          riskLevel: "HIGH",
          cleanupHint: "Check profile."
        }
      ],
      {
        checkedCount: 100,
        now: new Date("2026-06-11T00:00:00.000Z")
      }
    );

    expect(job.previewResults).toHaveLength(1);
    expect(publicSummary(job).previewResults[0]).toMatchObject({
      platform: "Twitter",
      url: "https://twitter.com/legacyx"
    });
  });

  it("rebuilds public summaries with the current free-preview policy", () => {
    const job = createScanJobFromResults(
      {
        username: "legacyscan",
        purpose: "SELF_CHECK",
        mode: "QUICK"
      },
      [
        {
          id: "github-legacy",
          platform: "GitHub",
          url: "https://github.com/legacyscan",
          category: "DEVELOPER",
          country: "GLOBAL",
          status: "FOUND",
          riskLevel: "LOW",
          cleanupHint: "Check profile."
        },
        {
          id: "linkedin-legacy",
          platform: "LinkedIn",
          url: "https://www.linkedin.com/in/legacyscan",
          category: "GLOBAL",
          country: "GLOBAL",
          status: "FOUND",
          riskLevel: "LOW",
          cleanupHint: "Check profile."
        }
      ],
      {
        checkedCount: 100,
        now: new Date("2026-06-11T00:00:00.000Z")
      }
    );

    const summary = publicSummary({
      ...job,
      previewResults: job.results.filter((result) => result.status === "FOUND")
    });

    expect(summary.previewResults.map((result) => result.platform)).toEqual(["GitHub"]);
    expect(summary.previewResults[0].url).toBe("https://github.com/legacyscan");
    expect(summary.previewResults[0].cleanupHint).toContain("Check profile");
  });

  it("shows public evidence for one free candidate and keeps the rest for full access", () => {
    const job = createScanJobFromResults(
      {
        username: "evidencegate",
        purpose: "SELF_CHECK",
        mode: "QUICK"
      },
      [
        {
          id: "github-evidence",
          platform: "GitHub",
          url: "https://github.com/evidencegate",
          category: "DEVELOPER",
          country: "GLOBAL",
          status: "FOUND",
          riskLevel: "MEDIUM",
          cleanupHint: "Check profile.",
          evidenceTitle: "evidencegate - GitHub",
          evidenceDescription: "Developer profile",
          evidenceSnippet: "Public repositories and profile links are visible."
        },
        {
          id: "instagram-evidence",
          platform: "Instagram",
          url: "https://www.instagram.com/evidencegate",
          category: "SNS",
          country: "GLOBAL",
          status: "FOUND",
          riskLevel: "HIGH",
          cleanupHint: "Check profile.",
          evidenceTitle: "evidencegate on Instagram",
          evidenceDescription: "Public creator account",
          evidenceSnippet: "Bio and connected profile links are visible."
        }
      ],
      {
        checkedCount: 100,
        now: new Date("2026-06-11T00:00:00.000Z")
      }
    );

    const summary = publicSummary(job);

    expect(job.results[0].evidenceSnippet).toBe("Public repositories and profile links are visible.");
    expect(job.results[1].evidenceSnippet).toBe("Bio and connected profile links are visible.");
    expect(summary.previewResults).toHaveLength(2);
    expect(summary.previewResults[0]).toMatchObject({
      platform: "GitHub",
      evidenceTitle: "evidencegate - GitHub",
      evidenceDescription: "Developer profile",
      evidenceSnippet: "Public repositories and profile links are visible."
    });
    expect(summary.previewResults[1]).toMatchObject({
      platform: "Instagram",
      url: "https://www.instagram.com/evidencegate",
      evidenceLocked: true
    });
    expect(summary.previewResults[1]).not.toHaveProperty("evidenceTitle");
    expect(summary.previewResults[1]).not.toHaveProperty("evidenceDescription");
    expect(summary.previewResults[1]).not.toHaveProperty("evidenceSnippet");
  });
});
