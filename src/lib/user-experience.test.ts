import { describe, expect, it } from "vitest";

import {
  filterScanResults,
  formatExpirationStatus,
  formatNextRunStatus,
  formatRetryAfter,
  parseMonitoringDraft,
  prioritizeScanResults,
  resultRiskSummary,
  resultInsightTone,
  scanErrorPresentation,
  topDistributionEntries,
} from "./user-experience";
import type { ScanResult } from "./types";

describe("parseMonitoringDraft", () => {
  it("normalizes, deduplicates, limits, and reports invalid usernames", () => {
    const draft = parseMonitoringDraft(" alice, @bob bob charlie delta bad@email.com ", "", 3);

    expect(draft.usernames).toEqual(["alice", "bob", "charlie"]);
    expect(draft.extraCount).toBe(1);
    expect(draft.duplicateCount).toBe(1);
    expect(draft.invalid).toEqual(["bad@email.com"]);
  });

  it("falls back to the current scan username when the field is empty", () => {
    expect(parseMonitoringDraft("", "@current_user").usernames).toEqual(["current_user"]);
  });
});

describe("formatRetryAfter", () => {
  it("formats Korean retry delays", () => {
    expect(formatRetryAfter(45, "ko")).toBe("45초");
    expect(formatRetryAfter(125, "ko")).toBe("3분");
    expect(formatRetryAfter(7200, "ko")).toBe("2시간");
  });

  it("formats English retry delays", () => {
    expect(formatRetryAfter(45, "en")).toBe("45s");
    expect(formatRetryAfter(125, "en")).toBe("3 min");
    expect(formatRetryAfter(7200, "en")).toBe("2 hr");
  });
});

describe("scanErrorPresentation", () => {
  it("turns busy responses into actionable copy", () => {
    expect(
      scanErrorPresentation(
        {
          code: "BETA_SCAN_BUSY",
          message: "Too many scans are running.",
          retryAfterSeconds: 30,
        },
        "ko",
      ),
    ).toMatchObject({
      title: "검색 대기 중",
      action: "약 30초 후 다시 시도해 주세요.",
      tone: "busy",
    });
  });

  it("turns quota responses into a reset hint", () => {
    expect(
      scanErrorPresentation(
        {
          code: "BETA_FREE_SCAN_LIMITED",
          message: "Free quota used.",
          resetAt: "2026-06-13T00:00:00.000Z",
        },
        "en",
      ).message,
    ).toContain("Free beta searches are used up");
  });
});

describe("topDistributionEntries", () => {
  it("returns the largest distribution entries first", () => {
    expect(topDistributionEntries({ social: 4, dev: 9, forum: 1 }, 2)).toEqual([
      ["dev", 9],
      ["social", 4],
    ]);
  });
});

describe("resultInsightTone", () => {
  it("classifies exposure intensity", () => {
    expect(resultInsightTone({ exposureScore: 82, impersonationRiskScore: 20 })).toBe("high");
    expect(resultInsightTone({ exposureScore: 48, impersonationRiskScore: 20 })).toBe("medium");
    expect(resultInsightTone({ exposureScore: 12, impersonationRiskScore: 20 })).toBe("low");
  });
});

const sampleResults = [
  { id: "1", platform: "GitHub", country: "US", riskLevel: "HIGH", rank: 3 },
  { id: "2", platform: "Naver", country: "KR", riskLevel: "MEDIUM", rank: 1 },
  { id: "3", platform: "Blog", country: "KR", riskLevel: "LOW", rank: 2 },
  { id: "4", platform: "Forum", country: "GLOBAL", riskLevel: "HIGH", rank: 4 },
] as ScanResult[];

describe("filterScanResults", () => {
  it("filters by risk and region without mutating the original results", () => {
    expect(filterScanResults(sampleResults, "HIGH_RISK").map((result) => result.platform)).toEqual(["GitHub", "Forum"]);
    expect(filterScanResults(sampleResults, "KR").map((result) => result.platform)).toEqual(["Naver", "Blog"]);
    expect(filterScanResults(sampleResults, "GLOBAL").map((result) => result.platform)).toEqual(["GitHub", "Forum"]);
    expect(sampleResults.map((result) => result.platform)).toEqual(["GitHub", "Naver", "Blog", "Forum"]);
  });
});

describe("prioritizeScanResults", () => {
  it("sorts high-risk and lower-rank results first", () => {
    expect(prioritizeScanResults(sampleResults).map((result) => result.platform)).toEqual([
      "GitHub",
      "Forum",
      "Naver",
      "Blog",
    ]);
  });
});

describe("resultRiskSummary", () => {
  it("counts risk levels and exposes top risk platforms", () => {
    expect(resultRiskSummary(sampleResults)).toEqual({
      high: 2,
      medium: 1,
      low: 1,
      topRiskPlatforms: ["GitHub", "Forum"],
    });
  });
});

describe("relative schedule copy", () => {
  const now = new Date("2026-06-12T00:00:00.000Z");

  it("formats scan expiration status", () => {
    expect(formatExpirationStatus("2026-06-14T00:00:00.000Z", now, "ko")).toBe("2일 후 만료");
    expect(formatExpirationStatus("2026-06-14T00:00:00.000Z", now, "en")).toBe("Expires in 2 days");
    expect(formatExpirationStatus("2026-06-11T00:00:00.000Z", now, "ko")).toBe("만료됨");
  });

  it("formats next monitoring run status", () => {
    expect(formatNextRunStatus("2026-06-17T00:00:00.000Z", now, "ko")).toBe("다음 재점검까지 5일");
    expect(formatNextRunStatus("2026-06-17T00:00:00.000Z", now, "en")).toBe("Next recheck in 5 days");
    expect(formatNextRunStatus("2026-06-12T01:00:00.000Z", now, "ko")).toBe("오늘 재점검 예정");
  });
});
