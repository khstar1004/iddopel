"use client";

import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  History,
  ListChecks,
  LockKeyhole,
  Radar,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound
} from "lucide-react";
import { FormEvent, type MouseEvent, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  categoryLabelsByLocale,
  countryLabelsByLocale,
  riskLabelsByLocale,
  scoreTone,
  type Locale
} from "@/lib/labels";
import type { LockedScanResultPreview, PublicMonitoringSubscription, ScanResult, ScanSummary } from "@/lib/types";
import {
  parseMonitoringDraft,
  resultInsightTone,
  scanErrorPresentation,
  topDistributionEntries,
  type ScanErrorPresentation as ScanErrorState
} from "@/lib/user-experience";
import { normalizeUsername } from "@/lib/validation";
import { BrandIcon } from "./BrandIcon";
import { devAdminTokenKey, getOrCreateFreeScanOwnerToken } from "./client-tokens";
import { pendingMonitoringKey } from "./paid-monitoring-client";
import { ScanEyeLoader } from "./ScanEyeLoader";

interface StoredScan extends ScanSummary {
  savedAt: string;
}

interface ResultsResponse {
  scanId: string;
  access: "FULL" | "PREVIEW" | "LOCKED";
  lockedCount: number;
  lockedResults?: LockedScanResultPreview[];
  maigretReportAvailable?: boolean;
  maigretReportFilename?: string;
  results: ScanResult[];
}

interface DetailAccessState extends ResultsResponse {
  label: string;
  description: string;
  reportToken?: string;
  adminToken?: string;
  sourceReportHtml?: string;
}

const monitoringOwnerTokenKey = "id-doppelganger-monitoring-owner-token";
const freeDetailOwnerTokenKey = "id-doppelganger-free-detail-owner-token";
const freeDetailUsedScanIdKey = "id-doppelganger-free-detail-used-scan-id";
const devAdminLogoClickWindowMs = 2500;
const localeStorageKey = "id-doppelganger-locale";
const scanExperienceCopy = {
  ko: {
    brandName: "ID 도플갱어",
    languageLabel: "언어",
    languageOptions: { ko: "한국어", en: "English" },
    brandHomeLabel: "ID 도플갱어 홈",
    navLabel: "주요 링크",
    nav: {
      results: "결과",
      pricing: "가격",
      guides: "SEO 가이드",
      toss: "토스 인앱"
    },
    hero: {
      eyebrow: "아이디 흔적 점검",
      title: "내 아이디, 어디에 남아 있을까?",
      description: "자주 쓰는 아이디를 입력하면 공개 프로필 흔적을 바로 찾아 보여줘요.",
      safetyLabel: "안전 정책",
      trust: ["실명 검색 미지원", "전화번호·이메일 차단", "동일인 판정 안 함"]
    },
    form: {
      label: "아이디",
      ariaLabel: "아이디 입력",
      placeholder: "아이디만 입력",
      scanLabel: "아이디 점검",
      acknowledgement: "정당한 목적으로 공개 아이디 사용 현황을 점검해요.",
      safetyNote: "실명, 전화번호, 이메일 검색은 지원하지 않아요. 같은 사람이라고 단정하지 않아요.",
      withoutAt: (value: string) => `@ 없이 ${value}로 점검돼요.`,
      examples: ["creator_id", "brand.name", "my-handle"],
      expected: ["공개 프로필 후보 먼저 확인", "상세 URL은 잠금 상태로 미리보기", "검색 기록은 이 브라우저에만 저장"],
      ready: "검색 준비가 끝났어요.",
      blocker: {
        empty: "3자 이상 공개 아이디를 입력해 주세요.",
        acknowledge: "정당한 목적 확인에 체크하면 검색할 수 있어요."
      },
      charCount: (count: number) => `${count}/30자`,
      quotaRemaining: (remaining: number, limit: number, resetLabel: string | null) =>
        resetLabel
          ? `베타 무료 검색 ${remaining}/${limit}회 남음 · 초기화 ${resetLabel}`
          : `베타 무료 검색 ${remaining}/${limit}회 남음`,
      retry: "다시 시도",
      changeInput: "아이디 수정",
      submit: "내 아이디 흔적 찾기",
      submitting: "찾는 중"
    },
    scanSteps: ["공개 프로필 확인 중", "한국 서비스 확인 중", "SNS·블로그 확인 중", "흔적 정리 중"],
    results: {
      heading: (summary: ScanSummary | null) => summary ? `${summary.username}로 찾은 공개 흔적` : "아이디를 입력하면 결과가 바로 떠요",
      delete: "기록 삭제",
      emptyTitle: "아직 검색한 아이디가 없어요",
      emptyDescription: "아이디 하나를 입력하면 공개 프로필 후보, 잠긴 상세 URL 수, 노출 점수를 한 화면에서 볼 수 있어요.",
      emptyExamplesLabel: "예시로 채우기",
      emptyExamples: ["creator_id", "brand.name", "my-handle"],
      emptySteps: ["아이디 입력", "공개 흔적 확인", "필요한 결과만 저장"],
      sourceBadge: "공개 흔적",
      previewTitle: (summary: ScanSummary) =>
        summary.foundCount > 0 ? `${summary.username}가 남아 있는 곳` : `${summary.username} 공개 흔적 없음`,
      metricsLabel: "결과 규모",
      visible: "먼저 공개",
      locked: "잠긴 URL",
      korea: "한국",
      nextActions: "다음 작업",
      shareCard: "공유 카드 저장",
      copySummary: "결과 요약 복사",
      monitoringAdd: "월간 재점검에 넣기",
      scanAgain: "다른 아이디 점검",
      analysisLabel: "점검 보조 분석",
      interpretation: "결과 해석",
      checkedPlatforms: "검사 플랫폼",
      failedChecks: "확인 실패",
      koreanServices: "한국 서비스",
      countries: "국가별 분포",
      categories: "카테고리별 분포",
      score: "점수",
      rarity: "희소성",
      exposure: "노출도",
      impersonation: "사칭 가능성",
      cleanup: "방치 계정 위험"
      ,
      insightLabel: "빠른 해석",
      insight: {
        high: {
          title: "노출이 많은 아이디예요",
          description: "같은 아이디가 여러 서비스에서 보입니다. 오래된 공개 프로필과 방치 계정을 먼저 확인하세요.",
          action: "정밀 리포트로 정확한 URL을 열고, 월간 재점검에 등록하는 것을 권장해요."
        },
        medium: {
          title: "확인할 흔적이 있어요",
          description: "일부 서비스에서 공개 흔적이 보입니다. 자주 쓰는 아이디라면 핵심 플랫폼부터 정리하세요.",
          action: "요약을 저장하고 같은 아이디를 월간 재점검에 넣어 변화만 확인하세요."
        },
        low: {
          title: "현재 공개 노출은 낮아요",
          description: "무료 점검 기준으로 바로 보이는 흔적이 많지 않습니다.",
          action: "브랜드명이나 자주 쓰는 변형 아이디도 한 번 더 확인해 보세요."
        }
      },
      snapshotLabel: "핵심 분포",
      topCountries: "주요 국가",
      topCategories: "주요 카테고리"
    },
    preview: {
      fullReport: "정밀 리포트 열기",
      checkout: "전체 리포트 보기",
      noResults: "무료 점검에서 바로 보이는 공개 흔적이 없어요.",
      loading: "상세 결과 확인 중",
      lockedLabel: "잠긴 상세 결과",
      lockedResult: (index: number) => `잠긴 공개 흔적 #${index}`,
      lockedDescription: "URL, 위험도, 정리 가이드 잠김",
      fullOpen: (count: number) => `${count}개 상세 결과가 열렸어요.`,
      freeUsedLead: "1회 무료 상세 결과를 이미 사용했어요. ",
      lockedCount: (count: number) => `상세 URL ${count}개 잠김`,
      ordering: "주문 만드는 중",
      checkoutWithPrice: "2,900원 결제하고 전체 리포트 보기",
      unlockTitle: "결제 후 바로 열리는 항목",
      unlockItems: ["정확한 공개 URL", "위험도 높은 계정 우선순위", "정리/삭제 가이드"],
      emptyNoCheckout: "결제할 상세 결과가 없어요.",
      emptyNoCheckoutDescription: "이번 아이디는 공개 후보가 없어 정밀 리포트 결제를 열지 않습니다. 월간 재점검으로 새 흔적만 확인하세요.",
      foundRank: (index: number) => `#${index} 발견됨`,
      candidateAria: (platform: string) => `${platform} 공개 흔적`,
      metadataAria: (platform: string) => `${platform} 메타데이터`,
      maskedAria: (platform: string) => `${platform} 잠긴 상세 URL 미리보기`,
      lockedUrlFallback: "상세 URL 잠김",
      lockCopy: "무료로 열린 링크는 바로 확인할 수 있어요. 나머지 정확한 URL과 전체 분석은 정밀 리포트에서 열려요."
    },
    pricing: {
      title: "가격",
      freeTitle: "무료",
      freePrice: "0원",
      freeItems: ["빠른 점검", "공개 링크 5개 열람", "나머지 URL 잠금 미리보기"],
      freeCta: "베타 무료로 시작",
      reportTitle: "정밀 리포트",
      reportPrice: "2,900원",
      reportItems: ["전체 결과 URL", "위험도 분석", "HTML/PDF 리포트"],
      reportCta: "결과에서 열기",
      recommended: "추천",
      monitoringTitle: "월간 모니터링",
      monitoringPrice: "3,900원/월",
      monitoringItems: ["월 1회 자동 재점검", "대시보드 재점검 기록", "아이디 3개 모니터링"],
      monitoringCta: "검색 후 등록"
    },
    monitoring: {
      title: "월간 자동 재점검",
      inputLabel: "모니터링할 아이디",
      placeholder: "쉼표로 여러 아이디 입력",
      saving: "등록 중",
      submit: "월간 재점검 등록",
      checkoutStarting: "월간 모니터링 결제 페이지로 이동하고 있어요.",
      scanFirst: "먼저 아이디 점검 후 월간 모니터링을 등록해 주세요.",
      statusTitle: "모니터링 상태",
      nextRun: "다음 자동 재점검",
      lastRun: "최근 재점검",
      noneYet: "아직 없음",
      latestResults: "최근 재점검 결과",
      latestResultsEmpty: "아직 cron 재점검 결과가 없어요.",
      openLatestResult: (username: string) => `${username} 결과 열기`,
      latestMeta: (foundCount: number, exposureScore: number) => `흔적 ${foundCount}개 · 노출도 ${exposureScore}점`,
      previewLabel: "등록 전 확인",
      previewEmpty: "아이디를 입력하거나 먼저 검색하면 등록할 대상을 미리 볼 수 있어요.",
      countLabel: (count: number) => `${count}/3개`,
      ready: (count: number) => `${count}개 아이디를 월간 재점검에 등록할 준비가 됐어요.`,
      duplicateNote: (count: number) => `중복 ${count}개는 자동으로 제외했어요.`,
      invalidMessage: (items: string[]) => `지원하지 않는 입력이 있어요: ${items.join(", ")}`,
      limitExceeded: (count: number) => `월간 모니터링은 아이디 3개까지 가능해요. ${count}개를 줄여 주세요.`,
      deliveryNote: "현재 월간 추적은 메일 발송이 아니라 이 브라우저 대시보드에서 최신 결과를 확인하는 방식이에요.",
      cancel: "모니터링 해지",
      empty: "아직 등록된 월간 모니터링이 없어요. 무료 점검 후 같은 아이디를 바로 등록할 수 있어요."
    },
    history: {
      title: "최근 검색한 아이디",
      quickTitle: "최근 점검",
      empty: "이 브라우저에 저장된 검색 기록이 없어요.",
      meta: (foundCount: number, rarityScore: number) => `흔적 ${foundCount}개 · 희소성 ${rarityScore}점`,
      restoreAria: (username: string) => `${username} 결과 다시 보기`,
      deleteAria: (username: string) => `${username} 기록 삭제`,
      savedAt: (value: string) => `저장 ${value}`,
      clearAll: "전체 기록 비우기",
      restore: "다시 보기",
      delete: "삭제"
    },
    faq: {
      title: "FAQ",
      items: [
        ["이게 사람 찾기인가요?", "아니요. 아이디 문자열의 공개 사용 현황만 확인해요."],
        ["결과가 모두 같은 사람인가요?", "아니요. 동일인 여부를 판정하지 않아요."],
        ["검색 기록을 지울 수 있나요?", "네. 무료 기록은 즉시 삭제할 수 있어요."]
      ]
    },
    footer: {
      privacy: "개인정보처리방침",
      terms: "이용약관",
      responsibleUse: "책임 있는 사용"
    },
    detailLabels: {
      adminFull: "어드민 전체 결과",
      adminFullDescription: "개발자 테스트 모드로 결제 없이 전체 결과를 보고 있어요.",
      freePreview: "무료 미리보기",
      paywallPreview: "정밀 리포트 잠김",
      freeDetail: "1회 무료 상세 결과",
      freeDetailAgain: "1회 무료 상세 결과 다시 보기",
      fullOpen: "전체 결과 열림",
      lockedUrl: "상세 URL 잠김"
    },
    sourceReport: {
      title: "원본 HTML 리포트",
      open: "새 탭으로 보기",
      save: "HTML 저장",
      iframeTitle: "원본 HTML 리포트 미리보기"
    },
    fullReport: {
      title: "전체 리포트",
      description: "발견 플랫폼, URL, 위험도, 조치 가이드를 확인하세요.",
      download: "HTML 리포트 다운로드"
    },
    copyMessages: {
      copied: "공유용 요약을 복사했어요.",
      failed: "복사하지 못했어요. 브라우저 권한을 확인해 주세요."
    },
    devAdmin: {
      activeTitle: "개발자 테스트 모드",
      activeDescription: "스캔 제한과 결제 잠금 없이 전체 결과를 확인합니다.",
      logout: "로그아웃",
      loginTitle: "개발자 테스트 로그인",
      summaryHint: "필요할 때만 펼치기",
      defaultAccount: "로컬 테스트 기본 계정은 admin / admin 입니다.",
      usernameLabel: "개발자 아이디",
      passwordLabel: "개발자 비밀번호",
      passwordPlaceholder: "비밀번호",
      login: "로그인"
    }
  },
  en: {
    brandName: "ID Doppelganger",
    languageLabel: "Language",
    languageOptions: { ko: "한국어", en: "English" },
    brandHomeLabel: "ID Doppelganger home",
    navLabel: "Primary links",
    nav: {
      results: "Results",
      pricing: "Pricing",
      guides: "Guides",
      toss: "Toss mini app"
    },
    hero: {
      eyebrow: "Public username exposure check",
      title: "Where is your username still public?",
      description: "Enter one username and see the public profile traces it leaves behind.",
      safetyLabel: "Safety policy",
      trust: ["No real-name search", "Phone and email blocked", "No identity matching"]
    },
    form: {
      label: "Username",
      ariaLabel: "Username input",
      placeholder: "Enter username only",
      scanLabel: "Username check",
      acknowledgement: "I am checking public username usage for a legitimate purpose.",
      safetyNote: "Real-name, phone, and email search are not supported. We do not claim accounts belong to the same person.",
      withoutAt: (value: string) => `We'll check ${value} without the @ sign.`,
      examples: ["creator_id", "brand.name", "my-handle"],
      expected: ["See public profile candidates first", "Preview how many detailed URLs are locked", "History stays in this browser"],
      ready: "Ready to search.",
      blocker: {
        empty: "Enter a public username with at least 3 characters.",
        acknowledge: "Confirm legitimate use to start the search."
      },
      charCount: (count: number) => `${count}/30 chars`,
      quotaRemaining: (remaining: number, limit: number, resetLabel: string | null) =>
        resetLabel
          ? `${remaining}/${limit} free beta searches left · resets ${resetLabel}`
          : `${remaining}/${limit} free beta searches left`,
      retry: "Try again",
      changeInput: "Edit username",
      submit: "Find my username traces",
      submitting: "Checking"
    },
    scanSteps: ["Checking public profiles", "Checking regional services", "Checking social and blogs", "Organizing matches"],
    results: {
      heading: (summary: ScanSummary | null) => summary ? `Public traces found for ${summary.username}` : "Enter a username to see results",
      delete: "Delete record",
      emptyTitle: "No username searched yet",
      emptyDescription: "Enter one username to see public profile candidates, locked detailed URL counts, and exposure scores in one place.",
      emptyExamplesLabel: "Fill an example",
      emptyExamples: ["creator_id", "brand.name", "my-handle"],
      emptySteps: ["Enter username", "Check public traces", "Save only what matters"],
      sourceBadge: "Public trace",
      previewTitle: (summary: ScanSummary) =>
        summary.foundCount > 0 ? `Where ${summary.username} shows up` : `No public traces for ${summary.username}`,
      metricsLabel: "Result size",
      visible: "Shown first",
      locked: "Locked matches",
      korea: "Korea",
      nextActions: "Next actions",
      shareCard: "Save share card",
      copySummary: "Copy result summary",
      monitoringAdd: "Add to monthly check",
      scanAgain: "Check another username",
      analysisLabel: "Supporting analysis",
      interpretation: "Result interpretation",
      checkedPlatforms: "Checked platforms",
      failedChecks: "Failed checks",
      koreanServices: "Korean services",
      countries: "Country distribution",
      categories: "Category distribution",
      score: "Score",
      rarity: "Rarity",
      exposure: "Exposure",
      impersonation: "Impersonation risk",
      cleanup: "Dormant account risk",
      insightLabel: "Quick read",
      insight: {
        high: {
          title: "This username has broad exposure",
          description: "The same username appears across multiple services. Start with old public profiles and dormant accounts.",
          action: "Open the detailed report for exact URLs and add monthly monitoring."
        },
        medium: {
          title: "There are traces worth reviewing",
          description: "Some public traces are visible. If this is a common username for you, review the key platforms first.",
          action: "Save the summary and monitor the username monthly to track changes."
        },
        low: {
          title: "Public exposure looks low",
          description: "The free check does not show many obvious public traces.",
          action: "Try brand names or username variants you commonly use."
        }
      },
      snapshotLabel: "Key distribution",
      topCountries: "Top countries",
      topCategories: "Top categories"
    },
    preview: {
      fullReport: "Open detailed report",
      checkout: "View full report",
      noResults: "No public account candidates were found in the free check.",
      loading: "Checking detailed access",
      lockedLabel: "Locked detailed results",
      lockedResult: (index: number) => `Public account candidate #${index}`,
      lockedDescription: "URL, risk, and cleanup guide locked",
      fullOpen: (count: number) => `${count} detailed results are open.`,
      freeUsedLead: "You already used the one-time free detailed result. ",
      lockedCount: (count: number) => `${count} detailed URLs locked`,
      ordering: "Creating order",
      checkoutWithPrice: "Pay $2.99 and view full report",
      unlockTitle: "What opens after payment",
      unlockItems: ["Exact public URLs", "Highest-risk account priority", "Cleanup and removal guidance"],
      emptyNoCheckout: "No detailed results to sell.",
      emptyNoCheckoutDescription: "This username has no public candidates, so detailed report checkout stays closed. Use monthly monitoring to catch future traces.",
      foundRank: (index: number) => `#${index} found`,
      candidateAria: (platform: string) => `${platform} public account candidate`,
      metadataAria: (platform: string) => `${platform} metadata`,
      maskedAria: (platform: string) => `${platform} locked URL preview`,
      lockedUrlFallback: "Detailed URL locked",
      lockCopy: "The free links are clickable now. Remaining exact URLs and the full analysis open in the detailed report."
    },
    pricing: {
      title: "Pricing",
      freeTitle: "Free",
      freePrice: "$0",
      freeItems: ["Quick check", "Open 5 public links", "Preview remaining locked URLs"],
      freeCta: "Start beta free",
      reportTitle: "Detailed report",
      reportPrice: "$2.99",
      reportItems: ["Full result URLs", "Risk analysis", "HTML/PDF report"],
      reportCta: "Open from results",
      recommended: "Recommended",
      monitoringTitle: "Monthly monitoring",
      monitoringPrice: "$3.99/mo",
      monitoringItems: ["Monthly automatic recheck", "Dashboard recheck history", "Monitor 3 usernames"],
      monitoringCta: "Add after search"
    },
    monitoring: {
      title: "Monthly automatic recheck",
      inputLabel: "Usernames to monitor",
      placeholder: "Enter multiple usernames with commas",
      saving: "Saving",
      submit: "Start monthly recheck",
      checkoutStarting: "Opening the monthly monitoring checkout.",
      scanFirst: "Run a username check before starting monthly monitoring.",
      statusTitle: "Monitoring status",
      nextRun: "Next automatic recheck",
      lastRun: "Last recheck",
      noneYet: "Not yet",
      latestResults: "Latest recheck results",
      latestResultsEmpty: "No cron recheck results yet.",
      openLatestResult: (username: string) => `Open ${username} result`,
      latestMeta: (foundCount: number, exposureScore: number) => `${foundCount} traces · ${exposureScore} exposure pts`,
      previewLabel: "Before registering",
      previewEmpty: "Enter usernames or run a search first to preview what will be monitored.",
      countLabel: (count: number) => `${count}/3`,
      ready: (count: number) => `${count} usernames are ready for monthly recheck.`,
      duplicateNote: (count: number) => `${count} duplicate entries were excluded automatically.`,
      invalidMessage: (items: string[]) => `Unsupported input: ${items.join(", ")}`,
      limitExceeded: (count: number) => `Monthly monitoring supports up to 3 usernames. Remove ${count}.`,
      deliveryNote: "Monthly monitoring currently updates this browser dashboard. It does not send email yet.",
      cancel: "Cancel monitoring",
      empty: "No monthly monitoring is registered yet. You can add the same username right after a free check."
    },
    history: {
      title: "Recent usernames",
      quickTitle: "Recent checks",
      empty: "No search history is saved in this browser.",
      meta: (foundCount: number, rarityScore: number) => `${foundCount} matches · ${rarityScore} rarity pts`,
      restoreAria: (username: string) => `View ${username} results again`,
      deleteAria: (username: string) => `Delete ${username} record`,
      savedAt: (value: string) => `Saved ${value}`,
      clearAll: "Clear all history",
      restore: "View again",
      delete: "Delete"
    },
    faq: {
      title: "FAQ",
      items: [
        ["Is this a people search tool?", "No. It only checks public usage of a username string."],
        ["Do all results belong to the same person?", "No. We do not determine whether accounts belong to the same person."],
        ["Can I delete search history?", "Yes. Free records can be deleted immediately."]
      ]
    },
    footer: {
      privacy: "Privacy Policy",
      terms: "Terms",
      responsibleUse: "Responsible Use"
    },
    detailLabels: {
      adminFull: "Admin full results",
      adminFullDescription: "Developer test mode shows full results without payment.",
      freePreview: "Free preview",
      paywallPreview: "Detailed report locked",
      freeDetail: "One-time free detailed result",
      freeDetailAgain: "View one-time free detailed result again",
      fullOpen: "Full results open",
      lockedUrl: "Detailed URL locked"
    },
    sourceReport: {
      title: "Original HTML report",
      open: "Open in new tab",
      save: "Save HTML",
      iframeTitle: "Original HTML report preview"
    },
    fullReport: {
      title: "Full report",
      description: "Review found platforms, URLs, risk, and action guidance.",
      download: "Download HTML report"
    },
    copyMessages: {
      copied: "Share summary copied.",
      failed: "Could not copy. Check browser permissions."
    },
    devAdmin: {
      activeTitle: "Developer test mode",
      activeDescription: "View full results without scan limits or payment locks.",
      logout: "Log out",
      loginTitle: "Developer test login",
      summaryHint: "Expand only when needed",
      defaultAccount: "The local test account is admin / admin.",
      usernameLabel: "Developer username",
      passwordLabel: "Developer password",
      passwordPlaceholder: "Password",
      login: "Log in"
    }
  }
};
const platformBrandRules: Array<[string, string]> = [
  ["naver", "naver"],
  ["github", "github"],
  ["instagram", "instagram"],
  ["youtube", "youtube"],
  ["twitter", "twitter"],
  ["x.com", "twitter"],
  ["threads", "threads"],
  ["facebook", "facebook"],
  ["linkedin", "linkedin"],
  ["medium", "medium"],
  ["tiktok", "tiktok"],
  ["dribbble", "dribbble"]
];

type ScanExperienceCopy = (typeof scanExperienceCopy)[Locale];
type LocalizedLabelSets = {
  category: Record<string, string>;
  country: Record<string, string>;
  risk: Record<string, string>;
};

interface MonitoringRegistrationRequest {
  ownerToken?: string;
  usernames: string[];
  purpose: "SELF_CHECK";
}

function isLocale(value: string | null | undefined): value is Locale {
  return value === "ko" || value === "en";
}

function createScanErrorPresentation(body: unknown, response: Response, locale: Locale): ScanErrorState {
  const error = readApiError(body);
  const retryAfterHeader = parseHeaderNumber(response.headers.get("Retry-After"));
  const resetAtHeader = response.headers.get("x-beta-free-scan-reset-at") ?? undefined;

  return scanErrorPresentation(
    {
      code: error.code,
      message: error.message,
      retryAfterSeconds: retryAfterHeader ?? error.retryAfterSeconds,
      resetAt: error.resetAt ?? resetAtHeader
    },
    locale
  );
}

function createQuotaNotice(response: Response, copy: ScanExperienceCopy, locale: Locale) {
  const remaining = parseHeaderNumber(response.headers.get("x-beta-free-scans-remaining"));
  const limit = parseHeaderNumber(response.headers.get("x-beta-free-scan-limit"));
  const resetAt = response.headers.get("x-beta-free-scan-reset-at");

  if (remaining === undefined || limit === undefined) return null;

  return copy.form.quotaRemaining(remaining, limit, resetAt ? formatDateTime(resetAt, locale) : null);
}

function readApiError(body: unknown) {
  if (!body || typeof body !== "object") return {};

  const maybeError = (body as { error?: unknown }).error;
  if (!maybeError || typeof maybeError !== "object") return {};

  const error = maybeError as Record<string, unknown>;
  const details = error.details && typeof error.details === "object" ? error.details as Record<string, unknown> : {};

  return {
    code: typeof error.code === "string" ? error.code : undefined,
    message: typeof error.message === "string" ? error.message : undefined,
    retryAfterSeconds: typeof details.retryAfterSeconds === "number" ? details.retryAfterSeconds : undefined,
    resetAt: typeof details.resetAt === "string" ? details.resetAt : undefined
  };
}

function parseHeaderNumber(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatDateTime(value: string, locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function ScanExperience({ initialLocale }: { initialLocale?: Locale } = {}) {
  const [locale, setLocale] = useState<Locale>(initialLocale ?? "ko");
  const [username, setUsername] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [history, setHistory] = useState<StoredScan[]>([]);
  const [scanError, setScanError] = useState<ScanErrorState | null>(null);
  const [freeScanNotice, setFreeScanNotice] = useState<string | null>(null);
  const [monitoringInput, setMonitoringInput] = useState("");
  const [monitoring, setMonitoring] = useState<PublicMonitoringSubscription | null>(null);
  const [monitoringMessage, setMonitoringMessage] = useState<string | null>(null);
  const [isSavingMonitoring, setIsSavingMonitoring] = useState(false);
  const resultsTitleRef = useRef<HTMLHeadingElement>(null);
  const resultPanelRef = useRef<HTMLElement>(null);
  const [devAdminEnabled, setDevAdminEnabled] = useState(false);
  const [devAdminToken, setDevAdminToken] = useState<string | null>(null);
  const [devAdminUsername, setDevAdminUsername] = useState("admin");
  const [devAdminPassword, setDevAdminPassword] = useState("");
  const [devAdminMessage, setDevAdminMessage] = useState<string | null>(null);
  const devAdminLogoClickRef = useRef({ count: 0, startedAt: 0 });
  const copy = scanExperienceCopy[locale];
  const localizedLabels = {
    category: categoryLabelsByLocale[locale],
    country: countryLabelsByLocale[locale],
    risk: riskLabelsByLocale[locale]
  };

  useEffect(() => {
    const queryLocale = new URLSearchParams(window.location.search).get("lang");
    const routeLocale = window.location.pathname === "/en" || window.location.pathname.startsWith("/en/") ? "en" : null;
    const savedLocale = window.localStorage.getItem(localeStorageKey);
    const nextLocale = isLocale(queryLocale)
      ? queryLocale
      : isLocale(routeLocale)
        ? routeLocale
        : isLocale(savedLocale)
          ? savedLocale
          : initialLocale ?? "ko";

    setLocale(nextLocale);

    const saved = window.localStorage.getItem("id-doppelganger-history");
    if (saved) {
      setHistory(JSON.parse(saved) as StoredScan[]);
    }

    const ownerToken = window.localStorage.getItem(monitoringOwnerTokenKey);
    if (ownerToken) {
      fetch("/api/monitoring", {
        headers: { "x-monitoring-owner-token": ownerToken }
      })
        .then(async (response) => {
          if (response.status === 404) {
            window.localStorage.removeItem(monitoringOwnerTokenKey);
            return null;
          }
          return response.ok ? response.json() : null;
        })
        .then((body) => {
          if (body?.monitoring) setMonitoring(body.monitoring as PublicMonitoringSubscription);
        })
        .catch(() => undefined);
    }

    const savedDevAdminToken = window.localStorage.getItem(devAdminTokenKey);
    if (savedDevAdminToken) {
      fetch("/api/dev/admin-session", {
        headers: devAdminHeaders(savedDevAdminToken)
      })
        .then((response) => response.ok ? response.json() : null)
        .then((body) => {
          if (body?.authenticated) {
            setDevAdminToken(savedDevAdminToken);
          } else {
            window.localStorage.removeItem(devAdminTokenKey);
          }
        })
        .catch(() => undefined);
    }

  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "ko";
    window.localStorage.setItem(localeStorageKey, locale);
  }, [locale]);

  useEffect(() => {
    if (!isScanning) return;

    const timer = window.setInterval(() => {
      setProgress((value) => Math.min(96, value + 7));
      setStepIndex((value) => Math.min(copy.scanSteps.length - 1, value + 1));
    }, 420);

    return () => window.clearInterval(timer);
  }, [copy.scanSteps.length, isScanning]);

  useEffect(() => {
    if (!summary) return;

    const timer = window.setTimeout(() => {
      focusResultPanelNow();
    }, 40);

    return () => window.clearTimeout(timer);
  }, [summary?.scanId]);

  const usernameValidationMessage = useMemo(() => getUsernameValidationMessage(username, locale), [locale, username]);
  const normalizedUsernamePreview = useMemo(() => {
    if (!username.trim() || usernameValidationMessage) return null;

    try {
      return normalizeUsername(username);
    } catch {
      return null;
    }
  }, [username, usernameValidationMessage]);
  const submitHint = useMemo(() => {
    if (isScanning) return null;
    if (!username.trim()) return copy.form.blocker.empty;
    if (usernameValidationMessage) return usernameValidationMessage;
    if (!acknowledged) return copy.form.blocker.acknowledge;
    return freeScanNotice ?? copy.form.ready;
  }, [acknowledged, copy, freeScanNotice, isScanning, username, usernameValidationMessage]);
  const monitoringDraft = useMemo(
    () => parseMonitoringDraft(monitoringInput, summary?.username ?? username, 3),
    [monitoringInput, summary?.username, username]
  );
  const canSubmitMonitoring =
    !isSavingMonitoring &&
    monitoringDraft.usernames.length > 0 &&
    monitoringDraft.invalid.length === 0 &&
    monitoringDraft.extraCount === 0;
  const canSubmit = username.trim().length >= 3 && !usernameValidationMessage && acknowledged && !isScanning;

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);

    const targetPath = nextLocale === "en" ? "/en" : "/";
    if (window.location.pathname === "/" || window.location.pathname === "/en") {
      window.history.replaceState(null, "", targetPath);
    }
  }

  function selectUsernameExample(nextUsername: string) {
    setUsername(nextUsername);
    setScanError(null);
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>("#username")?.focus();
      document.querySelector("#scan")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function handleBrandClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    const now = Date.now();
    const isSameSequence = now - devAdminLogoClickRef.current.startedAt <= devAdminLogoClickWindowMs;
    const nextCount = isSameSequence ? devAdminLogoClickRef.current.count + 1 : 1;
    devAdminLogoClickRef.current = {
      count: nextCount,
      startedAt: isSameSequence ? devAdminLogoClickRef.current.startedAt : now
    };

    if (nextCount < 5) return;

    devAdminLogoClickRef.current = { count: 0, startedAt: 0 };
    window.location.href = "/admin";
  }

  async function unlockDevAdminPanel() {
    const savedDevAdminToken = window.localStorage.getItem(devAdminTokenKey);

    try {
      const response = await fetch("/api/dev/admin-session", {
        headers: devAdminHeaders(savedDevAdminToken)
      });
      const body = response.ok ? await response.json() : null;

      if (!body?.enabled) return;

      setDevAdminEnabled(true);
      if (typeof body.username === "string") setDevAdminUsername(body.username);
      if (body.authenticated && savedDevAdminToken) {
        setDevAdminToken(savedDevAdminToken);
        setDevAdminMessage("개발자 테스트 모드가 켜져 있어요.");
      }
    } catch {
      // Keep the easter egg silent on production builds where the dev endpoint is absent.
    }
  }

  async function submitScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setScanError(null);
    setFreeScanNotice(null);
    setSummary(null);
    setProgress(9);
    setStepIndex(0);
    setIsScanning(true);

    try {
      const normalizedUsername = normalizeUsername(username);
      const scanOwnerToken = getOrCreateFreeScanOwnerToken();
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-scan-owner-token": scanOwnerToken,
          ...devAdminHeaders(devAdminToken)
        },
        body: JSON.stringify({ username: normalizedUsername, purpose: "SELF_CHECK", mode: "quick" })
      });

      const body = await response.json();

      if (!response.ok) {
        setScanError(createScanErrorPresentation(body, response, locale));
        return;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 720));
      setProgress(100);
      const nextSummary = body as ScanSummary;
      setSummary(nextSummary);
      setFreeScanNotice(createQuotaNotice(response, copy, locale));
      saveHistory(nextSummary);
      focusResultsSection();
    } catch (scanError) {
      setScanError(scanErrorPresentation(
        {
          message: scanError instanceof Error ? scanError.message : undefined
        },
        locale
      ));
    } finally {
      setIsScanning(false);
    }
  }

  function resetScanForNext() {
    setSummary(null);
    setScanError(null);
    setUsername("");
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>("#username")?.focus();
      document.querySelector("#scan")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function prepareMonitoring(usernameToMonitor: string) {
    setMonitoringInput(usernameToMonitor);
    setMonitoringMessage(null);
    window.setTimeout(() => {
      document.querySelector("#monitoring-usernames")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  function focusResultsSection() {
    window.setTimeout(() => {
      focusResultPanelNow();
    }, 0);
  }

  function focusResultPanelNow() {
    const panel = resultPanelRef.current ?? document.querySelector<HTMLElement>(".result-first-panel");
    const firstResultCard = panel?.querySelector<HTMLElement>(".rich-result-card") ?? null;
    const shouldCenterFirstCard = window.innerWidth <= 520 && firstResultCard;
    const scrollTarget = shouldCenterFirstCard ? firstResultCard : panel ?? resultsTitleRef.current;
    const focusTarget = panel ?? scrollTarget;
    if (!scrollTarget) return;

    const top = Math.max(0, scrollTarget.getBoundingClientRect().top + window.scrollY - 12);
    window.scrollTo({ top, behavior: "auto" });
    focusTarget?.focus({ preventScroll: true });
  }

  function saveHistory(nextSummary: ScanSummary) {
    const { fullResults: _fullResults, sourceReportHtml: _sourceReportHtml, ...summaryForStorage } = nextSummary;
    const item: StoredScan = { ...summaryForStorage, savedAt: new Date().toISOString() };
    const next = [item, ...history.filter((entry) => entry.scanId !== item.scanId)].slice(0, 5);
    setHistory(next);
    window.localStorage.setItem("id-doppelganger-history", JSON.stringify(next));
  }

  async function deleteScan(scanId: string) {
    await fetch(`/api/scans/${scanId}`, { method: "DELETE" }).catch(() => undefined);
    const next = history.filter((entry) => entry.scanId !== scanId);
    setHistory(next);
    window.localStorage.setItem("id-doppelganger-history", JSON.stringify(next));
    if (summary?.scanId === scanId) setSummary(null);
  }

  function clearHistory() {
    setHistory([]);
    window.localStorage.removeItem("id-doppelganger-history");
  }

  function restoreScanFromHistory(item: StoredScan) {
    setSummary(item);
    setUsername(item.username);
    setScanError(null);
    focusResultsSection();
  }

  async function submitMonitoring(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMonitoringMessage(null);

    if (monitoringDraft.invalid.length > 0) {
      setMonitoringMessage(copy.monitoring.invalidMessage(monitoringDraft.invalid));
      return;
    }

    if (monitoringDraft.extraCount > 0) {
      setMonitoringMessage(copy.monitoring.limitExceeded(monitoringDraft.extraCount));
      return;
    }

    if (monitoringDraft.usernames.length === 0) {
      setMonitoringMessage(copy.monitoring.previewEmpty);
      return;
    }

    setIsSavingMonitoring(true);

    const ownerToken = window.localStorage.getItem(monitoringOwnerTokenKey) ?? undefined;
    const payload: MonitoringRegistrationRequest = { ownerToken, usernames: monitoringDraft.usernames, purpose: "SELF_CHECK" };

    try {
      const response = await fetch("/api/monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 402 && body?.error?.code === "MONITORING_PAYMENT_REQUIRED") {
          await startMonitoringCheckout(payload);
          return;
        }

        throw new Error(body?.error?.message ?? "월간 모니터링을 등록하지 못했어요.");
      }

      window.localStorage.setItem(monitoringOwnerTokenKey, body.ownerToken);
      setMonitoring(body.monitoring as PublicMonitoringSubscription);
      setMonitoringInput((body.monitoring as PublicMonitoringSubscription).usernames.join(", "));
      setMonitoringMessage("월간 자동 재점검이 등록됐어요.");
    } catch (monitoringError) {
      setMonitoringMessage(monitoringError instanceof Error ? monitoringError.message : "월간 모니터링 등록 중 문제가 발생했어요.");
    } finally {
      setIsSavingMonitoring(false);
    }
  }

  async function startMonitoringCheckout(payload: MonitoringRegistrationRequest) {
    if (!summary?.scanId) {
      throw new Error(copy.monitoring.scanFirst);
    }

    setMonitoringMessage(copy.monitoring.checkoutStarting);
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scanId: summary.scanId, productId: "MONTHLY_MONITORING" })
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(body?.error?.message ?? "월간 모니터링 주문을 만들지 못했어요.");
    }

    if (typeof body?.orderId !== "string" || typeof body?.checkoutUrl !== "string") {
      throw new Error("월간 모니터링 결제 링크를 만들지 못했어요.");
    }

    window.localStorage.setItem(
      pendingMonitoringKey,
      JSON.stringify({
        orderId: body.orderId,
        ownerToken: payload.ownerToken,
        usernames: payload.usernames,
        purpose: payload.purpose
      })
    );
    window.location.href = body.checkoutUrl;
  }

  async function openMonitoringScan(scanId: string) {
    setScanError(null);
    setMonitoringMessage(null);

    try {
      const response = await fetch(`/api/scans/${scanId}/summary`);
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error?.message ?? "최근 재점검 결과를 불러오지 못했어요.");
      }

      setSummary(body as ScanSummary);
      focusResultsSection();
    } catch (scanError) {
      setMonitoringMessage(scanError instanceof Error ? scanError.message : "최근 재점검 결과를 불러오지 못했어요.");
    }
  }

  async function deleteMonitoring() {
    if (!monitoring) return;

    const ownerToken = window.localStorage.getItem(monitoringOwnerTokenKey);
    if (!ownerToken) return;

    setMonitoringMessage(null);
    const response = await fetch(`/api/monitoring/${monitoring.monitoringId}`, {
      method: "DELETE",
      headers: { "x-monitoring-owner-token": ownerToken }
    });

    if (response.ok) {
      window.localStorage.removeItem(monitoringOwnerTokenKey);
      setMonitoring(null);
      setMonitoringMessage("월간 모니터링을 해지했어요.");
    } else {
      const body = await response.json().catch(() => null);
      setMonitoringMessage(body?.error?.message ?? "월간 모니터링을 해지하지 못했어요.");
    }
  }

  async function loginDevAdmin() {
    setDevAdminMessage(null);

    const response = await fetch("/api/dev/admin-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: devAdminUsername, password: devAdminPassword })
    });
    const body = await response.json().catch(() => null);

    if (!response.ok || !body?.token) {
      setDevAdminMessage(body?.error?.message ?? "개발자 테스트 로그인에 실패했어요.");
      return;
    }

    window.localStorage.setItem(devAdminTokenKey, body.token);
    setDevAdminToken(body.token);
    setDevAdminPassword("");
    setDevAdminMessage("개발자 테스트 모드가 켜졌어요. 제한 없이 전체 결과를 볼 수 있어요.");
  }

  function logoutDevAdmin() {
    window.localStorage.removeItem(devAdminTokenKey);
    setDevAdminToken(null);
    setDevAdminPassword("");
    setDevAdminMessage("개발자 테스트 모드를 껐어요.");
  }

  return (
    <main className="app-shell">
      <header className="container topbar">
        <a className="brand-mark" href={locale === "en" ? "/en" : "/"} aria-label={copy.brandHomeLabel} onClick={handleBrandClick}>
          <BrandIcon />
          <span>{copy.brandName}</span>
        </a>
        <div className="topbar-actions">
          <nav className="nav-links" aria-label={copy.navLabel}>
            <a href="#results">{copy.nav.results}</a>
            <a href="#pricing">{copy.nav.pricing}</a>
            <a href="/guides/id-rarity-test">{copy.nav.guides}</a>
            <a href="/toss">{copy.nav.toss}</a>
          </nav>
          <LanguageSwitch copy={copy} locale={locale} onChange={changeLocale} />
        </div>
      </header>

      <section id="scan" className="container hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={15} aria-hidden />
            {copy.hero.eyebrow}
          </span>
          <h1 id="hero-title">{copy.hero.title}</h1>
          <p>
            {copy.hero.description}
          </p>
          <div className="trust-strip" aria-label={copy.hero.safetyLabel}>
            {copy.hero.trust.map((item) => (
              <span className="trust-chip" key={item}>
                <ShieldCheck size={15} aria-hidden /> {item}
              </span>
            ))}
          </div>
        </div>

        <form className="scan-panel" onSubmit={submitScan} aria-label={copy.form.scanLabel}>
          <div className="radar" aria-hidden>
            <div className="radar-core">
              {isScanning ? `${progress}%` : username.trim() || "username"}
            </div>
          </div>

          <div className="field-stack">
            <label htmlFor="username">{copy.form.label}</label>
            <input
              id="username"
              aria-label={copy.form.ariaLabel}
              className="id-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={copy.form.placeholder}
              autoComplete="off"
              inputMode="text"
              maxLength={30}
            />
            <div className="input-meta-row">
              <span>{copy.form.charCount((normalizedUsernamePreview ?? username.trim().replace(/^@+/, "")).length)}</span>
              {normalizedUsernamePreview ? <span>{copy.form.withoutAt(normalizedUsernamePreview)}</span> : null}
            </div>
            {usernameValidationMessage ? (
              <p className="field-help" data-tone="error" role="alert">
                {usernameValidationMessage}
              </p>
            ) : null}
            <div className="example-chip-list" aria-label={copy.results.emptyExamplesLabel}>
              {copy.form.examples.map((example) => (
                <button className="example-chip" key={example} type="button" onClick={() => selectUsernameExample(example)}>
                  {example}
                </button>
              ))}
            </div>
          </div>

          {history.length > 0 ? (
            <div className="quick-history" aria-label={copy.history.quickTitle}>
              <span className="quick-history-label">
                <History size={14} aria-hidden />
                {copy.history.quickTitle}
              </span>
              <div className="quick-history-list">
                {history.slice(0, 3).map((item) => (
                  <button
                    aria-label={`${copy.history.quickTitle}: ${item.username}`}
                    className="quick-history-button"
                    key={`quick-${item.scanId}`}
                    type="button"
                    onClick={() => restoreScanFromHistory(item)}
                  >
                    <strong>{item.username}</strong>
                    <span>{copy.history.meta(item.foundCount, item.rarityScore)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <ul className="scan-expectation-list">
            {copy.form.expected.map((item) => (
              <li key={item}>
                <CheckCircle2 size={15} aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <label className="check-row">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span>{copy.form.acknowledgement}</span>
          </label>

          {isScanning ? (
            <div className="scan-loading-card" role="status" aria-live="polite">
              <div className="scan-loading-copy">
                <ScanEyeLoader />
                <div>
                  <p>{copy.scanSteps[stepIndex]}</p>
                  <ol className="scan-step-list">
                    {copy.scanSteps.map((step, index) => (
                      <li data-state={index < stepIndex ? "done" : index === stepIndex ? "active" : "pending"} key={step}>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
              <strong>{progress}%</strong>
            </div>
          ) : null}

          {scanError ? (
            <div className="error-box scan-error-box" data-tone={scanError.tone} role="alert">
              <div className="scan-error-heading">
                <AlertTriangle size={18} aria-hidden />
                <strong>{scanError.title}</strong>
              </div>
              <p>{scanError.message}</p>
              <span>{scanError.action}</span>
              <div className="scan-error-actions">
                <button className="secondary-button" disabled={!canSubmit} type="submit">
                  <RotateCcw size={15} aria-hidden />
                  {copy.form.retry}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => document.querySelector<HTMLInputElement>("#username")?.focus()}
                >
                  {copy.form.changeInput}
                </button>
              </div>
            </div>
          ) : null}

          {submitHint ? (
            <p className="submit-hint" data-ready={canSubmit ? "true" : "false"}>
              {submitHint}
            </p>
          ) : null}

          <button className="primary-button" disabled={!canSubmit} type="submit">
            {isScanning ? <ScanEyeLoader compact /> : <Search size={18} aria-hidden />}
            {isScanning ? copy.form.submitting : copy.form.submit}
          </button>

          {devAdminEnabled ? (
            <DevAdminPanel
              isActive={Boolean(devAdminToken)}
              message={devAdminMessage}
              onLogin={loginDevAdmin}
              onLogout={logoutDevAdmin}
              password={devAdminPassword}
              setPassword={setDevAdminPassword}
              setUsername={setDevAdminUsername}
              username={devAdminUsername}
              copy={copy}
            />
          ) : null}
        </form>

        <p className="web-safety-note">
          {copy.form.safetyNote}
        </p>
      </section>

      <section id="results" className="section light-section" data-has-summary={summary ? "true" : "false"}>
        <div className="container">
          <div className="section-header">
            <div>
              <h2 className="result-heading" ref={resultsTitleRef} tabIndex={-1}>
                {copy.results.heading(summary)}
              </h2>
            </div>
            {summary ? (
              <button className="danger-button" type="button" onClick={() => deleteScan(summary.scanId)}>
                <Trash2 size={17} aria-hidden />
                {copy.results.delete}
              </button>
            ) : null}
          </div>

          {summary ? (
            <ResultDashboard
              devAdminToken={devAdminToken}
              onPrepareMonitoring={() => prepareMonitoring(summary.username)}
              onScanAgain={resetScanForNext}
              resultPanelRef={resultPanelRef}
              summary={summary}
              copy={copy}
              labels={localizedLabels}
              locale={locale}
            />
          ) : (
            <EmptyResultPreview copy={copy} onExampleSelect={selectUsernameExample} />
          )}
        </div>
      </section>

      <section id="pricing" className="section light-section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2>{copy.pricing.title}</h2>
            </div>
          </div>
          <div className="pricing-grid">
            <PricingCard
              title={copy.pricing.freeTitle}
              price={copy.pricing.freePrice}
              items={copy.pricing.freeItems}
              actionLabel={copy.pricing.freeCta}
            />
            <PricingCard
              featured
              badgeLabel={copy.pricing.recommended}
              title={copy.pricing.reportTitle}
              price={copy.pricing.reportPrice}
              items={copy.pricing.reportItems}
              actionLabel={copy.pricing.reportCta}
            />
            <PricingCard
              title={copy.pricing.monitoringTitle}
              price={copy.pricing.monitoringPrice}
              items={copy.pricing.monitoringItems}
              actionLabel={copy.pricing.monitoringCta}
            />
          </div>
        </div>
      </section>

      <section className="section light-section">
        <div className="container results-grid">
          <section className="panel" aria-labelledby="monitoring-title">
            <div className="section-header">
              <div>
                <h2 id="monitoring-title">{copy.monitoring.title}</h2>
              </div>
            </div>
            <form className="monitoring-form" onSubmit={submitMonitoring}>
              <div className="field-stack">
                <label htmlFor="monitoring-usernames">{copy.monitoring.inputLabel}</label>
                <input
                  id="monitoring-usernames"
                  className="id-input"
                  value={monitoringInput}
                  onChange={(event) => setMonitoringInput(event.target.value)}
                  placeholder={summary?.username ?? (username.trim() || copy.monitoring.placeholder)}
                  autoComplete="off"
                />
              </div>
              <div className="monitoring-draft" aria-live="polite">
                <div className="monitoring-draft-header">
                  <strong>{copy.monitoring.previewLabel}</strong>
                  <span>{copy.monitoring.countLabel(monitoringDraft.usernames.length)}</span>
                </div>
                {monitoringDraft.usernames.length > 0 ? (
                  <div className="monitoring-draft-list">
                    {monitoringDraft.usernames.map((item) => (
                      <span className="score-pill" data-tone="medium" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p>{copy.monitoring.previewEmpty}</p>
                )}
                {monitoringDraft.duplicateCount > 0 ? (
                  <p>{copy.monitoring.duplicateNote(monitoringDraft.duplicateCount)}</p>
                ) : null}
                {monitoringDraft.invalid.length > 0 ? (
                  <p data-tone="error">{copy.monitoring.invalidMessage(monitoringDraft.invalid)}</p>
                ) : monitoringDraft.extraCount > 0 ? (
                  <p data-tone="error">{copy.monitoring.limitExceeded(monitoringDraft.extraCount)}</p>
                ) : monitoringDraft.usernames.length > 0 ? (
                  <p>{copy.monitoring.ready(monitoringDraft.usernames.length)}</p>
                ) : null}
              </div>
              <button className="primary-button" type="submit" disabled={!canSubmitMonitoring}>
                <Bell size={18} aria-hidden />
                {isSavingMonitoring ? copy.monitoring.saving : copy.monitoring.submit}
              </button>
            </form>
            {monitoringMessage ? (
              <div className="mini-card" role="status" style={{ marginTop: 12 }}>
                <p>{monitoringMessage}</p>
              </div>
            ) : null}
          </section>

          <section className="panel" aria-labelledby="monitoring-status-title">
            <h2 id="monitoring-status-title">{copy.monitoring.statusTitle}</h2>
            {monitoring ? (
              <div className="monitoring-status">
                <div className="monitoring-chip-list">
                  {monitoring.usernames.map((item) => (
                    <span className="score-pill" data-tone="high" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
                <div className="mini-card">
                  <p>{copy.monitoring.nextRun}</p>
                  <strong>{new Date(monitoring.nextRunAt).toLocaleDateString(locale === "en" ? "en-US" : "ko-KR")}</strong>
                </div>
                <div className="mini-card">
                  <p>{copy.monitoring.lastRun}</p>
                  <strong>
                    {monitoring.lastRunAt
                      ? new Date(monitoring.lastRunAt).toLocaleDateString(locale === "en" ? "en-US" : "ko-KR")
                      : copy.monitoring.noneYet}
                  </strong>
                </div>
                <MonitoringLatestScans copy={copy} locale={locale} monitoring={monitoring} onOpenScan={openMonitoringScan} />
                <div className="mini-card monitoring-delivery-note">
                  <Bell size={16} aria-hidden />
                  <p>{copy.monitoring.deliveryNote}</p>
                </div>
                <button className="danger-button" type="button" onClick={deleteMonitoring}>
                  <Trash2 size={17} aria-hidden />
                  {copy.monitoring.cancel}
                </button>
              </div>
            ) : (
              <p style={{ color: "#6b7684", lineHeight: 1.65, margin: "14px 0 0" }}>
                {copy.monitoring.empty}
              </p>
            )}
          </section>
        </div>
      </section>

      <section className="section light-section">
        <div className="container results-grid">
          <section className="panel" aria-labelledby="history-title">
            <div className="history-header">
              <h2 id="history-title">{copy.history.title}</h2>
              {history.length > 0 ? (
                <button className="ghost-button" type="button" onClick={clearHistory}>
                  <Trash2 size={15} aria-hidden />
                  {copy.history.clearAll}
                </button>
              ) : null}
            </div>
            <div className="history-list" style={{ marginTop: 14 }}>
              {history.length === 0 ? (
                <p style={{ color: "#6b7684", margin: 0 }}>{copy.history.empty}</p>
              ) : (
                history.map((item) => (
                  <div className="history-row" key={item.scanId}>
                    <div>
                      <strong>{item.username}</strong>
                      <span>
                        {copy.history.meta(item.foundCount, item.rarityScore)}
                      </span>
                      <small>{copy.history.savedAt(formatDateTime(item.savedAt, locale))}</small>
                    </div>
                    <div className="history-row-actions">
                      <button
                        aria-label={copy.history.restoreAria(item.username)}
                        className="ghost-button"
                        type="button"
                        onClick={() => restoreScanFromHistory(item)}
                      >
                        <History size={16} aria-hidden />
                        {copy.history.restore}
                      </button>
                      <button
                        aria-label={copy.history.deleteAria(item.username)}
                        className="ghost-button"
                        type="button"
                        onClick={() => deleteScan(item.scanId)}
                      >
                        <Trash2 size={16} aria-hidden />
                        {copy.history.delete}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
          <section className="panel" aria-labelledby="faq-title">
            <h2 id="faq-title">{copy.faq.title}</h2>
            <ul className="faq-list" style={{ marginTop: 14 }}>
              {copy.faq.items.map(([question, answer]) => (
                <li className="faq-item" key={question}>
                  <strong>{question}</strong>
                  <span>{answer}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <span>© 2026 {copy.brandName}</span>
          <div className="footer-links">
            <a href="/privacy">{copy.footer.privacy}</a>
            <a href="/terms">{copy.footer.terms}</a>
            <a href="/responsible-use">{copy.footer.responsibleUse}</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function ResultDashboard({
  copy,
  devAdminToken,
  labels,
  locale,
  summary,
  onPrepareMonitoring,
  onScanAgain,
  resultPanelRef
}: {
  copy: ScanExperienceCopy;
  devAdminToken: string | null;
  labels: LocalizedLabelSets;
  locale: Locale;
  summary: ScanSummary;
  onPrepareMonitoring: () => void;
  onScanAgain: () => void;
  resultPanelRef: RefObject<HTMLElement | null>;
}) {
  const [isLoadingFull, setIsLoadingFull] = useState(false);
  const [isLoadingDetailAccess, setIsLoadingDetailAccess] = useState(true);
  const [detailAccess, setDetailAccess] = useState<DetailAccessState | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const activeAccess = detailAccess ?? previewAccessFromSummary(summary, copy);
  const visibleResultCount = activeAccess.results.length;
  const lockedResultCount = activeAccess.lockedCount;
  const distribution = useMemo(() => {
    const countries = Object.entries(summary.countryDistribution);
    const categories = Object.entries(summary.categoryDistribution);
    return { countries, categories };
  }, [summary]);
  const insightTone = resultInsightTone(summary);
  const insight = copy.results.insight[insightTone];
  const topCountries = useMemo(() => topDistributionEntries(summary.countryDistribution, 2), [summary.countryDistribution]);
  const topCategories = useMemo(() => topDistributionEntries(summary.categoryDistribution, 2), [summary.categoryDistribution]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetailAccess() {
      setIsLoadingDetailAccess(true);
      setDetailAccess(null);
      setReportError(null);

      try {
        const nextAccess = devAdminToken
          ? await loadDevAdminResults(summary.scanId, devAdminToken, copy)
          : await loadFirstFreeOrPreviewResults(summary, copy);

        if (!cancelled) setDetailAccess(nextAccess);
      } catch (error) {
        if (!cancelled) {
          setDetailAccess(previewAccessFromSummary(summary, copy));
          setReportError(error instanceof Error ? error.message : "결과 접근 상태를 확인하지 못했어요.");
        }
      } finally {
        if (!cancelled) setIsLoadingDetailAccess(false);
      }
    }

    loadDetailAccess();

    return () => {
      cancelled = true;
    };
  }, [copy, devAdminToken, summary]);

  async function openFullReport() {
    if (detailAccess?.access === "FULL" && detailAccess.sourceReportHtml) {
      downloadHtmlReport(summary, detailAccess.results);
      return;
    }

    if (detailAccess?.access === "FULL" && detailAccess.reportToken) {
      window.location.href = `/reports/${summary.scanId}?token=${encodeURIComponent(detailAccess.reportToken)}`;
      return;
    }

    if (detailAccess?.access === "FULL" && detailAccess.adminToken) {
      window.location.href = `/reports/${summary.scanId}?adminToken=${encodeURIComponent(detailAccess.adminToken)}`;
      return;
    }

    setIsLoadingFull(true);
    setReportError(null);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: summary.scanId, productId: "DETAILED_REPORT" })
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error?.message ?? "주문을 만들지 못했어요.");
      }

      window.location.href = body.checkoutUrl;
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "주문을 만들지 못했어요.");
    } finally {
      setIsLoadingFull(false);
    }
  }

  async function copyShareSummary() {
    const shareText = buildShareSummary(summary, locale);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        copyTextFallback(shareText);
      }
      setCopyMessage(copy.copyMessages.copied);
    } catch {
      setCopyMessage(copy.copyMessages.failed);
    }
  }

  return (
    <div className="dashboard-stack">
      <section className="panel result-first-panel" ref={resultPanelRef} tabIndex={-1} aria-labelledby="preview-title">
        <div className="result-first-header">
          <div>
            <span className="source-badge" data-source={summary.scanSource ?? "LOCAL_FALLBACK"}>
              {copy.results.sourceBadge}
            </span>
            <h2 id="preview-title">
              {copy.results.previewTitle(summary)}
            </h2>
          </div>
        </div>
        <div className="result-insight-banner" data-tone={insightTone}>
          <div>
            <span>
              <ListChecks size={15} aria-hidden />
              {copy.results.insightLabel}
            </span>
            <strong>{insight.title}</strong>
            <p>{insight.description}</p>
          </div>
          <em>{insight.action}</em>
        </div>
        <div className="result-snapshot" aria-label={copy.results.snapshotLabel}>
          {topCountries.map(([key, count]) => (
            <span key={`country-${key}`}>
              {copy.results.topCountries}: <strong>{labels.country[key] ?? key}</strong> {formatCount(count, locale)}
            </span>
          ))}
          {topCategories.map(([key, count]) => (
            <span key={`category-${key}`}>
              {copy.results.topCategories}: <strong>{labels.category[key] ?? key}</strong> {formatCount(count, locale)}
            </span>
          ))}
        </div>
        <ResultPreview
          copy={copy}
          detailAccess={activeAccess}
          isLoadingFull={isLoadingFull}
          isLoadingResults={isLoadingDetailAccess}
          labels={labels}
          onOpenFullReport={openFullReport}
        />
        <div className="result-first-metrics" aria-label={copy.results.metricsLabel}>
          <span>
            <strong>{visibleResultCount}</strong>
            {copy.results.visible}
          </span>
          <span>
            <strong>{lockedResultCount}</strong>
            {copy.results.locked}
          </span>
          <span>
            <strong>{summary.countryDistribution.KR ?? 0}</strong>
            {copy.results.korea}
          </span>
        </div>
        {reportError ? (
          <div className="error-box" role="alert" style={{ marginTop: 12 }}>
            {reportError}
          </div>
        ) : null}
      </section>

      <section className="action-strip" aria-label={copy.results.nextActions}>
        <div>
          <div className="action-strip-title">
            <strong>{summary.username}</strong>
          </div>
          {detailAccess ? (
            <span className="action-status" role="status">
              {detailAccess.label}
            </span>
          ) : null}
          {copyMessage ? (
            <span className="action-status" role="status" aria-live="polite">
              {copyMessage}
            </span>
          ) : null}
        </div>
        <div className="action-strip-buttons">
          <a
            className="secondary-button"
            download={`id-doppelganger-${summary.username}-share.png`}
            href={`/api/scans/${summary.scanId}/share.png`}
          >
            <Download size={16} aria-hidden />
            {copy.results.shareCard}
          </a>
          <button className="secondary-button" type="button" onClick={copyShareSummary}>
            <Copy size={16} aria-hidden />
            {copy.results.copySummary}
          </button>
          <button className="secondary-button" type="button" onClick={onPrepareMonitoring}>
            <Bell size={16} aria-hidden />
            {copy.results.monitoringAdd}
          </button>
          <button className="ghost-button" type="button" onClick={onScanAgain}>
            <Search size={16} aria-hidden />
            {copy.results.scanAgain}
          </button>
        </div>
      </section>

      {detailAccess?.access === "FULL" && detailAccess.maigretReportAvailable ? (
        <OriginalHtmlReportPanel copy={copy} detailAccess={detailAccess} />
      ) : null}

      <div className="results-grid analysis-grid" aria-label={copy.results.analysisLabel}>
        <section className="panel" aria-labelledby="distribution-title">
          <h2 id="distribution-title">{copy.results.interpretation}</h2>
          <div className="distribution-grid" style={{ marginTop: 14 }}>
            <MiniMetric label={copy.results.checkedPlatforms} value={formatCount(summary.checkedCount, locale)} />
            <MiniMetric label={copy.results.failedChecks} value={`${summary.failedRate}%`} />
            <MiniMetric label={copy.results.koreanServices} value={formatCount(summary.countryDistribution.KR ?? 0, locale)} />
          </div>
          <Distribution locale={locale} title={copy.results.countries} entries={distribution.countries} labelMap={labels.country} />
          <Distribution locale={locale} title={copy.results.categories} entries={distribution.categories} labelMap={labels.category} />
        </section>

        <section className="panel" aria-labelledby="score-title">
          <h2 id="score-title">{copy.results.score}</h2>
          <div className="score-stack" style={{ marginTop: 14 }}>
            <div className="score-main compact-score">
              <div style={{ textAlign: "center" }}>
                <strong>{summary.doppelgangerScore}</strong>
                <span>{locale === "en" ? "pts" : "점"}</span>
              </div>
            </div>
            <ul className="score-list">
              <ScoreLine label={copy.results.rarity} locale={locale} value={summary.rarityScore} />
              <ScoreLine label={copy.results.exposure} locale={locale} value={summary.exposureScore} />
              <ScoreLine label={copy.results.impersonation} locale={locale} value={summary.impersonationScore} />
              <ScoreLine label={copy.results.cleanup} locale={locale} value={summary.cleanupScore} />
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function LanguageSwitch({
  copy,
  locale,
  onChange
}: {
  copy: ScanExperienceCopy;
  locale: Locale;
  onChange: (locale: Locale) => void;
}) {
  const options: Locale[] = ["ko", "en"];

  return (
    <div className="language-switch" role="group" aria-label={copy.languageLabel}>
      {options.map((option) => (
        <a
          aria-current={locale === option ? "page" : undefined}
          data-active={locale === option ? "true" : "false"}
          href={option === "en" ? "/en" : "/"}
          key={option}
          onClick={(event) => {
            event.preventDefault();
            onChange(option);
          }}
        >
          {copy.languageOptions[option]}
        </a>
      ))}
    </div>
  );
}

function EmptyResultPreview({
  copy,
  onExampleSelect
}: {
  copy: ScanExperienceCopy;
  onExampleSelect: (username: string) => void;
}) {
  return (
    <div className="dashboard-stack">
      <section className="panel result-first-panel empty-result-panel" aria-label="검색 전 결과 상태">
        <div className="empty-result-icon" aria-hidden>
          <Search size={24} />
        </div>
        <h2>{copy.results.emptyTitle}</h2>
        <p>{copy.results.emptyDescription}</p>
        <ol className="empty-result-flow">
          {copy.results.emptySteps.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <div className="empty-result-actions" aria-label={copy.results.emptyExamplesLabel}>
          {copy.results.emptyExamples.map((example) => (
            <button className="example-chip" key={example} type="button" onClick={() => onExampleSelect(example)}>
              {example}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ScoreLine({ label, locale, value }: { label: string; locale: Locale; value: number }) {
  return (
    <li className="score-item">
      <span>{label}</span>
      <span className="score-pill" data-tone={scoreTone(value)}>
        {formatScore(value, locale)}
      </span>
    </li>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-card">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function Distribution({
  title,
  entries,
  labelMap,
  locale
}: {
  title: string;
  entries: [string, number][];
  labelMap: Record<string, string>;
  locale: Locale;
}) {
  const displayEntries: [string, number][] = entries.length ? entries : [[locale === "en" ? "None" : "없음", 0]];

  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ fontSize: 16 }}>{title}</h3>
      <div className="distribution-grid" style={{ marginTop: 10 }}>
        {displayEntries.map(([key, value]) => (
          <MiniMetric key={key} label={labelMap[key] ?? key} value={formatCount(value, locale)} />
        ))}
      </div>
    </div>
  );
}

function ResultPreview({
  copy,
  detailAccess,
  isLoadingFull,
  isLoadingResults,
  labels,
  onOpenFullReport
}: {
  copy: ScanExperienceCopy;
  detailAccess: DetailAccessState;
  isLoadingFull: boolean;
  isLoadingResults: boolean;
  labels: LocalizedLabelSets;
  onOpenFullReport: () => void;
}) {
  const isFullAccess = detailAccess.access === "FULL";
  const hiddenCount = Math.max(detailAccess.lockedCount, 0);
  const lockedPreviewResults = detailAccess.lockedResults ?? [];
  const lockedLead =
    detailAccess.label === copy.detailLabels.freePreview
      ? copy.preview.freeUsedLead
      : !isFullAccess && detailAccess.description !== copy.detailLabels.lockedUrl
        ? `${detailAccess.description} `
        : "";
  const hasResults = detailAccess.results.length > 0;
  const hasUnlockableReport = !isFullAccess && (hasResults || hiddenCount > 0);
  const showReportAction = isFullAccess || hasUnlockableReport;
  const ctaLabel = isFullAccess ? copy.preview.fullReport : copy.preview.checkoutWithPrice;
  const footerMessage = isFullAccess
    ? copy.preview.fullOpen(detailAccess.results.length)
    : hasUnlockableReport && hiddenCount > 0
      ? `${lockedLead}${copy.preview.lockedCount(hiddenCount)}`
      : hasUnlockableReport
        ? detailAccess.description
        : copy.preview.emptyNoCheckout;

  return (
    <div className="result-list" data-result-count={detailAccess.results.length}>
      {hasResults ? (
        detailAccess.results.map((result, index) => (
          <RichResultCard copy={copy} index={index} isFullAccess={isFullAccess} key={result.id} labels={labels} result={result} />
        ))
      ) : (
        <div className="locked-results">
          <span>{copy.preview.noResults}</span>
          <CheckCircle2 size={18} aria-hidden />
        </div>
      )}

      {isLoadingResults ? (
        <div className="detail-access-status" role="status" aria-live="polite">
          <Radar size={17} aria-hidden />
          <span>{copy.preview.loading}</span>
        </div>
      ) : null}

      {!isFullAccess && hiddenCount > 0 ? (
        <div className="locked-mosaic-list" aria-label={copy.preview.lockedLabel}>
          {lockedPreviewResults.length > 0
            ? lockedPreviewResults.map((result, index) => (
                <LockedResultMosaic
                  copy={copy}
                  index={detailAccess.results.length + index}
                  key={result.id}
                  labels={labels}
                  result={result}
                />
              ))
            : Array.from({ length: Math.min(5, hiddenCount) }).map((_, index) => (
                <LockedResultMosaic
                  copy={copy}
                  index={detailAccess.results.length + index}
                  key={`locked-${index}`}
                  labels={labels}
                />
              ))}
        </div>
      ) : null}

      {hasUnlockableReport ? <ReportUnlockPanel copy={copy} /> : null}

      <div className="locked-results" data-empty={!showReportAction} data-open={isFullAccess}>
        <span className="locked-results-copy">
          <strong>{footerMessage}</strong>
          {!showReportAction ? <span>{copy.preview.emptyNoCheckoutDescription}</span> : null}
        </span>
        {showReportAction ? (
          <button className="secondary-button" type="button" onClick={onOpenFullReport} disabled={isLoadingFull}>
            {isFullAccess ? <Download size={16} aria-hidden /> : <CreditCard size={16} aria-hidden />}
            {isLoadingFull ? copy.preview.ordering : ctaLabel}
          </button>
        ) : (
          <CheckCircle2 size={18} aria-hidden />
        )}
      </div>
    </div>
  );
}

function ReportUnlockPanel({ copy }: { copy: ScanExperienceCopy }) {
  return (
    <div className="report-unlock-panel" role="note" aria-label={copy.preview.unlockTitle}>
      <div className="report-unlock-title">
        <LockKeyhole size={17} aria-hidden />
        <strong>{copy.preview.unlockTitle}</strong>
      </div>
      <ul>
        {copy.preview.unlockItems.map((item) => (
          <li key={item}>
            <CheckCircle2 size={16} aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LockedResultMosaic({
  copy,
  index,
  labels,
  result
}: {
  copy: ScanExperienceCopy;
  index: number;
  labels: LocalizedLabelSets;
  result?: LockedScanResultPreview;
}) {
  const title = result?.platform ?? copy.preview.lockedResult(index + 1);
  const maskedUrl = result?.maskedUrl ?? copy.preview.lockedUrlFallback;

  return (
    <div className="locked-result-mosaic">
      <div className="toss-locked-icon" aria-hidden>
        {result?.platform.slice(0, 1).toUpperCase() ?? ""}
      </div>
      <div className="mosaic-content">
        <strong>{title}</strong>
        <span>
          {result
            ? `${labels.category[result.category] ?? result.category} · ${labels.country[result.country] ?? result.country}`
            : copy.preview.lockedDescription}
        </span>
        <div className="masked-url-teaser" aria-label={copy.preview.maskedAria(title)}>
          <LockKeyhole size={13} aria-hidden />
          <span>{maskedUrl}</span>
        </div>
      </div>
      <LockKeyhole size={17} aria-hidden />
    </div>
  );
}

function RichResultCard({
  copy,
  result,
  isFullAccess,
  labels,
  index = 0
}: {
  copy: ScanExperienceCopy;
  result: ScanResult;
  isFullAccess: boolean;
  labels: LocalizedLabelSets;
  index?: number;
}) {
  const host = hostnameFromUrl(result.url);
  const visibleTags = (result.tags ?? []).slice(0, 4);
  const brandKey = platformBrandKey(result);

  return (
    <article className="rich-result-card" data-brand={brandKey} aria-label={copy.preview.candidateAria(result.platform)}>
      <div className="result-card-media">
        <PlatformIcon result={result} />
        <ResultProfileImage result={result} />
      </div>
      <div className="result-card-body">
        <div className="result-card-title-row">
          <div>
            <span className="result-rank-badge">{copy.preview.foundRank(index + 1)}</span>
            <h3>{result.platform}</h3>
            <p>
              {labels.category[result.category] ?? result.category} · {labels.country[result.country] ?? result.country}
              {host ? ` · ${host}` : ""}
            </p>
          </div>
          <span className="risk-badge" data-risk={result.riskLevel}>
            {labels.risk[result.riskLevel] ?? result.riskLevel}
          </span>
        </div>

        {visibleTags.length > 0 || result.rank || result.httpStatus ? (
          <div className="result-card-meta" aria-label={copy.preview.metadataAria(result.platform)}>
            {result.rank ? <span>Rank {result.rank}</span> : null}
            {result.httpStatus ? <span>HTTP {result.httpStatus}</span> : null}
            {visibleTags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        ) : null}

        {isFullAccess ? (
          <>
            <a className="result-link" href={result.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={15} aria-hidden />
              <span>{result.url}</span>
            </a>
            <p className="cleanup-hint">{result.cleanupHint}</p>
          </>
        ) : (
          <>
            <a className="result-link preview-result-link" href={result.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={15} aria-hidden />
              <span>{result.url}</span>
            </a>
            <p className="cleanup-hint">{result.cleanupHint}</p>
            <p className="preview-lock-copy">{copy.preview.lockCopy}</p>
          </>
        )}
      </div>
    </article>
  );
}

function PlatformIcon({ result }: { result: ScanResult }) {
  const [isBroken, setIsBroken] = useState(false);
  const initial = result.platform.slice(0, 1).toUpperCase();
  const brandKey = platformBrandKey(result);

  return (
    <div className="platform-icon-shell" data-brand={brandKey} aria-hidden>
      {result.platformIconUrl && !isBroken ? (
        <img alt="" src={result.platformIconUrl} onError={() => setIsBroken(true)} />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

function ResultProfileImage({ result }: { result: ScanResult }) {
  const [isBroken, setIsBroken] = useState(false);

  return (
    <div className="profile-thumb" aria-hidden>
      {result.profileImageUrl && !isBroken ? (
        <img alt="" src={result.profileImageUrl} onError={() => setIsBroken(true)} />
      ) : (
        <UserRound size={34} strokeWidth={1.8} />
      )}
    </div>
  );
}

function OriginalHtmlReportPanel({ copy, detailAccess }: { copy: ScanExperienceCopy; detailAccess: DetailAccessState }) {
  const reportUrl = maigretReportUrlFor(detailAccess);
  const [inlineReportUrl, setInlineReportUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!detailAccess.sourceReportHtml) {
      setInlineReportUrl(null);
      return;
    }

    const blobUrl = URL.createObjectURL(new Blob([detailAccess.sourceReportHtml], { type: "text/html;charset=utf-8" }));
    setInlineReportUrl(blobUrl);
    return () => URL.revokeObjectURL(blobUrl);
  }, [detailAccess.sourceReportHtml]);

  if (!reportUrl && !detailAccess.sourceReportHtml) return null;
  const openUrl = reportUrl ?? inlineReportUrl ?? undefined;

  return (
    <section className="panel source-report-panel" aria-labelledby="source-report-title">
      <div className="source-report-launch">
        <div>
          <h2 id="source-report-title">{copy.sourceReport.title}</h2>
        </div>
        <div className="source-report-actions">
          <a className="secondary-button" href={openUrl} target="_blank" rel="noopener noreferrer" aria-disabled={!openUrl}>
            <ExternalLink size={16} aria-hidden />
            {copy.sourceReport.open}
          </a>
          <a className="ghost-button" download={detailAccess.maigretReportFilename} href={openUrl}>
            <Download size={16} aria-hidden />
            {copy.sourceReport.save}
          </a>
        </div>
      </div>
      <iframe
        className="source-report-frame"
        title={copy.sourceReport.iframeTitle}
        src={reportUrl ?? undefined}
        srcDoc={detailAccess.sourceReportHtml}
        loading="lazy"
      />
    </section>
  );
}

function FullReport({ summary, results }: { summary: ScanSummary; results: ScanResult[] }) {
  const labels = {
    category: categoryLabelsByLocale.ko,
    country: countryLabelsByLocale.ko,
    risk: riskLabelsByLocale.ko
  };

  return (
    <section style={{ marginTop: 18 }} aria-labelledby="full-report-title">
      <div className="section-header" style={{ marginBottom: 12 }}>
        <div>
          <h2 id="full-report-title">전체 리포트</h2>
          <p>발견 플랫폼, URL, 위험도, 조치 가이드를 확인하세요.</p>
        </div>
        <button className="ghost-button" type="button" onClick={() => downloadHtmlReport(summary, results)}>
          <Download size={16} aria-hidden />
          HTML 리포트 다운로드
        </button>
      </div>
      <div className="result-list">
        {results.map((result) => (
          <article className="result-row" key={`full-${result.id}`}>
            <div>
              <h3>{result.platform}</h3>
              <p>{result.url}</p>
              <p>{result.cleanupHint}</p>
            </div>
            <span className="risk-badge" data-risk={result.riskLevel}>
              {labels.risk[result.riskLevel]}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function downloadHtmlReport(summary: ScanSummary, results: ScanResult[]) {
  const labels = {
    category: categoryLabelsByLocale.ko,
    country: countryLabelsByLocale.ko,
    risk: riskLabelsByLocale.ko
  };
  const rows = results
    .map(
      (result) => `<tr>
        <td>${escapeHtml(result.platform)}</td>
        <td>${escapeHtml(result.url)}</td>
        <td>${escapeHtml(labels.category[result.category])}</td>
        <td>${escapeHtml(labels.country[result.country] ?? result.country)}</td>
        <td>${escapeHtml(labels.risk[result.riskLevel])}</td>
        <td>${escapeHtml(result.cleanupHint)}</td>
      </tr>`
    )
    .join("");
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(summary.username)} ID 도플갱어 리포트</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #191f28; line-height: 1.6; margin: 32px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #e5e8eb; padding: 10px; text-align: left; vertical-align: top; }
    th { background: #f7f8fa; }
  </style>
</head>
<body>
  <h1>${escapeHtml(summary.username)} ID 도플갱어 리포트</h1>
  <p>공개 흔적 ${summary.foundCount}개 · 희소성 ${summary.rarityScore}점 · 노출도 ${summary.exposureScore}점</p>
  <p>이 결과는 아이디 문자열의 공개 사용 현황이며, 발견된 계정들이 동일인이라는 뜻은 아니에요.</p>
  <table>
    <thead>
      <tr><th>플랫폼</th><th>URL</th><th>카테고리</th><th>국가</th><th>위험도</th><th>조치 가이드</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `id-doppelganger-${summary.username}.html`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatCount(value: number, locale: Locale) {
  return locale === "en" ? `${value} ${value === 1 ? "item" : "items"}` : `${value}개`;
}

function formatScore(value: number, locale: Locale) {
  return locale === "en" ? `${value} pts` : `${value}점`;
}

function buildShareSummary(summary: ScanSummary, locale: Locale) {
  const origin = window.location.origin;

  if (locale === "en") {
    return [
      `${summary.username}: ${summary.foundCount} public username traces`,
      `${summary.previewResults.length} shown · ${Math.max(0, summary.foundCount - summary.previewResults.length)} detailed URLs locked`,
      "Found accounts are not claimed to belong to the same person.",
      `Check your username at ${origin}.`
    ].join("\n");
  }

  return [
    `${summary.username} 공개 흔적 ${summary.foundCount}개`,
    `먼저 열린 결과 ${summary.previewResults.length}개 · 잠긴 상세 URL ${Math.max(0, summary.foundCount - summary.previewResults.length)}개`,
    "발견된 계정들이 동일인이라는 뜻은 아니에요.",
    `${origin}에서 내 아이디도 점검해보세요.`
  ].join("\n");
}

function copyTextFallback(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Copy command failed");
  }
}

function maigretReportUrlFor(detailAccess: DetailAccessState) {
  if (!detailAccess.maigretReportAvailable) return null;

  const accessQuery = reportAccessQueryFor(detailAccess);
  if (!accessQuery) return null;

  return `/api/scans/${detailAccess.scanId}/source-report.html?${accessQuery}`;
}

function reportAccessQueryFor(detailAccess: DetailAccessState) {
  const params = new URLSearchParams();
  if (detailAccess.reportToken) params.set("token", detailAccess.reportToken);
  if (detailAccess.adminToken) params.set("adminToken", detailAccess.adminToken);
  return params.toString();
}

function hostnameFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function platformBrandKey(result: ScanResult) {
  const haystack = `${result.platform} ${result.url} ${result.platformUrl ?? ""}`.toLowerCase();
  return platformBrandRules.find(([pattern]) => haystack.includes(pattern))?.[1] ?? "generic";
}

function maskUrlPreview(value: string, copy: ScanExperienceCopy) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./, "");
    const pathPart = parsed.pathname.split("/").filter(Boolean)[0] ?? "profile";
    const visiblePrefix = pathPart.slice(0, Math.min(4, pathPart.length));
    return `${host}/${visiblePrefix}${"•".repeat(Math.max(4, Math.min(8, pathPart.length)))}`;
  } catch {
    return copy.preview.lockedUrlFallback;
  }
}

async function loadDevAdminResults(scanId: string, adminToken: string, copy: ScanExperienceCopy): Promise<DetailAccessState> {
  const response = await fetch(`/api/scans/${scanId}/results?access=full`, {
    headers: devAdminHeaders(adminToken)
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body?.error?.message ?? "어드민 전체 결과를 불러오지 못했어요.");
  }

  return {
    ...(body as ResultsResponse),
    label: copy.detailLabels.adminFull,
    description: copy.detailLabels.adminFullDescription,
    adminToken
  };
}

async function loadFirstFreeOrPreviewResults(summary: ScanSummary, copy: ScanExperienceCopy): Promise<DetailAccessState> {
  const scanId = summary.scanId;
  const ownerToken = window.localStorage.getItem(freeDetailOwnerTokenKey);
  const usedScanId = window.localStorage.getItem(freeDetailUsedScanIdKey);

  if (ownerToken && usedScanId && usedScanId !== scanId) {
    return loadPreviewResults(
      scanId,
      copy.detailLabels.freePreview,
      copy.detailLabels.lockedUrl
    );
  }

  const freeResponse = await fetch(`/api/scans/${scanId}/free-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerToken, soft: true })
  });
  const freeBody = await freeResponse.json().catch(() => null);

  if (freeResponse.ok && freeBody?.reportToken) {
    window.localStorage.setItem(freeDetailOwnerTokenKey, freeBody.ownerToken);
    window.localStorage.setItem(freeDetailUsedScanIdKey, scanId);
    const fullResponse = await fetch(`/api/scans/${scanId}/results?access=full&token=${encodeURIComponent(freeBody.reportToken)}`);
    const fullBody = await fullResponse.json();

    if (!fullResponse.ok) {
      throw new Error(fullBody?.error?.message ?? "무료 상세 결과를 불러오지 못했어요.");
    }

    return {
      ...(fullBody as ResultsResponse),
      label: freeBody.reused ? copy.detailLabels.freeDetailAgain : copy.detailLabels.freeDetail,
      description: copy.detailLabels.fullOpen,
      reportToken: freeBody.reportToken
    };
  }

  if (freeBody?.error?.code === "FIRST_FREE_USED") {
    window.localStorage.setItem(freeDetailUsedScanIdKey, scanId);
  }

  if (freeBody?.error?.code === "WEB_PAYWALL_ENABLED") {
    return loadPreviewResults(
      scanId,
      copy.detailLabels.paywallPreview,
      freeBody?.error?.message ?? copy.detailLabels.lockedUrl
    );
  }

  return loadPreviewResults(
    scanId,
    copy.detailLabels.freePreview,
    freeBody?.error?.message ?? copy.detailLabels.lockedUrl
  );
}

async function loadPreviewResults(scanId: string, label: string, description: string): Promise<DetailAccessState> {
  const previewResponse = await fetch(`/api/scans/${scanId}/results`);
  const previewBody = await previewResponse.json();

  if (!previewResponse.ok) {
    throw new Error(previewBody?.error?.message ?? "무료 미리보기를 불러오지 못했어요.");
  }

  return {
    ...(previewBody as ResultsResponse),
    label,
    description
  };
}

function previewAccessFromSummary(summary: ScanSummary, copy: ScanExperienceCopy): DetailAccessState {
  return {
    scanId: summary.scanId,
    access: "PREVIEW",
    lockedCount: Math.max(0, summary.foundCount - summary.previewResults.length),
    lockedResults: summary.lockedResults ?? [],
    maigretReportAvailable: summary.maigretReportAvailable,
    maigretReportFilename: summary.maigretReportFilename,
    results: summary.previewResults,
    label: copy.detailLabels.freePreview,
    description: copy.detailLabels.lockedUrl
  };
}

function devAdminHeaders(token: string | null | undefined): Record<string, string> {
  return token ? { "x-dev-admin-token": token } : {};
}

function DevAdminPanel({
  copy,
  isActive,
  message,
  onLogin,
  onLogout,
  password,
  setPassword,
  setUsername,
  username
}: {
  copy: ScanExperienceCopy;
  isActive: boolean;
  message: string | null;
  onLogin: () => void;
  onLogout: () => void;
  password: string;
  setPassword: (value: string) => void;
  setUsername: (value: string) => void;
  username: string;
}) {
  if (isActive) {
    return (
      <div className="dev-admin-card" role="status">
        <div>
          <strong>{copy.devAdmin.activeTitle}</strong>
          <span>{copy.devAdmin.activeDescription}</span>
          {message ? <span>{message}</span> : null}
        </div>
        <button className="ghost-button" type="button" onClick={onLogout}>
          {copy.devAdmin.logout}
        </button>
      </div>
    );
  }

  return (
    <div className="dev-admin-card">
      <div>
        <strong>{copy.devAdmin.loginTitle}</strong>
        <span>{copy.devAdmin.defaultAccount}</span>
        {message ? <span role="alert">{message}</span> : null}
      </div>
      <div className="dev-admin-fields">
        <input
          aria-label={copy.devAdmin.usernameLabel}
          className="id-input"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
        />
        <input
          aria-label={copy.devAdmin.passwordLabel}
          className="id-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onLogin();
          }}
          type="password"
          autoComplete="current-password"
          placeholder={copy.devAdmin.passwordPlaceholder}
        />
        <button className="secondary-button" type="button" onClick={onLogin}>
          {copy.devAdmin.login}
        </button>
      </div>
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getUsernameValidationMessage(value: string, locale: Locale) {
  if (!value.trim()) return null;

  try {
    normalizeUsername(value);
    return null;
  } catch (error) {
    if (!(error instanceof Error)) {
      return locale === "en" ? "Check the username again." : "아이디를 다시 확인해 주세요.";
    }

    if (locale === "ko") return error.message;

    const englishMessages: Record<string, string> = {
      "아이디를 입력해 주세요.": "Enter a username.",
      "아이디는 3자 이상 30자 이하로 입력해 주세요.": "Use 3 to 30 characters.",
      "아이디에는 영문, 숫자, 점, 밑줄, 하이픈만 사용할 수 있어요.": "Use letters, numbers, dots, underscores, or hyphens only.",
      "이메일 검색은 지원하지 않아요.": "Email searches are not supported.",
      "전화번호 검색은 지원하지 않아요.": "Phone number searches are not supported.",
      "주민번호처럼 보이는 값은 검색할 수 없어요.": "Government ID-like values cannot be searched.",
      "URL 검색은 지원하지 않아요.": "URL searches are not supported."
    };

    return englishMessages[error.message] ?? "Check the username again.";
  }
}

function MonitoringLatestScans({
  copy,
  locale,
  monitoring,
  onOpenScan
}: {
  copy: ScanExperienceCopy;
  locale: Locale;
  monitoring: PublicMonitoringSubscription;
  onOpenScan: (scanId: string) => void;
}) {
  const latestScans = monitoring.latestScans ?? [];

  return (
    <div className="mini-card monitoring-latest-card">
      <p>{copy.monitoring.latestResults}</p>
      {latestScans.length > 0 ? (
        <div className="monitoring-latest-list">
          {latestScans.map((scan) => (
            <button className="monitoring-latest-row" key={scan.scanId} type="button" onClick={() => onOpenScan(scan.scanId)}>
              <span>
                <strong>{scan.username}</strong>
                <small>
                  {new Date(scan.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "ko-KR")} · {copy.monitoring.latestMeta(scan.foundCount, scan.exposureScore)}
                </small>
              </span>
              <span>
                {copy.monitoring.openLatestResult(scan.username)}
                <ExternalLink size={14} aria-hidden />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <span className="monitoring-latest-empty">{copy.monitoring.latestResultsEmpty}</span>
      )}
    </div>
  );
}

function PricingCard({
  actionLabel,
  badgeLabel,
  title,
  price,
  items,
  featured = false
}: {
  actionLabel: string;
  badgeLabel?: string;
  title: string;
  price: string;
  items: string[];
  featured?: boolean;
}) {
  return (
    <article className="pricing-card" data-featured={featured ? "true" : "false"}>
      <div className="pricing-card-title-row">
        <h3>{title}</h3>
        {badgeLabel ? <span className="pricing-card-badge">{badgeLabel}</span> : null}
      </div>
      <strong style={{ display: "block", margin: "10px 0", fontSize: 28 }}>{price}</strong>
      <ul className="guide-list">
        {items.map((item) => (
          <li key={item}>
            <span>{item}</span>
            {item.includes("다운로드") ? <Download size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
          </li>
        ))}
      </ul>
      <span className="pricing-card-action">{actionLabel}</span>
    </article>
  );
}
