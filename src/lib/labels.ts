import type { PlatformCategory, RiskLevel, ScanPurpose } from "./types";

export type Locale = "ko" | "en";

export const purposeLabels: Record<ScanPurpose, string> = {
  SELF_CHECK: "내 아이디 점검",
  BRAND_CHECK: "브랜드/활동명 점검",
  NICKNAME_CHECK: "새 닉네임 겹침 확인"
};

export const categoryLabels: Record<PlatformCategory, string> = {
  SNS: "SNS",
  BLOG: "블로그",
  COMMUNITY: "커뮤니티",
  DEVELOPER: "개발자",
  CREATOR: "크리에이터",
  COMMERCE: "커머스",
  DOMAIN: "도메인",
  GLOBAL: "글로벌 프로필"
};

export const countryLabels: Record<string, string> = {
  KR: "한국",
  US: "미국",
  JP: "일본",
  GLOBAL: "글로벌"
};

export const riskLabels: Record<RiskLevel, string> = {
  LOW: "낮음",
  MEDIUM: "확인 필요",
  HIGH: "주의"
};

export const categoryLabelsByLocale: Record<Locale, Record<PlatformCategory, string>> = {
  ko: categoryLabels,
  en: {
    SNS: "Social",
    BLOG: "Blog",
    COMMUNITY: "Community",
    DEVELOPER: "Developer",
    CREATOR: "Creator",
    COMMERCE: "Commerce",
    DOMAIN: "Domain",
    GLOBAL: "Global profile"
  }
};

export const countryLabelsByLocale: Record<Locale, Record<string, string>> = {
  ko: countryLabels,
  en: {
    KR: "Korea",
    US: "United States",
    JP: "Japan",
    GLOBAL: "Global"
  }
};

export const riskLabelsByLocale: Record<Locale, Record<RiskLevel, string>> = {
  ko: riskLabels,
  en: {
    LOW: "Low",
    MEDIUM: "Review",
    HIGH: "Attention"
  }
};

export function scoreTone(score: number) {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}
