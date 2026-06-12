"use client";

import { Check, CreditCard, LockKeyhole } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { categoryLabels, countryLabels, riskLabels } from "@/lib/labels";
import type { ScanResult, ScanSummary } from "@/lib/types";
import { normalizeUsername } from "@/lib/validation";
import { BrandIcon } from "./BrandIcon";
import { getOrCreateFreeScanOwnerToken } from "./client-tokens";
import { ScanEyeLoader } from "./ScanEyeLoader";

const platformBrandRules: Array<[string, string]> = [
  ["naver", "naver"],
  ["github", "github"],
  ["instagram", "instagram"],
  ["youtube", "youtube"],
  ["twitter", "twitter"],
  ["threads", "threads"],
  ["facebook", "facebook"],
  ["linkedin", "linkedin"],
  ["medium", "medium"]
];

export function TossMiniApp() {
  const [username, setUsername] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [showFullReport, setShowFullReport] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultPanelRef = useRef<HTMLElement>(null);
  const usernameValidationMessage = useMemo(() => getUsernameValidationMessage(username), [username]);
  const canSubmit = acknowledged && username.trim().length >= 3 && !usernameValidationMessage && !isLoading;

  useEffect(() => {
    if (!summary) return;
    window.setTimeout(() => {
      const panel = resultPanelRef.current;
      if (!panel) return;
      const top = Math.max(0, panel.getBoundingClientRect().top + window.scrollY - 10);
      window.scrollTo({ top, behavior: "auto" });
      panel.focus({ preventScroll: true });
    }, 40);
  }, [summary?.scanId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSummary(null);
    setShowFullReport(false);

    try {
      const normalizedUsername = normalizeUsername(username);
      const scanOwnerToken = getOrCreateFreeScanOwnerToken();
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-scan-owner-token": scanOwnerToken
        },
        body: JSON.stringify({ username: normalizedUsername, purpose: "SELF_CHECK", mode: "quick" })
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error?.message ?? "점검을 시작하지 못했어요.");
      }

      setSummary(body as ScanSummary);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "점검 중 문제가 발생했어요.");
    } finally {
      setIsLoading(false);
    }
  }

  async function startCheckout() {
    if (!summary) return;

    if (summary.fullResults) {
      setShowFullReport(true);
      window.setTimeout(() => resultPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
      return;
    }

    setIsOrdering(true);
    setError(null);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: summary.scanId, productId: "DETAILED_REPORT" })
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error?.message ?? "결제를 준비하지 못했어요.");
      }

      window.location.href = body.checkoutUrl;
    } catch (orderError) {
      setError(orderError instanceof Error ? orderError.message : "결제를 준비하지 못했어요.");
    } finally {
      setIsOrdering(false);
    }
  }

  const visibleResults = summary
    ? showFullReport && summary.fullResults
      ? summary.fullResults
      : summary.previewResults.slice(0, 3)
    : [];
  const hiddenCount = summary && !showFullReport ? Math.max(0, summary.foundCount - visibleResults.length) : 0;

  return (
    <main className="toss-shell">
      <div className="toss-frame">
        <header className="brand-mark toss-brand">
          <BrandIcon />
          <span>ID 도플갱어</span>
        </header>

        <section className="toss-hero">
          <h1 className="toss-title">내 아이디, 어디에 남아 있을까?</h1>
          <p className="toss-subtitle">자주 쓰는 아이디의 공개 흔적을 바로 확인하세요.</p>
        </section>

        <form className="toss-card" onSubmit={submit}>
          <div className="field-stack">
            <label htmlFor="toss-username">
              아이디
            </label>
            <input
              id="toss-username"
              className="id-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="아이디만 입력"
              maxLength={30}
            />
            {usernameValidationMessage ? (
              <p className="field-help" data-tone="error" role="alert">
                {usernameValidationMessage}
              </p>
            ) : null}
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span>정당한 목적으로 공개 아이디 사용 현황을 점검해요.</span>
          </label>

          {isLoading ? (
            <div className="scan-loading-card toss-loading-card" data-surface="light" role="status" aria-live="polite">
              <div className="scan-loading-copy">
                <ScanEyeLoader />
                <p>공개 흔적 찾는 중</p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="error-box" role="alert">
              {error}
            </div>
          ) : null}

          <button className="toss-button" disabled={!canSubmit} type="submit">
            {isLoading ? <ScanEyeLoader compact /> : null}
            {isLoading ? "찾는 중" : "내 아이디 흔적 찾기"}
          </button>
        </form>

        {summary ? (
          <section className="toss-card toss-result-panel" ref={resultPanelRef} tabIndex={-1} aria-label="점검 결과">
            <div className="toss-result-header">
              <span>{summary.foundCount}개 발견</span>
              <h2>{summary.username}가 남아 있는 곳</h2>
            </div>

            <div className="toss-result-metrics" aria-label="결과 규모">
              <Mini label="공개 흔적" value={`${visibleResults.length}개`} />
              <Mini label="잠김" value={`${hiddenCount}개`} />
            </div>

            <div className="toss-result-list">
              {visibleResults.length > 0 ? (
                visibleResults.map((result) => <TossResultCard isFullAccess={showFullReport} key={result.id} result={result} />)
              ) : (
                <article className="toss-result-card">
                  <div className="toss-result-icon" aria-hidden>
                    <Check size={18} />
                  </div>
                  <div>
                    <h3>바로 보이는 흔적 없음</h3>
                    <p>이번 빠른 점검에서는 바로 보여줄 공개 흔적이 없어요.</p>
                  </div>
                </article>
              )}
            </div>

            {hiddenCount > 0 ? <TossLockedMosaicList count={hiddenCount} startIndex={summary.previewResults.length + 1} /> : null}

            {hiddenCount > 0 ? (
              <div className="toss-lock-note">
                <LockKeyhole size={16} aria-hidden />
                <span>
                  상세 URL 잠김 · 나머지 {hiddenCount}개 흔적과 정리 가이드는 전체 리포트에서 열려요.
                </span>
              </div>
            ) : summary.previewResults.length > 0 ? (
              <div className="toss-lock-note">
                <LockKeyhole size={16} aria-hidden />
                <span>상세 URL 잠김 · 전체 URL과 조치 가이드는 정밀 리포트에서 열려요.</span>
              </div>
            ) : null}

            <button className="toss-button" type="button" onClick={startCheckout} disabled={isOrdering || showFullReport}>
              <CreditCard size={18} aria-hidden />
              {showFullReport ? "전체 리포트 열림" : isOrdering ? "결제를 준비하고 있어요" : "전체 리포트 보기"}
            </button>

            <div className="toss-score-summary" aria-label="점수 요약">
              <p>점수</p>
              <strong>{summary.doppelgangerScore}점</strong>
              <div>
                <Mini label="희소성" value={`${summary.rarityScore}점`} />
                <Mini label="노출도" value={`${summary.exposureScore}점`} />
                <Mini label="조치 필요도" value={riskLabels[summary.previewResults[0]?.riskLevel ?? "LOW"]} />
              </div>
            </div>
          </section>
        ) : null}

        <p className="toss-safety-note">
          실명, 전화번호, 이메일 검색은 지원하지 않아요. 같은 사람이라고 단정하지 않아요.
        </p>
      </div>
    </main>
  );
}

function TossLockedMosaicList({ count, startIndex }: { count: number; startIndex: number }) {
  const visibleCount = Math.min(count, 5);

  return (
    <div className="toss-locked-mosaic-list" aria-label={`잠긴 공개 흔적 ${count}개`}>
      {Array.from({ length: visibleCount }).map((_, index) => (
        <article className="toss-locked-card" key={`locked-${index}`} aria-label={`잠긴 공개 흔적 ${startIndex + index}`}>
          <div className="toss-locked-icon" aria-hidden />
          <div className="toss-locked-body">
            <div>
              <strong>공개 흔적 #{startIndex + index}</strong>
              <span>잠김</span>
            </div>
            <i className="mosaic-line mosaic-line-wide" aria-hidden />
            <i className="mosaic-line mosaic-line-short" aria-hidden />
          </div>
          <LockKeyhole size={15} aria-hidden />
        </article>
      ))}
    </div>
  );
}

function TossResultCard({ isFullAccess, result }: { isFullAccess: boolean; result: ScanResult }) {
  const host = hostnameFromUrl(result.url);
  const brandKey = platformBrandKey(result);

  return (
    <article className="toss-result-card" data-brand={brandKey}>
      <div className="toss-result-icon" data-brand={brandKey} aria-hidden>
        {result.platform.slice(0, 1).toUpperCase()}
      </div>
      <div className="toss-result-body">
        <div>
          <h3>{result.platform}</h3>
          <span className="risk-badge" data-risk={result.riskLevel}>
            {riskLabels[result.riskLevel]}
          </span>
        </div>
        <p>
          {categoryLabels[result.category]} · {countryLabels[result.country] ?? result.country}
          {host ? ` · ${host}` : ""}
        </p>
        <small>{isFullAccess ? result.url : "상세 URL 잠김"}</small>
      </div>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="toss-mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
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

function platformBrandKey(result: ScanResult) {
  const haystack = `${result.platform} ${result.url}`.toLowerCase();
  return platformBrandRules.find(([pattern]) => haystack.includes(pattern))?.[1] ?? "generic";
}

function getUsernameValidationMessage(value: string) {
  if (!value.trim()) return null;

  try {
    normalizeUsername(value);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "아이디를 다시 확인해 주세요.";
  }
}
