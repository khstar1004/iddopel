import { describe, expect, it } from "vitest";
import { buildShareCardPng, buildShareCardSvg } from "./share-card";
import type { ScanSummary } from "./types";

const summary: ScanSummary = {
  scanId: "scan_share",
  username: "creator<id>",
  purpose: "SELF_CHECK",
  mode: "QUICK",
  status: "COMPLETED",
  progress: 100,
  foundCount: 7,
  checkedCount: 109,
  failedRate: 4,
  doppelgangerScore: 68,
  rarityScore: 51,
  exposureScore: 34,
  impersonationScore: 22,
  cleanupScore: 44,
  countryDistribution: { GLOBAL: 5, KR: 2 },
  categoryDistribution: { SNS: 3, BLOG: 2, DEVELOPER: 2 },
  previewResults: [
    {
      id: "private-url",
      platform: "GitHub",
      url: "https://github.com/creator-id",
      category: "DEVELOPER",
      country: "GLOBAL",
      status: "FOUND",
      riskLevel: "MEDIUM",
      cleanupHint: "Do not leak this in share card."
    }
  ],
  scanSource: "PUBLIC_SCAN",
  createdAt: "2026-06-11T00:00:00.000Z",
  finishedAt: "2026-06-11T00:01:00.000Z",
  expiresAt: "2026-06-12T00:00:00.000Z"
};

describe("buildShareCardSvg", () => {
  it("renders a viral-safe result card without platform URLs", () => {
    const svg = buildShareCardSvg(summary, { origin: "https://id.example.com" });

    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(svg).toContain("creator&lt;id&gt;");
    expect(svg).toContain("68점");
    expect(svg).toContain("공개 계정 후보 7개");
    expect(svg).toContain("id.example.com");
    expect(svg).not.toContain("https://github.com");
    expect(svg).not.toContain("Do not leak");
  });
});

describe("buildShareCardPng", () => {
  it("renders the share card to PNG bytes", async () => {
    const png = await buildShareCardPng(summary, { origin: "https://id.example.com" });

    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.length).toBeGreaterThan(20_000);
  });
});
