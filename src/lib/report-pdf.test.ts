import { describe, expect, it } from "vitest";
import { buildPdfReport } from "./report-pdf";
import type { ScanJob } from "./types";

describe("buildPdfReport", () => {
  it("renders a downloadable PDF buffer for a paid report", async () => {
    const scan = {
      scanId: "scan_pdf",
      username: "brand_kr",
      purpose: "BRAND_CHECK",
      mode: "QUICK",
      status: "COMPLETED",
      progress: 100,
      foundCount: 1,
      checkedCount: 2,
      failedRate: 0,
      doppelgangerScore: 72,
      rarityScore: 61,
      exposureScore: 54,
      impersonationScore: 33,
      cleanupScore: 22,
      countryDistribution: { KR: 1 },
      categoryDistribution: { SNS: 1 },
      previewResults: [],
      results: [],
      createdAt: "2026-06-11T00:00:00.000Z",
      finishedAt: "2026-06-11T00:00:00.000Z",
      expiresAt: "2026-09-09T00:00:00.000Z"
    } satisfies ScanJob;

    const pdf = await buildPdfReport(scan, [
      {
        id: "found",
        platform: "Instagram",
        url: "https://instagram.com/brand_kr",
        category: "SNS",
        country: "KR",
        status: "FOUND",
        riskLevel: "MEDIUM",
        cleanupHint: "프로필 소유 여부를 확인하고 브랜드 설명을 통일하세요."
      }
    ]);

    expect(pdf.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(10_000);
  });
});
