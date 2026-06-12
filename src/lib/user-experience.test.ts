import { describe, expect, it } from "vitest";

import {
  formatRetryAfter,
  parseMonitoringDraft,
  resultInsightTone,
  scanErrorPresentation,
  topDistributionEntries,
} from "./user-experience";

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
