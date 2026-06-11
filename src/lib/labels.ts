import type { PlatformCategory, RiskLevel, ScanPurpose } from "./types";

export const purposeLabels: Record<ScanPurpose, string> = {
  SELF_CHECK: "내 아이디 점검",
  BRAND_CHECK: "브랜드/활동명 점검",
  NICKNAME_CHECK: "새 닉네임 후보 확인"
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

export function scoreTone(score: number) {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}
