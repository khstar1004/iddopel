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

export async function runMaigretScan(input: CreateScanInput, options: MaigretRunOptions = {}): Promise<MaigretRunOutput> {
  if (shouldUseRemoteMaigret()) {
    return runRemoteMaigretScan(input, options);
  }

  const command = process.env.MAIGRET_BIN || "maigret";
  const tempDir = await mkdtemp(path.join(tmpdir(), "id-doppelganger-maigret-"));
  const topSites = resolveTopSites(input.mode ?? "QUICK");
  const timeoutSeconds = Number(process.env.MAIGRET_SITE_TIMEOUT_SECONDS || "12");
  const processTimeoutMs = Number(process.env.MAIGRET_PROCESS_TIMEOUT_MS || "120000");
  const maxConnections = Number(process.env.MAIGRET_MAX_CONNECTIONS || "40");
  const args = [
    input.username,
    "--html",
    "--json",
    "simple",
    "--folderoutput",
    tempDir,
    "--no-color",
    "--no-progressbar",
    "--no-autoupdate",
    "--no-recursion",
    "--timeout",
    String(timeoutSeconds),
    "--retries",
    "0",
    "--max-connections",
    String(maxConnections),
    "--reports-sorting",
    "data"
  ];

  if (process.env.MAIGRET_EXTRACT_EXTENDED === "false") {
    args.push("--no-extracting");
  }

  if (input.mode === "DEEP" && process.env.MAIGRET_DEEP_ALL === "true") {
    args.push("-a");
  } else {
    args.push("--top-sites", String(topSites));
  }

  try {
    const output = await spawnMaigret(command, args, processTimeoutMs);
    const reportPath = await findMaigretJsonReport(tempDir);
    const report = await readFile(reportPath, "utf-8");
    const htmlReport = await readMaigretHtmlReport(tempDir);
    const checkedCount = extractCheckedCount(output, topSites);
    const results = parseMaigretSimpleReport(report, input);

    return {
      results,
      checkedCount,
      failedRate: 0,
      report: htmlReport
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
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

  return Object.entries(parsed)
    .map(([siteName, record]) => maigretRecordToScanResult(siteName, record, input.purpose))
    .filter((result): result is ScanResult => Boolean(result));
}

export function maigretRecordToScanResult(
  siteName: string,
  record: MaigretReportRecord,
  purpose: CreateScanInput["purpose"]
): ScanResult | null {
  const url = firstString(record.url_user, record.urlUser, record.url, nested(record.status, "site_url_user"));
  if (!url) return null;

  const tags = extractTags(record);
  const platformUrl = firstString(record.url_main, nested(record.site, "urlMain"), nested(record.site, "url_main"), nested(record.site, "url"));
  const category = inferCategory(siteName, url, tags);
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
    id: `maigret-${stableHash(`${siteName}:${url}`).toString(36)}`,
    platform: siteName,
    url,
    platformUrl: platformUrl ?? undefined,
    platformIconUrl: faviconUrlFor(platformUrl ?? url),
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
    return Number(process.env.MAIGRET_TOP_SITES_DEEP || "500");
  }

  return Number(process.env.MAIGRET_TOP_SITES_QUICK || "100");
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
