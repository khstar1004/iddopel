import { platformDefinitions } from "./platforms";
import { expiresAtForNonMember } from "./retention";
import { buildScores, clamp, shouldMarkFound, stableHash, riskFor } from "./scoring";
import type {
  CreateScanInput,
  LockedPreviewInsight,
  LockedScanResultPreview,
  MaigretReportArtifacts,
  ScanJob,
  ScanResult,
  ScanSource
} from "./types";

export const FREE_PREVIEW_LIMIT = 5;
export const FREE_EVIDENCE_PREVIEW_LIMIT = 1;
export const LOCKED_PREVIEW_LIMIT = 5;

const platformDefinitionsById = new Map(platformDefinitions.map((platform) => [platform.id, platform]));
const platformDefinitionsByName = new Map<string, typeof platformDefinitions[number]>();
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
  platformDefinitionsByName.set(normalizePlatformText(platform.name), platform);
  for (const alias of platform.aliases ?? []) {
    platformDefinitionsByName.set(normalizePlatformText(alias), platform);
  }

  const host = platformHostFromPattern(platform.urlPattern);
  if (host) platformDefinitionsByHost.set(host, platform);

  for (const hostAlias of platform.hostAliases ?? []) {
    platformDefinitionsByHost.set(normalizeHost(hostAlias), platform);
  }
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
  const freePreviewLocked = Boolean(job.freePreviewLocked);

  return {
    ...summary,
    previewResults: freePreviewLocked ? [] : publicPreviewResultsFor(job.results),
    lockedResults: lockedPreviewResultsFor(job.results, { includeFreePreview: freePreviewLocked }),
    lockedInsight: lockedPreviewInsightFor(job.results, { includeFreePreview: freePreviewLocked })
  };
}

export function foundScanResults(results: ScanResult[]) {
  return results.filter((result) => result.status === "FOUND");
}

export function freePreviewResultsFor(results: ScanResult[]) {
  return foundScanResults(results).filter((result) => canShowInFreePreview(result)).slice(0, FREE_PREVIEW_LIMIT);
}

export function publicPreviewResultsFor(results: ScanResult[]) {
  return freePreviewResultsFor(results).map((result, index) => publicScanResultForPreview(result, index));
}

export function lockedResultsCountFor(results: ScanResult[], options: { includeFreePreview?: boolean } = {}) {
  return lockedCandidateResultsFor(results, options).length;
}

export function lockedPreviewResultsFor(
  results: ScanResult[],
  options: { includeFreePreview?: boolean } = {}
): LockedScanResultPreview[] {
  return lockedCandidateResultsFor(results, options)
    .slice(0, LOCKED_PREVIEW_LIMIT)
    .map((result) => ({
      id: result.id,
      platform: result.platform,
      maskedUrl: maskedUrlPreviewFor(result.url),
      category: result.category,
      country: result.country,
      riskLevel: result.riskLevel
    }));
}

export function lockedPreviewInsightFor(
  results: ScanResult[],
  options: { includeFreePreview?: boolean } = {}
): LockedPreviewInsight {
  const lockedCandidates = lockedCandidateResultsFor(results, options);

  return {
    totalCount: lockedCandidates.length,
    riskDistribution: {
      HIGH: lockedCandidates.filter((result) => result.riskLevel === "HIGH").length,
      MEDIUM: lockedCandidates.filter((result) => result.riskLevel === "MEDIUM").length,
      LOW: lockedCandidates.filter((result) => result.riskLevel === "LOW").length
    },
    countryDistribution: countBy(lockedCandidates.map((result) => result.country)),
    categoryDistribution: countBy(lockedCandidates.map((result) => result.category))
  };
}

function lockedCandidateResultsFor(results: ScanResult[], options: { includeFreePreview?: boolean } = {}) {
  const previewIds = options.includeFreePreview
    ? new Set<string>()
    : new Set(freePreviewResultsFor(results).map((result) => result.id));

  return foundScanResults(results).filter((result) => !previewIds.has(result.id));
}

function maskedUrlPreviewFor(value: string) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./, "");
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const hasProfilePrefix = pathParts.length > 1 && ["@", "in", "u", "user", "channel", "station"].includes(pathParts[0]);
    const profilePart = (hasProfilePrefix ? pathParts[1] : pathParts[0]) ?? "profile";
    const profilePrefix = profilePart.replace(/^@/, "").slice(0, Math.min(4, profilePart.length));
    const routePrefix = hasProfilePrefix ? `${pathParts[0]}/` : "";
    return `${host}/${routePrefix}${profilePrefix}${"•".repeat(Math.max(4, Math.min(8, profilePart.length)))}`;
  } catch {
    return "상세 URL 잠김";
  }
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

function publicScanResultForPreview(result: ScanResult, index: number): ScanResult {
  if (index < FREE_EVIDENCE_PREVIEW_LIMIT) {
    return { ...result };
  }

  const hasLockedEvidence = Boolean(
    result.evidenceTitle || result.evidenceDescription || result.evidenceImageUrl || result.evidenceSnippet
  );
  const {
    evidenceDescription: _evidenceDescription,
    evidenceFetchedAt: _evidenceFetchedAt,
    evidenceImageUrl: _evidenceImageUrl,
    evidenceSnippet: _evidenceSnippet,
    evidenceTitle: _evidenceTitle,
    profileImageUrl: _profileImageUrl,
    ...publicResult
  } = result;

  return {
    ...publicResult,
    evidenceLocked: hasLockedEvidence || undefined
  };
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
    return normalizeHost(new URL(testInput).hostname);
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
    return normalizeHost(new URL(value).hostname);
  } catch {
    return null;
  }
}

function normalizeHost(value: string) {
  return value.replace(/^www\./, "").toLowerCase();
}
