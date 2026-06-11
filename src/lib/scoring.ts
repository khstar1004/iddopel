import type { PlatformDefinition, ScanResult, ScoreBundle, ScanPurpose } from "./types";

export function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}

export function shouldMarkFound(username: string, platform: PlatformDefinition, index: number): boolean {
  const hash = stableHash(`${username}:${platform.id}`);
  const usernameBias = Math.min(22, username.length * 2);
  const threshold = 18 + platform.riskWeight * 2 + usernameBias + (index % 3) * 4;
  return hash % 100 < Math.min(threshold, 78);
}

export function riskFor(platform: PlatformDefinition, purpose: ScanPurpose): "LOW" | "MEDIUM" | "HIGH" {
  const brandBoost = purpose === "BRAND_CHECK" && ["SNS", "DOMAIN", "CREATOR"].includes(platform.category) ? 2 : 0;
  const risk = platform.riskWeight + brandBoost;

  if (risk >= 10) return "HIGH";
  if (risk >= 7) return "MEDIUM";
  return "LOW";
}

export function buildScores(results: ScanResult[], checkedCount: number, purpose: ScanPurpose): ScoreBundle {
  const found = results.filter((result) => result.status === "FOUND");
  const foundCount = found.length;
  const highRiskCount = found.filter((result) => result.riskLevel === "HIGH").length;
  const categoryCount = new Set(found.map((result) => result.category)).size;
  const countryCount = new Set(found.map((result) => result.country)).size;
  const cleanupSignals = found.filter((result) => ["BLOG", "COMMUNITY"].includes(result.category)).length;
  const brandMultiplier = purpose === "BRAND_CHECK" ? 1.2 : 1;

  const rarityScore = clamp(100 - foundCount * 6 - categoryCount * 3 - countryCount * 2, 5, 99);
  const exposureScore = clamp(Math.round(((foundCount / checkedCount) * 100 + highRiskCount * 9) * brandMultiplier), 0, 100);
  const impersonationScore = clamp(
    Math.round((foundCount * 5 + highRiskCount * 12 + (purpose === "BRAND_CHECK" ? 18 : 0)) * brandMultiplier),
    0,
    100
  );
  const cleanupScore = clamp(Math.round(cleanupSignals * 14 + highRiskCount * 8), 0, 100);
  const doppelgangerScore = clamp(
    Math.round(exposureScore * 0.42 + impersonationScore * 0.28 + cleanupScore * 0.18 + (100 - rarityScore) * 0.12),
    0,
    100
  );

  return {
    doppelgangerScore,
    rarityScore,
    exposureScore,
    impersonationScore,
    cleanupScore
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
