import { normalizeUsername, ValidationError } from "./validation";
import type { ScanResult } from "./types";

export type LocaleCode = "ko" | "en";
export type ResultInsightTone = "low" | "medium" | "high";
export type ScanErrorTone = "quota" | "busy" | "disabled" | "validation" | "generic";
export type ResultFilter = "ALL" | "HIGH_RISK" | "KR" | "GLOBAL";

export interface MonitoringDraft {
  usernames: string[];
  invalid: string[];
  extraCount: number;
  duplicateCount: number;
}

export interface ScanErrorInput {
  code?: string;
  message?: string;
  retryAfterSeconds?: number;
  resetAt?: string;
}

export interface ScanErrorPresentation {
  title: string;
  message: string;
  action: string;
  tone: ScanErrorTone;
}

export interface ResultRiskSummary {
  high: number;
  medium: number;
  low: number;
  topRiskPlatforms: string[];
}

export function parseMonitoringDraft(
  rawInput: string,
  fallbackUsername = "",
  limit = 3,
): MonitoringDraft {
  const source = rawInput.trim() || fallbackUsername.trim();
  const tokens = source
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const unique = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  let duplicateCount = 0;

  for (const token of tokens) {
    try {
      const username = normalizeUsername(token);

      if (unique.has(username)) {
        duplicateCount += 1;
        continue;
      }

      unique.add(username);
      valid.push(username);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof Error) {
        invalid.push(token);
      }
    }
  }

  return {
    usernames: valid.slice(0, limit),
    invalid,
    extraCount: Math.max(0, valid.length - limit),
    duplicateCount,
  };
}

export function formatRetryAfter(seconds: number | undefined, locale: LocaleCode): string {
  if (!Number.isFinite(seconds) || !seconds || seconds <= 0) {
    return locale === "ko" ? "잠시 후" : "soon";
  }

  if (seconds < 60) {
    return locale === "ko" ? `${Math.ceil(seconds)}초` : `${Math.ceil(seconds)}s`;
  }

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return locale === "ko" ? `${minutes}분` : `${minutes} min`;
  }

  const hours = Math.ceil(minutes / 60);
  return locale === "ko" ? `${hours}시간` : `${hours} hr`;
}

export function scanErrorPresentation(
  input: ScanErrorInput,
  locale: LocaleCode,
): ScanErrorPresentation {
  const retryText = formatRetryAfter(input.retryAfterSeconds, locale);
  const resetText = input.resetAt ? formatShortDateTime(input.resetAt, locale) : null;

  if (input.code === "BETA_FREE_SCAN_LIMITED") {
    return locale === "ko"
      ? {
          title: "무료 검색 한도에 도달했어요",
          message: resetText
            ? `무료 검색 티켓을 모두 사용했어요. 기본 티켓은 ${resetText} 이후 다시 채워져요.`
            : "무료 검색 티켓을 모두 사용했어요.",
          action: "검색 버튼 옆 추천 링크를 공유하면 친구 방문마다 티켓 1장이 추가돼요.",
          tone: "quota",
        }
      : {
          title: "Free search limit reached",
          message: resetText
            ? `All free search tickets are used. Base tickets reset after ${resetText}.`
            : "All free search tickets are used.",
          action: "Share the referral link beside the search button to earn one ticket per friend visit.",
          tone: "quota",
        };
  }

  if (input.code === "BETA_SCAN_BUSY") {
    return locale === "ko"
      ? {
          title: "검색 대기 중",
          message: "현재 검색 작업이 몰려 있어요. 요청은 정상이고 잠시 후 재시도하면 됩니다.",
          action: `약 ${retryText} 후 다시 시도해 주세요.`,
          tone: "busy",
        }
      : {
          title: "Search queue is busy",
          message: "The search workers are currently busy. The request is valid; retry shortly.",
          action: `Try again in about ${retryText}.`,
          tone: "busy",
        };
  }

  if (input.code === "BETA_SCAN_DISABLED") {
    return locale === "ko"
      ? {
          title: "검색이 잠시 닫혀 있어요",
          message: "출시 전 부하 제어를 위해 새 검색이 비활성화되어 있어요.",
          action: "관리자 페이지에서 검색을 다시 활성화해 주세요.",
          tone: "disabled",
        }
      : {
          title: "Search is temporarily disabled",
          message: "New searches are paused to control pre-launch load.",
          action: "Re-enable search from the admin page.",
          tone: "disabled",
        };
  }

  if (input.code === "VALIDATION_ERROR" || input.code === "DISALLOWED_SEARCH") {
    return {
      title: locale === "ko" ? "아이디를 다시 확인해 주세요" : "Check the username",
      message:
        input.message ||
        (locale === "ko"
          ? "영문, 숫자, 점, 밑줄, 하이픈만 입력할 수 있어요."
          : "Use letters, numbers, dots, underscores, or hyphens only."),
      action:
        locale === "ko"
          ? "이메일, 전화번호, URL 대신 공개 아이디만 입력해 주세요."
          : "Enter a public username, not an email, phone number, or URL.",
      tone: "validation",
    };
  }

  return {
    title: locale === "ko" ? "검색을 시작하지 못했어요" : "Search could not start",
    message:
      input.message ||
      (locale === "ko"
        ? "일시적인 오류가 발생했어요."
        : "A temporary error occurred."),
    action:
      locale === "ko"
        ? "입력을 유지한 채 다시 시도해 보세요."
        : "Keep the username and try again.",
    tone: "generic",
  };
}

export function topDistributionEntries(
  distribution: Record<string, number> | undefined,
  limit: number,
): Array<[string, number]> {
  return Object.entries(distribution ?? {})
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);
}

export function filterScanResults(results: ScanResult[], filter: ResultFilter): ScanResult[] {
  if (filter === "HIGH_RISK") {
    return results.filter((result) => result.riskLevel === "HIGH");
  }

  if (filter === "KR") {
    return results.filter((result) => result.country === "KR");
  }

  if (filter === "GLOBAL") {
    return results.filter((result) => result.country !== "KR");
  }

  return [...results];
}

export function prioritizeScanResults(results: ScanResult[]): ScanResult[] {
  const riskRank: Record<ScanResult["riskLevel"], number> = {
    HIGH: 0,
    MEDIUM: 1,
    LOW: 2,
  };

  return [...results].sort((a, b) => {
    const riskDelta = riskRank[a.riskLevel] - riskRank[b.riskLevel];
    if (riskDelta !== 0) return riskDelta;

    const rankDelta = (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER);
    if (rankDelta !== 0) return rankDelta;

    return a.platform.localeCompare(b.platform);
  });
}

export function resultRiskSummary(results: ScanResult[]): ResultRiskSummary {
  const summary: ResultRiskSummary = {
    high: 0,
    medium: 0,
    low: 0,
    topRiskPlatforms: [],
  };

  for (const result of results) {
    if (result.riskLevel === "HIGH") summary.high += 1;
    if (result.riskLevel === "MEDIUM") summary.medium += 1;
    if (result.riskLevel === "LOW") summary.low += 1;
  }

  summary.topRiskPlatforms = prioritizeScanResults(results)
    .filter((result) => result.riskLevel === "HIGH")
    .slice(0, 3)
    .map((result) => result.platform);

  return summary;
}

export function formatExpirationStatus(value: string, now: Date, locale: LocaleCode): string {
  const days = daysUntil(value, now);

  if (days === null || days < 0) {
    return locale === "ko" ? "만료됨" : "Expired";
  }

  if (days === 0) {
    return locale === "ko" ? "오늘 만료" : "Expires today";
  }

  return locale === "ko"
    ? `${days}일 후 만료`
    : `Expires in ${days} ${days === 1 ? "day" : "days"}`;
}

export function formatNextRunStatus(value: string, now: Date, locale: LocaleCode): string {
  const days = daysUntil(value, now);

  if (days === null || days <= 0) {
    return locale === "ko" ? "오늘 재점검 예정" : "Recheck due today";
  }

  return locale === "ko"
    ? `다음 재점검까지 ${days}일`
    : `Next recheck in ${days} ${days === 1 ? "day" : "days"}`;
}

export function resultInsightTone(scores: {
  exposureScore: number;
  impersonationRiskScore?: number;
  impersonationScore?: number;
}): ResultInsightTone {
  const impersonationScore = scores.impersonationRiskScore ?? scores.impersonationScore ?? 0;
  const score = Math.max(scores.exposureScore, impersonationScore);

  if (score >= 70) {
    return "high";
  }

  if (score >= 35) {
    return "medium";
  }

  return "low";
}

function formatShortDateTime(value: string, locale: LocaleCode): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function daysUntil(value: string, now: Date): number | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffMs = date.getTime() - now.getTime();

  if (diffMs >= 0 && diffMs < msPerDay) {
    return 0;
  }

  return Math.ceil(diffMs / msPerDay);
}
