import { platformDefinitions } from "./platforms";
import { expiresAtForNonMember } from "./retention";
import { buildScores, clamp, shouldMarkFound, stableHash, riskFor } from "./scoring";
import type {
  CreateScanInput,
  LockedScanResultPreview,
  MaigretReportArtifacts,
  ScanJob,
  ScanResult,
  ScanSource
} from "./types";

export const FREE_PREVIEW_LIMIT = 3;
export const LOCKED_PREVIEW_LIMIT = 5;

const platformDefinitionsById = new Map(platformDefinitions.map((platform) => [platform.id, platform]));
const platformDefinitionsByName = new Map(
  platformDefinitions.map((platform) => [normalizePlatformText(platform.name), platform])
);
const platformDefinitionsByHost = new Map<string, typeof platformDefinitions[number]>();
const platformDefinitionsByHostSuffix = platformDefinitions
  .map((platform) => ({
    platform,
    hostSuffix: platformHostSuffixFromPattern(platform.urlPattern)
  }))
  .filter((entry): entry is { platform: typeof platformDefinitions[number]; hostSuffix: string } =>
    Boolean(entry.hostSuffix)
  );

for (const platform of platformDefinitions) {
  const host = platformHostFromPattern(platform.urlPattern);
  if (host) platformDefinitionsByHost.set(host, platform);
}

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
  const previewResults = freePreviewResultsFor(sortedResults);

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
    previewResults,
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
  return {
    ...summary,
    previewResults: publicPreviewResultsFor(job.results),
    lockedResults: lockedPreviewResultsFor(job.results)
  };
}

export function foundScanResults(results: ScanResult[]) {
  return results.filter((result) => result.status === "FOUND");
}

export function freePreviewResultsFor(results: ScanResult[]) {
  return foundScanResults(results).filter((result) => canShowInFreePreview(result)).slice(0, FREE_PREVIEW_LIMIT);
}

export function publicPreviewResultsFor(results: ScanResult[]) {
  return freePreviewResultsFor(results).map(redactScanResultForPreview);
}

export function lockedResultsCountFor(results: ScanResult[]) {
  return Math.max(0, foundScanResults(results).length - freePreviewResultsFor(results).length);
}

export function lockedPreviewResultsFor(results: ScanResult[]): LockedScanResultPreview[] {
  const previewIds = new Set(freePreviewResultsFor(results).map((result) => result.id));

  return foundScanResults(results)
    .filter((result) => !previewIds.has(result.id))
    .slice(0, LOCKED_PREVIEW_LIMIT)
    .map((result) => ({
      id: result.id,
      platform: result.platform,
      platformIconUrl: result.platformIconUrl,
      category: result.category,
      country: result.country,
      riskLevel: result.riskLevel
    }));
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}

function canShowInFreePreview(result: ScanResult) {
  const definition = resolvePlatformDefinition(result);
  return Boolean(definition?.freePreview);
}

function redactScanResultForPreview(result: ScanResult): ScanResult {
  return {
    ...result,
    url: publicPlatformUrlFor(result),
    cleanupHint: "정확한 URL과 정리 가이드는 전체 리포트에서 확인하세요.",
    tags: undefined,
    rank: undefined,
    httpStatus: undefined
  };
}

function publicPlatformUrlFor(result: ScanResult) {
  const definition = resolvePlatformDefinition(result);
  if (definition) return platformPublicUrlFromPattern(definition.urlPattern);

  return publicOriginFromUrl(result.url);
}

function platformPublicUrlFromPattern(pattern: string) {
  const markerIndex = pattern.indexOf("{");
  const visiblePattern = markerIndex >= 0 ? pattern.slice(0, markerIndex) : pattern;
  const fallbackPattern = pattern.replace(/\{[^}]+\}/g, "profile");

  try {
    const parsed = new URL(visiblePattern || fallbackPattern);
    return parsed.origin;
  } catch {
    return publicOriginFromUrl(fallbackPattern).replace("://profile.", "://");
  }
}

function publicOriginFromUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    return "https://example.com";
  }
}

function resolvePlatformDefinition(result: ScanResult) {
  const exactIdMatch = platformDefinitionsById.get(result.id);
  if (exactIdMatch) return exactIdMatch;

  const idPrefixMatch = platformDefinitions.find((platform) => result.id.startsWith(`${platform.id}-`));
  if (idPrefixMatch) return idPrefixMatch;

  const byExactName = platformDefinitionsByName.get(normalizePlatformText(result.platform));
  if (byExactName) return byExactName;

  const host = hostFromUrl(result.url);
  if (!host) return undefined;

  const exactHostMatch = platformDefinitionsByHost.get(host);
  if (exactHostMatch) return exactHostMatch;

  return platformDefinitionsByHostSuffix.find((entry) => host === entry.hostSuffix || host.endsWith(`.${entry.hostSuffix}`))?.platform;
}

function normalizePlatformText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function platformHostFromPattern(pattern: string): string | null {
  const testInput = pattern.replace(/\{[^}]+\}/g, "example");
  try {
    return new URL(testInput).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function platformHostSuffixFromPattern(pattern: string): string | null {
  if (!pattern.includes("{")) return null;

  const host = platformHostFromPattern(pattern);
  if (!host) return null;

  const suffix = host.replace(/^example\./, "");
  return suffix === host ? null : suffix;
}

function hostFromUrl(value: string): string | null {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
