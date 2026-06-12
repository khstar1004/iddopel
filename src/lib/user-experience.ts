import { normalizeUsername, ValidationError } from "./validation";

export type LocaleCode = "ko" | "en";
export type ResultInsightTone = "low" | "medium" | "high";
export type ScanErrorTone = "quota" | "busy" | "disabled" | "validation" | "generic";

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
            ? `베타 무료 검색을 모두 사용했어요. ${resetText} 이후 다시 검색할 수 있어요.`
            : "베타 무료 검색을 모두 사용했어요. 관리자 페이지에서 무료 검색 quota를 조정할 수 있어요.",
          action: "관리자 설정에서 무료 검색 수치를 늘리거나, 잠시 후 다시 시도해 주세요.",
          tone: "quota",
        }
      : {
          title: "Free search limit reached",
          message: resetText
            ? `Free beta searches are used up. You can search again after ${resetText}.`
            : "Free beta searches are used up. Adjust the free quota from the admin page.",
          action: "Increase the free-search quota in admin settings or try again later.",
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
