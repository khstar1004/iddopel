"use client";

import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileText,
  GitBranch,
  Layers3,
  ListChecks,
  LockKeyhole,
  MapPinned,
  ShieldAlert,
  Target,
  UserRound
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { categoryLabels, countryLabels, riskLabels } from "@/lib/labels";
import type { PlatformCategory, RiskLevel, ScanPurpose, ScanResult } from "@/lib/types";
import { BrandIcon } from "./BrandIcon";

interface FullReportSummary {
  username: string;
  purpose: ScanPurpose;
  mode: "QUICK" | "DEEP";
  foundCount: number;
  checkedCount: number;
  failedRate: number;
  doppelgangerScore: number;
  rarityScore: number;
  exposureScore: number;
  impersonationScore: number;
  cleanupScore: number;
  countryDistribution: Record<string, number>;
  categoryDistribution: Record<string, number>;
  createdAt: string;
  finishedAt: string | null;
}

interface FullReportResponse {
  scanId: string;
  access: "FULL";
  summary?: FullReportSummary;
  lockedCount: number;
  maigretReportAvailable?: boolean;
  maigretReportFilename?: string;
  results: ScanResult[];
}

interface DistributionRow {
  key: string;
  label: string;
  value: number;
  percent: number;
}

interface ActionPlanStep {
  description: string;
  label: string;
  phase: string;
  results: ScanResult[];
}

interface PlatformMapRow {
  category: PlatformCategory;
  label: string;
  platforms: string[];
  riskLevel: RiskLevel;
}

interface MonthlyDigestSignal {
  detail: string;
  label: string;
  value: string;
}

const riskOrder: RiskLevel[] = ["HIGH", "MEDIUM", "LOW"];
const riskWeight: Record<RiskLevel, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

export function ReportPageClient() {
  const params = useParams<{ scanId: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const adminToken = searchParams.get("adminToken") ?? "";
  const [report, setReport] = useState<FullReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [briefingCopied, setBriefingCopied] = useState(false);
  const accessQuery = token
    ? `token=${encodeURIComponent(token)}`
    : adminToken
      ? `adminToken=${encodeURIComponent(adminToken)}`
      : "";

  useEffect(() => {
    fetch(`/api/scans/${params.scanId}/results?access=full${accessQuery ? `&${accessQuery}` : ""}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error?.message ?? "정밀 리포트를 불러오지 못했어요.");
        setReport(body as FullReportResponse);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "정밀 리포트를 불러오지 못했어요."));
  }, [accessQuery, params.scanId]);

  if (error) {
    return (
      <ReportShell>
        <section className="panel" style={{ maxWidth: 720, margin: "40px auto" }}>
          <LockKeyhole size={32} aria-hidden />
          <h1>정밀 리포트 접근이 필요해요</h1>
          <p style={{ color: "#6b7684" }}>{error}</p>
          <Link className="primary-button" href="/">
            다시 점검하기
          </Link>
        </section>
      </ReportShell>
    );
  }

  if (!report) {
    return (
      <ReportShell>
        <section className="panel" style={{ maxWidth: 720, margin: "40px auto" }}>
          <h1>정밀 리포트를 불러오고 있어요</h1>
          <p style={{ color: "#6b7684" }}>결제 권한과 전체 결과를 확인하고 있어요.</p>
        </section>
      </ReportShell>
    );
  }

  const sourceReportUrl =
    report.maigretReportAvailable && accessQuery
      ? `/api/scans/${params.scanId}/source-report.html?${accessQuery}`
      : null;
  const htmlReportUrl = `/api/scans/${params.scanId}/report.html?${accessQuery ? `${accessQuery}&` : ""}embed=1`;
  const downloadableHtmlReportUrl = `/api/scans/${params.scanId}/report.html${accessQuery ? `?${accessQuery}` : ""}`;
  const pdfReportUrl = `/api/scans/${params.scanId}/report.pdf${accessQuery ? `?${accessQuery}` : ""}`;
  const embeddedReportUrl = sourceReportUrl ?? htmlReportUrl;
  const embeddedReportTitle = sourceReportUrl ? "원본 HTML 리포트" : "HTML 리포트";
  const insight = buildPaidReportInsight(report);
  const briefingText = buildExecutiveBriefing(report, insight);
  const evidencePacket = buildEvidencePacket(report);

  async function copyBriefing() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(briefingText);
    } catch {
      copyTextFallback(briefingText);
    }
    setBriefingCopied(true);
    window.setTimeout(() => setBriefingCopied(false), 1800);
  }

  function downloadEvidencePacket(format: "csv" | "json") {
    const baseFilename = safeFilename(`${evidencePacket.username}-id-evidence-packet`);

    if (format === "json") {
      downloadTextFile(
        `${baseFilename}.json`,
        JSON.stringify(evidencePacket, null, 2),
        "application/json;charset=utf-8"
      );
      return;
    }

    downloadTextFile(
      `${baseFilename}.csv`,
      evidencePacketToCsv(evidencePacket.results),
      "text/csv;charset=utf-8"
    );
  }

  return (
    <ReportShell>
      <section className="section light-section">
        <div className="container">
          <div className="section-header report-hero">
            <div>
              <h1>정밀 리포트</h1>
              <p>플랫폼, URL, 위험도, 조치 가이드만 간결하게 정리했습니다. 동일인 여부는 단정하지 않아요.</p>
            </div>
            <div className="report-count-strip" aria-label="정밀 리포트 결과 요약">
              <span>
                발견
                <strong>{insight.foundCount}개</strong>
              </span>
              <span>
                검사
                <strong>{insight.checkedCount}곳</strong>
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {sourceReportUrl ? (
                <a className="secondary-button" href={sourceReportUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={16} aria-hidden />
                  HTML 보기
                </a>
              ) : null}
              <a className="primary-button" href={pdfReportUrl}>
                <Download size={16} aria-hidden />
                PDF 다운로드
              </a>
              <a className="secondary-button" href={downloadableHtmlReportUrl}>
                <Download size={16} aria-hidden />
                HTML 다운로드
              </a>
            </div>
          </div>
          <PaidInsightBoard
            briefingCopied={briefingCopied}
            onDownloadEvidence={downloadEvidencePacket}
            onCopyBriefing={copyBriefing}
            report={report}
            sourceReportUrl={sourceReportUrl}
          />
          <div className="analysis-section report-result-heading">
            <div>
              <span className="source-badge" data-source="PUBLIC_SCAN">전체 결과</span>
              <h2>발견된 플랫폼</h2>
              <p>실제 URL과 정리 가이드를 한 화면에서 확인하세요.</p>
            </div>
          </div>
          <div className="result-list">
            {report.results.map((result) => (
              <RichReportResultCard key={result.id} result={result} />
            ))}
          </div>
          {embeddedReportUrl ? (
            <section className="panel source-report-panel report-preview-panel" aria-labelledby="report-page-source-title">
              <div className="source-report-launch">
                <div>
                  <h2 id="report-page-source-title">{embeddedReportTitle}</h2>
                  <p>
                    {sourceReportUrl
                      ? "원본 HTML을 확인할 수 있어요."
                      : "HTML 리포트를 바로 확인할 수 있어요."}
                  </p>
                </div>
                <div className="source-report-actions">
                  <a className="secondary-button" href={embeddedReportUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={16} aria-hidden />
                    새 탭으로 보기
                  </a>
                  <a className="ghost-button" download={report.maigretReportFilename} href={downloadableHtmlReportUrl}>
                    <Download size={16} aria-hidden />
                    HTML 저장
                  </a>
                </div>
              </div>
              <div className="source-report-peek">
                <iframe className="source-report-frame" title="HTML 리포트 미리보기" src={embeddedReportUrl} loading="lazy" />
                <div className="source-report-mosaic" aria-hidden>
                  {Array.from({ length: 16 }).map((_, index) => (
                    <span key={index} />
                  ))}
                </div>
                <div className="source-report-fade">
                  <strong>상단만 미리보기</strong>
                  <span>전체 HTML은 새 탭이나 저장 파일에서 확인하세요.</span>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </ReportShell>
  );
}

function PaidInsightBoard({
  briefingCopied,
  onDownloadEvidence,
  onCopyBriefing,
  report,
  sourceReportUrl
}: {
  briefingCopied: boolean;
  onDownloadEvidence: (format: "csv" | "json") => void;
  onCopyBriefing: () => void;
  report: FullReportResponse;
  sourceReportUrl: string | null;
}) {
  const insight = buildPaidReportInsight(report);

  return (
    <section className="paid-insight-board" aria-labelledby="paid-insight-title">
      <div className="paid-insight-lede">
        <div className="paid-insight-icon" aria-hidden>
          <ShieldAlert size={22} />
        </div>
        <div>
          <h2 id="paid-insight-title">정밀 요약</h2>
          <p>{insight.headline}</p>
        </div>
      </div>

      <div className="paid-briefing-panel">
        <div>
          <span className="paid-panel-kicker">Briefing</span>
          <h3>공유 브리핑</h3>
          <p>{insight.executiveSummary}</p>
        </div>
        <button className="secondary-button paid-copy-button" type="button" onClick={onCopyBriefing}>
          <ClipboardCheck size={16} aria-hidden />
          {briefingCopied ? "복사됨" : "브리핑 복사"}
        </button>
      </div>

      <div className="paid-monthly-digest-panel" aria-label="월간 추적 요약">
        <div className="paid-monthly-digest-copy">
          <span className="paid-panel-kicker">Monthly</span>
          <h3>월간 추적 요약</h3>
          <p>
            지금은 대시보드에서 월간 재점검 기록을 확인하는 구조입니다. 이 요약은 유료 사용자가
            매월 확인해야 할 변화 신호를 이메일형 문장으로 정리해, 이후 실제 메일 발송 기능에도
            그대로 재사용할 수 있게 만들었습니다.
          </p>
        </div>
        <div className="paid-monthly-digest-grid" role="list">
          {insight.monthlyDigest.map((signal) => (
            <article className="paid-monthly-digest-card" key={signal.label} role="listitem">
              <span>{signal.label}</span>
              <strong>{signal.value}</strong>
              <p>{signal.detail}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="paid-evidence-packet-panel" aria-label="증거 내보내기">
        <div>
          <span className="paid-panel-kicker">Evidence</span>
          <h3>증거 내보내기</h3>
          <p>
            플랫폼, URL, 위험도, 조치 가이드를 구조화된 파일로 저장합니다. 정리 전후 비교,
            고객센터 문의, 팀 공유에 바로 쓸 수 있는 유료 전용 내보내기입니다.
          </p>
        </div>
        <div className="paid-evidence-packet-actions">
          <button className="secondary-button" type="button" onClick={() => onDownloadEvidence("json")}>
            <Download size={16} aria-hidden />
            JSON 다운로드
          </button>
          <button className="ghost-button" type="button" onClick={() => onDownloadEvidence("csv")}>
            <FileText size={16} aria-hidden />
            CSV 다운로드
          </button>
        </div>
      </div>

      <div className="paid-score-grid" aria-label="정밀 점수">
        <ScoreTile label="노출도" value={insight.exposureScore} tone={insight.exposureScore >= 70 ? "high" : "medium"} />
        <ScoreTile label="사칭 가능성" value={insight.impersonationScore} tone={insight.impersonationScore >= 70 ? "high" : "medium"} />
        <ScoreTile label="정리 필요" value={insight.cleanupScore} tone={insight.cleanupScore >= 70 ? "high" : "medium"} />
        <ScoreTile label="희소성" value={insight.rarityScore} tone={insight.rarityScore >= 70 ? "low" : "medium"} />
      </div>

      <div className="paid-analysis-grid">
        <section className="paid-analysis-panel" aria-labelledby="risk-distribution-title">
          <div className="paid-panel-title">
            <BarChart3 size={18} aria-hidden />
            <h3 id="risk-distribution-title">위험도 분포</h3>
          </div>
          <div className="risk-stack" role="list">
            {riskOrder.map((risk) => (
              <div className="risk-stack-row" key={risk} role="listitem">
                <span className="risk-badge" data-risk={risk}>{riskLabels[risk]}</span>
                <div className="risk-stack-track" aria-hidden>
                  <span style={{ width: `${insight.riskPercents[risk]}%` }} />
                </div>
                <strong>{insight.riskCounts[risk]}개</strong>
              </div>
            ))}
          </div>
        </section>

        <DistributionPanel icon={<Layers3 size={18} aria-hidden />} title="유형" rows={insight.categoryRows} />
        <DistributionPanel icon={<MapPinned size={18} aria-hidden />} title="지역" rows={insight.countryRows} />

        <section className="paid-analysis-panel paid-action-panel" aria-labelledby="paid-action-title">
          <div className="paid-panel-title">
            <ListChecks size={18} aria-hidden />
            <h3 id="paid-action-title">먼저 볼 결과</h3>
          </div>
          <ol className="paid-action-list">
            {insight.priorityResults.map((result) => (
              <li key={`priority-${result.id}`}>
                <strong>{result.platform}</strong>
                <span>{riskLabels[result.riskLevel]} · {hostnameFromUrl(result.url) || result.url}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="paid-plan-grid">
        <section className="paid-analysis-panel paid-roadmap-panel" aria-labelledby="paid-roadmap-title">
          <div className="paid-panel-title">
            <CalendarDays size={18} aria-hidden />
            <h3 id="paid-roadmap-title">7일 플랜</h3>
          </div>
          <div className="paid-roadmap-list">
            {insight.actionPlan.map((step) => (
              <article className="paid-roadmap-step" key={step.phase}>
                <span>{step.phase}</span>
                <strong>{step.label}</strong>
                <p>{step.description}</p>
                {step.results.length > 0 ? (
                  <div>
                    {step.results.map((result) => (
                      <small key={`${step.phase}-${result.id}`}>{result.platform}</small>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="paid-analysis-panel paid-reuse-panel" aria-labelledby="paid-reuse-title">
          <div className="paid-panel-title">
            <GitBranch size={18} aria-hidden />
            <h3 id="paid-reuse-title">재사용 지도</h3>
          </div>
          <div className="paid-reuse-map">
            {insight.platformMap.map((row) => (
              <div className="paid-reuse-row" data-risk={row.riskLevel} key={row.category}>
                <div>
                  <strong>{row.label}</strong>
                  <span>{row.platforms.length}개 플랫폼</span>
                </div>
                <p>{row.platforms.join(" · ")}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="paid-evidence-strip">
        <div>
          <FileText size={18} aria-hidden />
          <span>{sourceReportUrl ? "원본 스캔 HTML 포함" : "정리된 HTML 리포트 포함"}</span>
        </div>
        <div>
          <ExternalLink size={18} aria-hidden />
          <span>전체 URL {report.results.length}개 열람 가능</span>
        </div>
        <div>
          <Target size={18} aria-hidden />
          <span>7일 실행 플랜 포함</span>
        </div>
      </div>
    </section>
  );
}

function ScoreTile({ label, tone, value }: { label: string; tone: "high" | "medium" | "low"; value: number }) {
  return (
    <div className="paid-score-tile" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DistributionPanel({ icon, rows, title }: { icon: React.ReactNode; rows: DistributionRow[]; title: string }) {
  const titleId = `distribution-${title.replace(/[^a-zA-Z0-9가-힣]/g, "-")}`;

  return (
    <section className="paid-analysis-panel" aria-labelledby={titleId}>
      <div className="paid-panel-title">
        {icon}
        <h3 id={titleId}>{title}</h3>
      </div>
      <div className="distribution-bars">
        {rows.length > 0 ? rows.map((row) => (
          <div className="distribution-bar-row" key={`${title}-${row.key}`}>
            <div>
              <span>{row.label}</span>
              <strong>{row.value}개</strong>
            </div>
            <div className="distribution-bar-track" aria-hidden>
              <span style={{ width: `${row.percent}%` }} />
            </div>
          </div>
        )) : (
          <p className="paid-empty-note">분포 데이터가 아직 없어요.</p>
        )}
      </div>
    </section>
  );
}

function RichReportResultCard({ result }: { result: ScanResult }) {
  const host = hostnameFromUrl(result.url);
  const visibleTags = (result.tags ?? []).slice(0, 4);

  return (
    <article className="rich-result-card">
      <div className="result-card-media">
        <PlatformIcon result={result} />
        <ResultProfileImage result={result} />
      </div>
      <div className="result-card-body">
        <div className="result-card-title-row">
          <div>
            <h2>{result.platform}</h2>
            <p>
              {categoryLabels[result.category]} · {countryLabels[result.country] ?? result.country}
              {host ? ` · ${host}` : ""}
            </p>
          </div>
          <span className="risk-badge" data-risk={result.riskLevel}>
            {riskLabels[result.riskLevel]}
          </span>
        </div>
        {visibleTags.length > 0 || result.rank || result.httpStatus ? (
          <div className="result-card-meta" aria-label={`${result.platform} 메타데이터`}>
            {result.rank ? <span>Rank {result.rank}</span> : null}
            {result.httpStatus ? <span>HTTP {result.httpStatus}</span> : null}
            {visibleTags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        ) : null}
        {result.evidenceTitle || result.evidenceDescription ? (
          <div className="result-evidence-summary">
            {result.evidenceTitle ? <strong>{result.evidenceTitle}</strong> : null}
            {result.evidenceDescription ? <span>{result.evidenceDescription}</span> : null}
          </div>
        ) : null}
        <a className="result-link" href={result.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} aria-hidden />
          <span>{result.url}</span>
        </a>
        <p className="cleanup-hint">{result.cleanupHint}</p>
      </div>
    </article>
  );
}

function PlatformIcon({ result }: { result: ScanResult }) {
  const [isBroken, setIsBroken] = useState(false);
  const initial = result.platform.slice(0, 1).toUpperCase();

  return (
    <div className="platform-icon-shell" aria-hidden>
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
  const imageUrl = result.profileImageUrl ?? result.evidenceImageUrl;

  return (
    <div className="profile-thumb" aria-hidden>
      {imageUrl && !isBroken ? (
        <img alt="" src={imageUrl} onError={() => setIsBroken(true)} />
      ) : (
        <UserRound size={34} strokeWidth={1.8} />
      )}
    </div>
  );
}

function hostnameFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function buildPaidReportInsight(report: FullReportResponse) {
  const summary = report.summary;
  const foundCount = summary?.foundCount ?? report.results.length;
  const checkedCount = summary?.checkedCount ?? report.results.length;
  const riskCounts = countByRisk(report.results);
  const riskPercents = Object.fromEntries(
    riskOrder.map((risk) => [risk, percent(riskCounts[risk], Math.max(1, report.results.length))])
  ) as Record<RiskLevel, number>;
  const categoryRows = distributionRows(
    countBy(report.results.map((result) => result.category)),
    report.results.length,
    (key) => categoryLabels[key as PlatformCategory] ?? key
  );
  const countryRows = distributionRows(
    countBy(report.results.map((result) => result.country)),
    report.results.length,
    (key) => countryLabels[key] ?? key
  );
  const priorityResults = [...report.results]
    .sort((left, right) => {
      if (riskWeight[left.riskLevel] !== riskWeight[right.riskLevel]) {
        return riskWeight[right.riskLevel] - riskWeight[left.riskLevel];
      }
      return left.platform.localeCompare(right.platform);
    })
    .slice(0, 4);
  const highOrReviewCount = riskCounts.HIGH + riskCounts.MEDIUM;
  const surfacePercent = percent(foundCount, Math.max(1, checkedCount));
  const platformMap = buildPlatformMap(report.results);
  const actionPlan = buildActionPlan(report.results);
  const headline = highOrReviewCount > 0
    ? `${checkedCount}곳 중 ${foundCount}개 흔적을 찾았고, ${highOrReviewCount}개는 먼저 정리할 후보예요.`
    : `${checkedCount}곳 중 ${foundCount}개 흔적을 찾았고, 현재 높은 위험 표시는 없어요.`;
  const executiveSummary = highOrReviewCount > 0
    ? `가장 먼저 볼 영역은 ${priorityResults.slice(0, 2).map((result) => result.platform).join(", ")}입니다. 공개 URL 확인, 프로필 소개 정리, 외부 링크 제거 순서로 처리하세요.`
    : "전체 결과를 보존해 두고, 프로필 소개와 외부 링크처럼 빠르게 바꿀 수 있는 항목부터 점검하세요.";

  return {
    foundCount,
    checkedCount,
    exposureScore: summary?.exposureScore ?? Math.min(99, Math.max(5, surfacePercent)),
    impersonationScore: summary?.impersonationScore ?? Math.min(99, riskCounts.HIGH * 18 + riskCounts.MEDIUM * 8),
    cleanupScore: summary?.cleanupScore ?? Math.min(99, highOrReviewCount * 14),
    rarityScore: summary?.rarityScore ?? Math.max(5, 100 - surfacePercent),
    headline,
    riskCounts,
    riskPercents,
    categoryRows,
    countryRows,
    priorityResults,
    platformMap,
    actionPlan,
    executiveSummary,
    monthlyDigest: buildMonthlyDigest(report.results, exposureScoreFromSummary(summary, surfacePercent), riskCounts.HIGH)
  };
}

function buildMonthlyDigest(results: ScanResult[], riskScore: number, highRiskCount: number): MonthlyDigestSignal[] {
  const foundCount = results.length;
  const platformCount = new Set(results.map((result) => result.platform)).size;
  const reviewCount = Math.min(foundCount, Math.max(3, highRiskCount || 1));
  const topRisk = highestRisk(results);

  return [
    {
      label: "이번 달 발견",
      value: `${foundCount}개`,
      detail:
        foundCount > 0
          ? `${platformCount}개 플랫폼에서 공개 아이디 흔적이 확인됐습니다.`
          : "이번 달 새로 확인된 공개 흔적은 없습니다."
    },
    {
      label: "우선 조치",
      value: `${reviewCount}개`,
      detail:
        highRiskCount > 0
          ? "주의 등급 항목부터 공개 범위, 소개 문구, 외부 링크를 정리하세요."
          : "높은 위험이 없어도 오래된 프로필과 중복 핸들은 정리 후보입니다."
    },
    {
      label: "다음 비교 기준",
      value: `${riskScore}점`,
      detail: `${riskLabels[topRisk]} 기준으로 다음 월간 재점검 때 위험도 변화를 비교합니다.`
    }
  ];
}

function exposureScoreFromSummary(summary: FullReportSummary | undefined, fallback: number) {
  return summary?.exposureScore ?? Math.min(99, Math.max(5, fallback));
}

function buildEvidencePacket(report: FullReportResponse) {
  const username = report.summary?.username ?? report.scanId;

  return {
    generatedAt: new Date().toISOString(),
    scanId: report.scanId,
    username,
    access: "paid-report",
    summary: {
      foundCount: report.summary?.foundCount ?? report.results.length,
      checkedCount: report.summary?.checkedCount ?? report.results.length,
      doppelgangerScore: report.summary?.doppelgangerScore ?? null,
      exposureScore: report.summary?.exposureScore ?? null,
      impersonationScore: report.summary?.impersonationScore ?? null,
      cleanupScore: report.summary?.cleanupScore ?? null
    },
    results: report.results.map((result) => ({
      platform: result.platform,
      url: result.url,
      category: categoryLabels[result.category] ?? result.category,
      country: countryLabels[result.country] ?? result.country,
      status: result.status,
      riskLevel: riskLabels[result.riskLevel],
      cleanupHint: result.cleanupHint,
      evidence: hostnameFromUrl(result.url) || result.url,
      tags: result.tags ?? []
    }))
  };
}

function evidencePacketToCsv(results: ReturnType<typeof buildEvidencePacket>["results"]) {
  const header = ["platform", "url", "category", "country", "status", "riskLevel", "cleanupHint", "evidence", "tags"];
  const rows = results.map((result) => [
    result.platform,
    result.url,
    result.category,
    result.country,
    result.status,
    result.riskLevel,
    result.cleanupHint,
    result.evidence,
    result.tags.join("|")
  ]);

  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function downloadTextFile(filename: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function safeFilename(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9가-힣._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "id-doppelganger-evidence-packet";
}

function countByRisk(results: ScanResult[]): Record<RiskLevel, number> {
  return {
    HIGH: results.filter((result) => result.riskLevel === "HIGH").length,
    MEDIUM: results.filter((result) => result.riskLevel === "MEDIUM").length,
    LOW: results.filter((result) => result.riskLevel === "LOW").length
  };
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}

function distributionRows(values: Record<string, number>, total: number, labelFor: (key: string) => string): DistributionRow[] {
  return Object.entries(values)
    .map(([key, value]) => ({
      key,
      label: labelFor(key),
      value,
      percent: percent(value, Math.max(1, total))
    }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
    .slice(0, 5);
}

function buildPlatformMap(results: ScanResult[]): PlatformMapRow[] {
  const grouped = results.reduce<Record<PlatformCategory, ScanResult[]>>((accumulator, result) => {
    accumulator[result.category] = [...(accumulator[result.category] ?? []), result];
    return accumulator;
  }, {} as Record<PlatformCategory, ScanResult[]>);

  return Object.entries(grouped)
    .map(([category, categoryResults]) => ({
      category: category as PlatformCategory,
      label: categoryLabels[category as PlatformCategory] ?? category,
      platforms: categoryResults.map((result) => result.platform).sort((left, right) => left.localeCompare(right)),
      riskLevel: highestRisk(categoryResults)
    }))
    .sort((left, right) => right.platforms.length - left.platforms.length || riskWeight[right.riskLevel] - riskWeight[left.riskLevel])
    .slice(0, 6);
}

function buildActionPlan(results: ScanResult[]): ActionPlanStep[] {
  const highRisk = results.filter((result) => result.riskLevel === "HIGH").slice(0, 3);
  const reviewRisk = results.filter((result) => result.riskLevel === "MEDIUM").slice(0, 3);
  const rest = results.filter((result) => result.riskLevel === "LOW").slice(0, 3);

  return [
    {
      phase: "Day 1",
      label: "공개 URL과 프로필 소개 정리",
      description: "주의 등급 플랫폼부터 프로필 소개, 외부 링크, 공개 활동 노출을 확인하세요.",
      results: highRisk
    },
    {
      phase: "Day 2-3",
      label: "브랜드/개인 아이디 분리",
      description: "업무용, 크리에이터용, 개인용으로 같은 아이디가 섞인 지점을 분리하세요.",
      results: reviewRisk
    },
    {
      phase: "Day 4-7",
      label: "증거 보관 후 재점검",
      description: "리포트를 저장하고 변경한 플랫폼을 다음 월간 재점검에서 비교하세요.",
      results: rest
    }
  ];
}

function highestRisk(results: ScanResult[]): RiskLevel {
  return results.reduce<RiskLevel>((highest, result) => {
    return riskWeight[result.riskLevel] > riskWeight[highest] ? result.riskLevel : highest;
  }, "LOW");
}

function buildExecutiveBriefing(report: FullReportResponse, insight: ReturnType<typeof buildPaidReportInsight>) {
  return [
    `[ID 도플갱어 정밀 리포트] ${report.summary?.username ?? report.scanId}`,
    `발견: ${insight.foundCount}개 / 검사: ${insight.checkedCount}곳`,
    `점수: 노출도 ${insight.exposureScore}, 사칭 가능성 ${insight.impersonationScore}, 정리 필요 ${insight.cleanupScore}, 희소성 ${insight.rarityScore}`,
    `우선 정리: ${insight.priorityResults.map((result) => `${result.platform}(${riskLabels[result.riskLevel]})`).join(", ") || "없음"}`,
    `7일 플랜: ${insight.actionPlan.map((step) => `${step.phase} ${step.label}`).join(" -> ")}`,
    "주의: 동일인 판정이 아니라 공개 아이디 사용 흔적 참고 자료입니다."
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
  document.execCommand("copy");
  textarea.remove();
}

function percent(value: number, total: number) {
  return Math.round((value / total) * 100);
}

function ReportShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="light-section brand-surface" style={{ minHeight: "100vh" }}>
      <header className="container topbar">
        <Link className="brand-mark" href="/" style={{ color: "#191f28" }}>
          <BrandIcon />
          <span>ID 도플갱어</span>
        </Link>
      </header>
      {children}
    </main>
  );
}
