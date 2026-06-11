import { describe, expect, it } from "vitest";
import { getSeoGuide, getGuideUrl, seoGuides } from "./seo-guides";

describe("seoGuides", () => {
  it("defines unique stable guide slugs for sitemap generation", () => {
    const slugs = seoGuides.map((guide) => guide.slug);

    expect(new Set(slugs).size).toBe(seoGuides.length);
    expect(slugs).toContain("id-rarity-test");
    expect(slugs).toContain("nickname-search");
    expect(slugs).toContain("impersonation-check");
    expect(slugs).toContain("namechk-alternative");
    expect(slugs).toContain("footprintiq-alternative");
  });

  it("keeps every guide aligned to safe username-string positioning", () => {
    for (const guide of seoGuides) {
      expect(guide.primaryKeyword.length).toBeGreaterThan(0);
      expect(guide.secondaryKeywords.length).toBeGreaterThanOrEqual(3);
      expect(`${guide.description} ${guide.safetyCopy}`).toMatch(/아이디|username|닉네임|활동명|브랜드명/);
      expect(guide.safetyCopy).not.toMatch(/실명으로 찾|전화번호로 찾|동일인 확률을 계산|동일인 확률 [0-9]/);
    }
  });

  it("looks up guide content and canonical URLs", () => {
    expect(getSeoGuide("brand-username-check")?.primaryKeyword).toBe("브랜드명 계정 확인");
    expect(getSeoGuide("missing")).toBeNull();
    expect(getGuideUrl("old-account-check")).toBe("/guides/old-account-check");
  });

  it("keeps competitor comparison guides substantive and honest", () => {
    const competitorGuides = seoGuides.filter((guide) => guide.comparison);

    expect(competitorGuides.length).toBeGreaterThanOrEqual(5);
    for (const guide of competitorGuides) {
      expect(guide.primaryKeyword).toMatch(/대안|비교|alternative/i);
      expect(guide.comparison?.competitorName).toBeTruthy();
      expect(guide.comparison?.sourceUrl).toMatch(/^https:\/\//);
      expect(guide.comparison?.competitorStrengths.length).toBeGreaterThanOrEqual(2);
      expect(guide.comparison?.idDoppelgangerAdvantages.length).toBeGreaterThanOrEqual(3);
      expect(guide.comparison?.bestForIdDoppelganger).toMatch(/한국어|토스|리포트|안전|공유/);
      expect(guide.safetyCopy).toMatch(/동일인|실명|전화번호|이메일|username|아이디/);
    }
  });
});
