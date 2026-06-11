import { platformDefinitions } from "./platforms";
import { expiresAtForNonMember } from "./retention";
import { buildScores, clamp, shouldMarkFound, stableHash, riskFor } from "./scoring";
import type { CreateScanInput, MaigretReportArtifacts, ScanJob, ScanResult, ScanSource } from "./types";

export function createScanJob(input: CreateScanInput): ScanJob {
  const now = new Date();
  const checkedPlatforms = input.mode === "DEEP" ? platformDefinitions : platformDefinitions.slice(0, 18);
  const results: ScanResult[] = checkedPlatforms
    .map((platform, index) => {
      const found = shouldMarkFound(input.username, platform, index);
      const status: ScanResult["status"] = found
        ? "FOUND"
        : stableHash(`${platform.id}:${input.username}:unknown`) % 14 === 0
          ? "UNKNOWN"
          : "UNAVAILABLE";

      return {
        id: `${platform.id}-${index}`,
        platform: platform.name,
        url: platform.urlPattern.replaceAll("{username}", encodeURIComponent(input.username)),
        category: platform.category,
        country: platform.country,
        status,
        riskLevel: riskFor(platform, input.purpose),
        cleanupHint: platform.cleanupHint
      };
    })
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === "FOUND" ? -1 : 1;
      return left.platform.localeCompare(right.platform);
    });

  return createScanJobFromResults(input, results, {
    checkedCount: checkedPlatforms.length,
    now,
    scanSource: "LOCAL_FALLBACK"
  });
}

export function createScanJobFromResults(
  input: CreateScanInput,
  results: ScanResult[],
  options: {
    checkedCount: number;
    failedRate?: number;
    maigretReport?: MaigretReportArtifacts;
    now?: Date;
    scanSource?: ScanSource;
  }
): ScanJob {
  const now = options.now ?? new Date();
  const sortedResults = [...results].sort((left, right) => {
    if (left.status !== right.status) return left.status === "FOUND" ? -1 : 1;
    return left.platform.localeCompare(right.platform);
  });
  const foundResults = sortedResults.filter((result) => result.status === "FOUND");
  const checkedCount = Math.max(options.checkedCount, sortedResults.length);
  const unknownCount = results.filter((result) => result.status === "UNKNOWN").length;
  const scores = buildScores(sortedResults, checkedCount, input.purpose);
  const scanId = `scan_${stableHash(`${input.username}:${input.purpose}:${now.toISOString()}`).toString(36)}`;

  return {
    scanId,
    username: input.username,
    purpose: input.purpose,
    mode: input.mode ?? "QUICK",
    status: "COMPLETED",
    progress: 100,
    foundCount: foundResults.length,
    checkedCount,
    failedRate: clamp(options.failedRate ?? Math.round((unknownCount / checkedCount) * 100), 0, 100),
    countryDistribution: countBy(foundResults.map((result) => result.country)),
    categoryDistribution: countBy(foundResults.map((result) => result.category)),
    previewResults: foundResults.filter((result) => result.status === "FOUND").slice(0, 4),
    scanSource: options.scanSource ?? "LOCAL_FALLBACK",
    maigretReportAvailable: Boolean(options.maigretReport?.html),
    maigretReportFilename: options.maigretReport?.htmlFilename,
    maigretReport: options.maigretReport,
    results: sortedResults,
    createdAt: now.toISOString(),
    finishedAt: now.toISOString(),
    expiresAt: expiresAtForNonMember(now),
    ...scores
  };
}

export function publicSummary(job: ScanJob) {
  const { maigretReport: _maigretReport, results: _results, ...summary } = job;
  return summary;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}
