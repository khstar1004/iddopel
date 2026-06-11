import type { CreateScanInput, ScanMode, ScanPurpose } from "./types";

export class ValidationError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

const purposeMap: Record<string, ScanPurpose> = {
  self_check: "SELF_CHECK",
  brand_check: "BRAND_CHECK",
  nickname_check: "NICKNAME_CHECK",
  SELF_CHECK: "SELF_CHECK",
  BRAND_CHECK: "BRAND_CHECK",
  NICKNAME_CHECK: "NICKNAME_CHECK"
};

const modeMap: Record<string, ScanMode> = {
  quick: "QUICK",
  deep: "DEEP",
  QUICK: "QUICK",
  DEEP: "DEEP"
};

export function normalizeUsername(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new ValidationError("VALIDATION_ERROR", "아이디를 입력해 주세요.");
  }

  const username = raw.trim().replace(/^@+/, "");

  if (username.length < 3 || username.length > 30) {
    throw new ValidationError(
      "VALIDATION_ERROR",
      "아이디는 3자 이상 30자 이하로 입력해 주세요."
    );
  }

  assertAllowedSearch(username);

  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    throw new ValidationError(
      "VALIDATION_ERROR",
      "아이디에는 영문, 숫자, 점, 밑줄, 하이픈만 사용할 수 있어요."
    );
  }
  return username;
}

export function assertAllowedSearch(username: string): void {
  const compact = username.replace(/[.\-_\s]/g, "");

  if (username.includes("@") || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(username)) {
    throw new ValidationError("DISALLOWED_SEARCH", "이메일 검색은 지원하지 않아요.");
  }

  if (/^01[016789]\d{7,8}$/.test(compact) || /^\d{9,12}$/.test(compact)) {
    throw new ValidationError("DISALLOWED_SEARCH", "전화번호 검색은 지원하지 않아요.");
  }

  if (/^\d{6}[1-4]\d{6}$/.test(compact)) {
    throw new ValidationError(
      "DISALLOWED_SEARCH",
      "주민번호처럼 보이는 값은 검색할 수 없어요."
    );
  }

  if (/https?:\/\//i.test(username)) {
    throw new ValidationError("DISALLOWED_SEARCH", "URL 검색은 지원하지 않아요.");
  }
}

export function parseCreateScanInput(body: unknown): CreateScanInput {
  if (!body || typeof body !== "object") {
    throw new ValidationError("VALIDATION_ERROR", "요청 본문이 올바르지 않아요.");
  }

  const record = body as Record<string, unknown>;
  const username = normalizeUsername(record.username);
  const purposeValue = typeof record.purpose === "string" ? purposeMap[record.purpose] : undefined;
  const modeValue = typeof record.mode === "string" ? modeMap[record.mode] : "QUICK";

  if (!purposeValue) {
    throw new ValidationError("VALIDATION_ERROR", "점검 목적을 선택해 주세요.");
  }

  if (!modeValue) {
    throw new ValidationError("VALIDATION_ERROR", "지원하지 않는 점검 방식이에요.");
  }

  return {
    username,
    purpose: purposeValue,
    mode: modeValue
  };
}
