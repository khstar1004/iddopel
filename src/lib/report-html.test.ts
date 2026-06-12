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

  it("renders paid-report analysis sections before the raw result table", () => {
    const scan = {
      scanId: "scan_paid",
      username: "paiduser",
      purpose: "SELF_CHECK",
      mode: "QUICK",
      status: "COMPLETED",
      progress: 100,
      foundCount: 2,
      checkedCount: 100,
      failedRate: 0,
      doppelgangerScore: 65,
      rarityScore: 80,
      exposureScore: 35,
      impersonationScore: 42,
      cleanupScore: 55,
      countryDistribution: { GLOBAL: 1, KR: 1 },
      categoryDistribution: { SNS: 1, DEVELOPER: 1 },
      previewResults: [],
      results: [],
      createdAt: "2026-06-11T00:00:00.000Z",
      finishedAt: "2026-06-11T00:00:00.000Z",
      expiresAt: "2026-06-12T00:00:00.000Z"
    } satisfies ScanJob;

    const html = buildHtmlReport(scan, [
      {
        id: "github",
        platform: "GitHub",
        url: "https://github.com/paiduser",
        category: "DEVELOPER",
        country: "GLOBAL",
        status: "FOUND",
        riskLevel: "MEDIUM",
        cleanupHint: "Check profile."
      },
      {
        id: "instagram",
        platform: "Instagram",
        url: "https://www.instagram.com/paiduser",
        category: "SNS",
        country: "GLOBAL",
        status: "FOUND",
        riskLevel: "HIGH",
        cleanupHint: "Check public links."
      }
    ]);

    expect(html).toContain("유료 분석 보드");
    expect(html).toContain("위험도 분포");
    expect(html).toContain("정리 우선순위");
    expect(html).toContain("공유용 브리핑");
    expect(html).toContain("월간 추적 리포트 미리보기");
    expect(html).toContain("이번 달 발견");
    expect(html).toContain("7일 정리 플랜");
    expect(html).toContain("아이디 재사용 지도");
    expect(html.indexOf("유료 분석 보드")).toBeLessThan(html.indexOf("<table>"));
  });
});
