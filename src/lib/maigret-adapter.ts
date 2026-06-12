import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { categoryLabels } from "./labels";
import { stableHash } from "./scoring";
import type { CreateScanInput, MaigretReportArtifacts, PlatformCategory, RiskLevel, ScanResult } from "./types";

interface MaigretRunOutput {
  results: ScanResult[];
  checkedCount: number;
  failedRate: number;
  report?: MaigretReportArtifacts;
}

interface MaigretRunOptions {
  origin?: string;
}

type MaigretReportRecord = Record<string, unknown>;

interface MaigretCliRunResult {
  output: string;
  reportJson: string;
  htmlReport?: MaigretReportArtifacts;
  checkedCount: number;
}

interface MaigretCliScope {
  topSites?: number;
  allSites?: boolean;
  siteNames?: string[];
  tags?: string[];
}

interface RemoteMaigretResponse {
  ok?: boolean;
  checkedCount?: number;
  failedRate?: number;
  reportJson?: string;
  htmlReport?: {
    html?: string;
    htmlFilename?: string;
  } | null;
  error?: {
    code?: string;
    message?: string;
  };
}

const countryTags: Record<string, ScanResult["country"]> = {
  kr: "KR",
  korea: "KR",
  south_korea: "KR",
  us: "US",
  usa: "US",
  jp: "JP",
  japan: "JP"
};

const categoryTags: Array<[PlatformCategory, string[]]> = [
  ["SNS", ["social", "sns", "microblog", "twitter", "instagram", "facebook"]],
  ["BLOG", ["blog", "writing", "journal"]],
  ["COMMUNITY", ["forum", "community", "discussion"]],
  ["DEVELOPER", ["dev", "developer", "coding", "programming", "git", "software"]],
  ["CREATOR", ["video", "music", "photo", "design", "art", "portfolio", "streaming"]],
  ["COMMERCE", ["market", "commerce", "shop", "store"]],
  ["DOMAIN", ["domain", "dns", "website"]]
];

const defaultPrioritySiteNames = [
  "Instagram",
  "Twitter",
  "Threads",
  "TikTok",
  "YouTube",
  "Facebook",
  "LinkedIn",
  "Naver",
  "GitHub",
  "GitHubGist",
  "Reddit"
];
const defaultCriticalSiteNames = ["Twitter", "Instagram", "Threads"];
const defaultBoostTagSpecs: MaigretBoostTagSpec[] = [
  { tag: "kr", limit: 30 },
  { tag: "social", limit: 35 },
  { tag: "photo", limit: 16 },
  { tag: "video", limit: 16 },
  { tag: "blog", limit: 20 },
  { tag: "coding", limit: 20 },
  { tag: "music", limit: 10 },
  { tag: "design", limit: 10 },
  { tag: "streaming", limit: 8 },
  { tag: "messaging", limit: 8 }
];
const defaultExcludedSiteNames = ["Geeksfor Geeks"];
const defaultExcludedTags = ["porn"];

interface MaigretBoostTagSpec {
  tag: string;
  limit: number;
}

export async function runMaigretScan(input: CreateScanInput, options: MaigretRunOptions = {}): Promise<MaigretRunOutput> {
  if (shouldUseRemoteMaigret()) {
    return runRemoteMaigretScan(input, options);
  }

  const command = process.env.MAIGRET_BIN || "maigret";
  const topSites = resolveTopSites(input.mode ?? "QUICK");
  const timeoutSeconds = Number(process.env.MAIGRET_SITE_TIMEOUT_SECONDS || "6");
  const processTimeoutMs = Number(process.env.MAIGRET_PROCESS_TIMEOUT_MS || "58000");
  const maxConnections = Number(process.env.MAIGRET_MAX_CONNECTIONS || "20");
  const retries = Number(process.env.MAIGRET_RETRIES || "1");
  const primary = await runMaigretCli(command, input, {
    processTimeoutMs,
    scope:
      input.mode === "DEEP" && process.env.MAIGRET_DEEP_ALL === "true"
        ? { allSites: true }
        : { topSites },
    timeoutSeconds,
    retries,
    maxConnections
  });
  const prioritySiteNames = resolvePrioritySiteNames();
  const priority =
    prioritySiteNames.length > 0
      ? await runMaigretCli(command, input, {
          processTimeoutMs: Number(process.env.MAIGRET_PRIORITY_PROCESS_TIMEOUT_MS || Math.min(processTimeoutMs, 30000)),
          scope: { siteNames: prioritySiteNames },
          timeoutSeconds: Number(process.env.MAIGRET_PRIORITY_SITE_TIMEOUT_SECONDS || Math.max(timeoutSeconds, 14)),
          retries: Number(process.env.MAIGRET_PRIORITY_RETRIES || Math.max(retries, 1)),
          maxConnections: Number(process.env.MAIGRET_PRIORITY_MAX_CONNECTIONS || Math.min(maxConnections, 6))
        })
      : null;
  const boostScope = resolveBoostTagCliScope();
  const boost =
    boostScope.tags.length > 0
      ? await runMaigretCli(command, input, {
          processTimeoutMs: Number(process.env.MAIGRET_BOOST_PROCESS_TIMEOUT_MS || Math.min(processTimeoutMs, 45000)),
          scope: { tags: boostScope.tags, topSites: boostScope.topSites },
          timeoutSeconds: Number(process.env.MAIGRET_BOOST_SITE_TIMEOUT_SECONDS || timeoutSeconds),
          retries: Number(process.env.MAIGRET_BOOST_RETRIES || retries),
          maxConnections: Number(process.env.MAIGRET_BOOST_MAX_CONNECTIONS || Math.min(maxConnections, 20))
        })
      : null;
  const preliminaryReport = mergeMaigretSimpleReports(primary.reportJson, priority?.reportJson, boost?.reportJson);
  const criticalSiteNames = resolveCriticalSiteNames();
  const critical =
    criticalSiteNames.length > 0 && shouldRunCriticalScan(preliminaryReport, input)
      ? await runMaigretCli(command, input, {
          processTimeoutMs: Number(process.env.MAIGRET_CRITICAL_PROCESS_TIMEOUT_MS || Math.min(processTimeoutMs, 40000)),
          scope: { siteNames: criticalSiteNames },
          timeoutSeconds: Number(process.env.MAIGRET_CRITICAL_SITE_TIMEOUT_SECONDS || 22),
          retries: Number(process.env.MAIGRET_CRITICAL_RETRIES || 2),
          maxConnections: Number(process.env.MAIGRET_CRITICAL_MAX_CONNECTIONS || Math.min(maxConnections, 3))
        })
      : null;
  const report = mergeMaigretSimpleReports(preliminaryReport, critical?.reportJson);
  const results = parseMaigretSimpleReport(report, input);

  return {
    results,
    checkedCount: [primary, priority, critical, boost].reduce((total, item) => total + (item?.checkedCount ?? 0), 0),
    failedRate: 0,
    report: primary.htmlReport
  };
}

async function runMaigretCli(
  command: string,
  input: CreateScanInput,
  options: {
    processTimeoutMs: number;
    scope: MaigretCliScope;
    timeoutSeconds: number;
    retries: number;
    maxConnections: number;
  }
): Promise<MaigretCliRunResult> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "id-doppelganger-maigret-"));

  try {
    const args = buildMaigretCliArgs(input.username, tempDir, options);
    const output = await spawnMaigret(command, args, options.processTimeoutMs);
    const reportPath = await findMaigretJsonReport(tempDir);
    const reportJson = await readFile(reportPath, "utf-8");
    const htmlReport = await readMaigretHtmlReport(tempDir);

    return {
      output,
      reportJson,
      htmlReport,
      checkedCount: extractCheckedCount(output, options.scope.topSites ?? options.scope.siteNames?.length ?? 0)
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function buildMaigretCliArgs(
  username: string,
  tempDir: string,
  {
    maxConnections,
    retries,
    scope,
    timeoutSeconds
  }: {
    maxConnections: number;
    retries: number;
    scope: MaigretCliScope;
    timeoutSeconds: number;
  }
) {
  const args = [
    username,
    "--html",
    "--json",
    "simple",
    "--folderoutput",
    tempDir,
    "--no-color",
    "--no-progressbar",
    "--no-recursion",
    "--timeout",
    String(timeoutSeconds),
    "--retries",
    String(retries),
    "--max-connections",
    String(maxConnections),
    "--reports-sorting",
    "data"
  ];

  if (process.env.MAIGRET_AUTO_UPDATE !== "true") {
    args.push("--no-autoupdate");
  }
  if (process.env.MAIGRET_FORCE_UPDATE === "true") {
    args.push("--force-update");
  }
  if (process.env.MAIGRET_EXTRACT_EXTENDED === "false") {
    args.push("--no-extracting");
  }
  if (process.env.MAIGRET_PROXY_URL) {
    args.push("--proxy", process.env.MAIGRET_PROXY_URL);
  }
  if (process.env.MAIGRET_CLOUDFLARE_BYPASS === "true") {
    args.push("--cloudflare-bypass");
  }
  const excludedTags = resolveExcludedTags();
  if (excludedTags.length > 0) {
    args.push("--exclude-tags", excludedTags.join(","));
  }

  if (scope.siteNames?.length) {
    for (const siteName of scope.siteNames) {
      args.push("--site", siteName);
    }
  } else if (scope.tags?.length) {
    args.push("--tags", scope.tags.join(","), "--top-sites", String(scope.topSites ?? scope.tags.length * 20));
  } else if (scope.allSites) {
    args.push("-a");
  } else {
    args.push("--top-sites", String(scope.topSites ?? resolveTopSites("QUICK")));
  }

  return args;
}

export function resolvePrioritySiteNames() {
  const configured = process.env.MAIGRET_PRIORITY_SITES;
  if (configured === "") return [];

  return splitCommaList(configured).length > 0 ? splitCommaList(configured) : defaultPrioritySiteNames;
}

export function resolveCriticalSiteNames() {
  const configured = process.env.MAIGRET_CRITICAL_SITES;
  if (configured === "") return [];

  const parsed = splitCommaList(configured);
  return parsed.length > 0 ? parsed : defaultCriticalSiteNames;
}

export function resolveBoostTagSpecs(): MaigretBoostTagSpec[] {
  const configured = process.env.MAIGRET_BOOST_TAGS;
  if (configured === "") return [];

  const parsed = splitCommaList(configured).flatMap((item) => {
    const [rawTag, rawLimit] = item.split(":", 2);
    const tag = rawTag?.trim().toLowerCase();
    const limit = Number(rawLimit ?? "20");
    return tag && Number.isFinite(limit) && limit > 0 ? [{ tag, limit }] : [];
  });

  return parsed.length > 0 ? parsed : defaultBoostTagSpecs;
}

export function resolveExcludedSiteNames() {
  const configured = process.env.MAIGRET_EXCLUDED_SITES;
  if (configured === "") return [];

  const parsed = splitCommaList(configured);
  return parsed.length > 0 ? parsed : defaultExcludedSiteNames;
}

export function resolveExcludedTags() {
  const configured = process.env.MAIGRET_EXCLUDED_TAGS;
  if (configured === "") return [];

  const parsed = splitCommaList(configured).map((tag) => tag.toLowerCase());
  return parsed.length > 0 ? parsed : defaultExcludedTags;
}

function resolveBoostTagCliScope() {
  const specs = resolveBoostTagSpecs();
  return {
    tags: Array.from(new Set(specs.map((spec) => spec.tag))),
    topSites: specs.reduce((total, spec) => total + spec.limit, 0)
  };
}

function mergeMaigretSimpleReports(...reports: Array<string | undefined>) {
  return JSON.stringify(
    reports.reduce<Record<string, unknown>>((merged, report) => {
      if (!report) return merged;
      return { ...merged, ...(JSON.parse(report) as Record<string, unknown>) };
    }, {})
  );
}

function shouldRunCriticalScan(preliminaryReport: string, input: Pick<CreateScanInput, "purpose">) {
  const configured = String(process.env.MAIGRET_CRITICAL_RESCAN ?? "adaptive").toLowerCase();
  if (["false", "off", "0"].includes(configured)) return false;
  if (["true", "always", "1"].includes(configured)) return true;

  try {
    return parseMaigretSimpleReport(preliminaryReport, input).length > 0;
  } catch {
    return false;
  }
}

async function runRemoteMaigretScan(input: CreateScanInput, options: MaigretRunOptions): Promise<MaigretRunOutput> {
  const endpoint = remoteMaigretEndpoint(options.origin);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.MAIGRET_API_SECRET ? { "x-maigret-api-secret": process.env.MAIGRET_API_SECRET } : {})
    },
    body: JSON.stringify({ username: input.username, mode: input.mode ?? "QUICK" })
  });
  const body = (await response.json().catch(() => null)) as RemoteMaigretResponse | null;

  if (!response.ok || !body?.reportJson) {
    throw new Error(body?.error?.message ?? `Remote Maigret scan failed with status ${response.status}.`);
  }

  return {
    results: parseMaigretSimpleReport(body.reportJson, input),
    checkedCount: body.checkedCount ?? resolveTopSites(input.mode ?? "QUICK"),
    failedRate: body.failedRate ?? 0,
    report: body.htmlReport?.html
      ? {
          html: body.htmlReport.html,
          htmlFilename: body.htmlReport.htmlFilename,
          generatedAt: new Date().toISOString()
        }
      : undefined
  };
}

function shouldUseRemoteMaigret() {
  return Boolean(process.env.MAIGRET_API_URL || process.env.VERCEL === "1");
}

function remoteMaigretEndpoint(origin?: string) {
  if (process.env.MAIGRET_API_URL) return process.env.MAIGRET_API_URL;
  const baseUrl =
    origin || process.env.SITE_URL || process.env.PRODUCTION_BASE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;

  if (!baseUrl) {
    throw new Error(
      "MAIGRET_API_URL, request origin, SITE_URL, PRODUCTION_BASE_URL, or VERCEL_URL is required for remote Maigret scans."
    );
  }

  const normalized = baseUrl.match(/^https?:\/\//i) ? baseUrl : `https://${baseUrl}`;
  return `${normalized.replace(/\/$/, "")}/api/maigret_scan`;
}

export function parseMaigretSimpleReport(report: string, input: Pick<CreateScanInput, "purpose">): ScanResult[] {
  const parsed = JSON.parse(report) as Record<string, MaigretReportRecord>;

  return dedupeScanResults(
    Object.entries(parsed)
      .filter(([siteName]) => !shouldExcludeMaigretSite(siteName))
      .map(([siteName, record]) => maigretRecordToScanResult(siteName, record, input.purpose))
      .filter((result): result is ScanResult => Boolean(result))
      .filter((result) => !hasExcludedTag(result.tags))
  );
}

export function maigretRecordToScanResult(
  siteName: string,
  record: MaigretReportRecord,
  purpose: CreateScanInput["purpose"]
): ScanResult | null {
  const rawUrl = firstString(record.url_user, record.urlUser, record.url, nested(record.status, "site_url_user"));
  if (!rawUrl) return null;

  const tags = extractTags(record);
  const rawPlatformUrl = firstString(
    record.url_main,
    nested(record.site, "urlMain"),
    nested(record.site, "url_main"),
    nested(record.site, "url")
  );
  const normalizedPlatform = normalizeMaigretPlatform(siteName, rawUrl, rawPlatformUrl, record);
  const category = inferCategory(normalizedPlatform.platform, normalizedPlatform.url, tags);
  const country = inferCountry(tags);
  const riskLevel = riskForMaigret(category, purpose);
  const profileImageUrl = firstString(
    record.photo,
    record.image,
    record.avatar,
    nested(record.ids, "photo"),
    nested(record.ids, "image"),
    nested(record.ids, "avatar"),
    nested(record.status, "photo"),
    nested(record.status, "image"),
    nested(record.status, "avatar")
  );
  const rank = firstNumber(record.rank, nested(record.site, "alexaRank"));
  const httpStatus = firstNumber(record.http_status, record.httpStatus);

  return {
    id: `maigret-${stableHash(`${siteName}:${normalizedPlatform.url}`).toString(36)}`,
    platform: normalizedPlatform.platform,
    url: normalizedPlatform.url,
    platformUrl: normalizedPlatform.platformUrl ?? undefined,
    platformIconUrl: faviconUrlFor(normalizedPlatform.platformUrl ?? normalizedPlatform.url),
    profileImageUrl: profileImageUrl ?? undefined,
    category,
    country,
    status: "FOUND",
    riskLevel,
    cleanupHint: cleanupHintFor(category),
    tags,
    rank: rank ?? undefined,
    httpStatus: httpStatus ?? undefined
  };
}

function normalizeMaigretPlatform(
  siteName: string,
  url: string,
  platformUrl: string | null,
  record: MaigretReportRecord
) {
  if (normalizeSiteName(siteName) === "twitter") {
    return {
      platform: "X",
      url: rewriteTwitterUrl(url),
      platformUrl: "https://x.com"
    };
  }

  const source = firstString(nested(record.site, "source"), nested(record.status, "source"));
  const username = firstString(record.username, nested(record.status, "username"));
  const mirror = mirrorSourcePlatform(source, username);
  if (mirror) return mirror;

  return {
    platform: siteName,
    url,
    platformUrl
  };
}

function mirrorSourcePlatform(source: string | null, username: string | null) {
  if (!source || !username) return null;

  if (normalizeSiteName(source) === "instagram") {
    return {
      platform: "Instagram",
      url: `https://www.instagram.com/${encodeURIComponent(username)}`,
      platformUrl: "https://www.instagram.com"
    };
  }

  if (normalizeSiteName(source) === "twitter" || normalizeSiteName(source) === "x") {
    return {
      platform: "X",
      url: `https://x.com/${encodeURIComponent(username)}`,
      platformUrl: "https://x.com"
    };
  }

  return null;
}

function dedupeScanResults(results: ScanResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${normalizeSiteName(result.platform)}:${normalizeResultUrl(result.url)}`;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function shouldExcludeMaigretSite(siteName: string) {
  const excluded = new Set(resolveExcludedSiteNames().map(normalizeSiteName));
  return excluded.has(normalizeSiteName(siteName));
}

function hasExcludedTag(tags: string[] | undefined) {
  if (!tags?.length) return false;

  const excluded = new Set(resolveExcludedTags());
  return tags.some((tag) => excluded.has(tag.toLowerCase()));
}

function rewriteTwitterUrl(value: string) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "twitter.com") return value;

    parsed.protocol = "https:";
    parsed.hostname = "x.com";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}

function normalizeSiteName(value: string) {
  return value.trim().toLowerCase();
}

function normalizeResultUrl(value: string) {
  try {
    const parsed = new URL(value);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return value.trim().replace(/\/$/, "").toLowerCase();
  }
}

function splitCommaList(value: string | undefined) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function spawnMaigret(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8"
      }
    });
    let output = "";
    let errorOutput = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Maigret timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf-8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      errorOutput += chunk.toString("utf-8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(`${output}\n${errorOutput}`);
      } else {
        reject(new Error(errorOutput || output || `Maigret exited with code ${code}.`));
      }
    });
  });
}

async function findMaigretJsonReport(folder: string): Promise<string> {
  const entries = await readdir(folder, { withFileTypes: true });
  const jsonFile = entries.find((entry) => entry.isFile() && entry.name.endsWith("_simple.json"));

  if (!jsonFile) {
    throw new Error("Maigret JSON report was not generated.");
  }

  return path.join(folder, jsonFile.name);
}

async function readMaigretHtmlReport(folder: string): Promise<MaigretReportArtifacts | undefined> {
  const entries = await readdir(folder, { withFileTypes: true });
  const htmlFile = entries.find((entry) => entry.isFile() && entry.name.endsWith("_plain.html"));

  if (!htmlFile) return undefined;

  const html = await readFile(path.join(folder, htmlFile.name), "utf-8");
  return {
    html,
    htmlFilename: htmlFile.name,
    generatedAt: new Date().toISOString()
  };
}

function resolveTopSites(mode: CreateScanInput["mode"]): number {
  if (mode === "DEEP") {
    return Number(process.env.MAIGRET_TOP_SITES_DEEP || "150");
  }

  return Number(process.env.MAIGRET_TOP_SITES_QUICK || "35");
}

function extractCheckedCount(output: string, fallback: number): number {
  const match = output.match(/Starting .*? top (\d+) sites/i);
  return match ? Number(match[1]) : fallback;
}

function extractTags(record: MaigretReportRecord): string[] {
  const directTags = record.tags;
  const statusTags = nested(record.status, "tags");
  const siteTags = nested(record.site, "tags");
  const allTags = [directTags, statusTags, siteTags].flatMap((value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return [value];
  });

  return Array.from(new Set(allTags.map(String).map((tag) => tag.toLowerCase().trim()).filter(Boolean)));
}

function inferCategory(siteName: string, url: string, tags: string[]): PlatformCategory {
  const haystack = `${siteName} ${url} ${tags.join(" ")}`.toLowerCase();
  const match = categoryTags.find(([, candidates]) => candidates.some((candidate) => haystack.includes(candidate)));
  return match?.[0] ?? "GLOBAL";
}

function inferCountry(tags: string[]): ScanResult["country"] {
  for (const tag of tags) {
    if (countryTags[tag]) return countryTags[tag];
  }

  return "GLOBAL";
}

function riskForMaigret(category: PlatformCategory, purpose: CreateScanInput["purpose"]): RiskLevel {
  const baseRisk: Record<PlatformCategory, number> = {
    SNS: 10,
    BLOG: 7,
    COMMUNITY: 9,
    DEVELOPER: 7,
    CREATOR: 7,
    COMMERCE: 6,
    DOMAIN: 6,
    GLOBAL: 6
  };
  const score = baseRisk[category] + (purpose === "BRAND_CHECK" && ["SNS", "CREATOR", "DOMAIN"].includes(category) ? 2 : 0);

  if (score >= 10) return "HIGH";
  if (score >= 7) return "MEDIUM";
  return "LOW";
}

function cleanupHintFor(category: PlatformCategory): string {
  const label = categoryLabels[category];
  const hints: Record<PlatformCategory, string> = {
    SNS: "프로필 소개, 외부 링크, 오래된 공개 게시물 노출을 점검하세요.",
    BLOG: "오래된 글과 소개 문구의 공개 범위를 확인하세요.",
    COMMUNITY: "커뮤니티 프로필과 활동 내역 공개 범위를 점검하세요.",
    DEVELOPER: "README, 저장소, 커밋 이메일 공개 설정을 확인하세요.",
    CREATOR: "활동명, 채널 설명, 포트폴리오 연락처 노출을 점검하세요.",
    COMMERCE: "상점 프로필과 연락처 공개 여부를 확인하세요.",
    DOMAIN: "브랜드명이라면 도메인 선점과 소유권을 별도로 확인하세요.",
    GLOBAL: "공개 프로필의 소개 문구와 연결 링크를 확인하세요."
  };

  return hints[category] ?? `${label} 공개 프로필의 노출 정보를 확인하세요.`;
}

function firstString(...values: unknown[]): string | null {
  const value = values.find((item) => typeof item === "string" && item.trim().length > 0);
  return typeof value === "string" ? value : null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function faviconUrlFor(value: string | null): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return `${url.origin}/favicon.ico`;
  } catch {
    return undefined;
  }
}

function nested(source: unknown, key: string): unknown {
  if (!source || typeof source !== "object") return undefined;
  return (source as Record<string, unknown>)[key];
}
