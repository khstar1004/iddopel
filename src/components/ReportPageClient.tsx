"use client";

import { Download, ExternalLink, LockKeyhole, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { categoryLabels, countryLabels, riskLabels } from "@/lib/labels";
import type { ScanResult } from "@/lib/types";
import { BrandIcon } from "./BrandIcon";

interface FullReportResponse {
  scanId: string;
  access: "FULL";
  lockedCount: number;
  maigretReportAvailable?: boolean;
  maigretReportFilename?: string;
  results: ScanResult[];
}

export function ReportPageClient() {
  const params = useParams<{ scanId: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const adminToken = searchParams.get("adminToken") ?? "";
  const [report, setReport] = useState<FullReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  return (
    <ReportShell>
      <section className="section light-section">
        <div className="container">
          <div className="section-header report-hero">
            <div>
              <h1>정밀 리포트</h1>
              <p>발견 플랫폼, URL, 위험도, 조치 가이드를 먼저 확인하세요. 발견된 계정들이 동일인이라는 뜻은 아니에요.</p>
            </div>
            <div className="report-count-strip" aria-label="정밀 리포트 결과 요약">
              <span>
                공개 흔적
                <strong>{report.results.length}개</strong>
              </span>
              <span>
                잠긴 URL
                <strong>{report.lockedCount}개</strong>
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
                PDF 리포트 다운로드
              </a>
              <a className="secondary-button" href={downloadableHtmlReportUrl}>
                <Download size={16} aria-hidden />
                HTML 다운로드
              </a>
            </div>
          </div>
          <div className="analysis-section report-result-heading">
            <div>
              <span className="source-badge" data-source="PUBLIC_SCAN">전체 결과 열림</span>
              <h2>아이디가 남은 플랫폼</h2>
              <p>프로필 카드, 실제 URL, 정리 가이드를 한 화면에서 바로 확인할 수 있어요.</p>
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
                      ? "원본 카드 HTML을 바로 확인할 수 있어요."
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
              <iframe className="source-report-frame" title="HTML 리포트 미리보기" src={embeddedReportUrl} loading="lazy" />
            </section>
          ) : null}
        </div>
      </section>
    </ReportShell>
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

function hostnameFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
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
