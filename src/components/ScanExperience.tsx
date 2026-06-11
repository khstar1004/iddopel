"use client";

import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  History,
  LockKeyhole,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound
} from "lucide-react";
import { FormEvent, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { categoryLabels, countryLabels, riskLabels, scoreTone } from "@/lib/labels";
import type { PublicMonitoringSubscription, ScanResult, ScanSummary } from "@/lib/types";
import { normalizeUsername } from "@/lib/validation";
import { BrandIcon } from "./BrandIcon";
import { ScanEyeLoader } from "./ScanEyeLoader";

interface StoredScan extends ScanSummary {
  savedAt: string;
}

interface ResultsResponse {
  scanId: string;
  access: "FULL" | "PREVIEW" | "LOCKED";
  lockedCount: number;
  maigretReportAvailable?: boolean;
  maigretReportFilename?: string;
  results: ScanResult[];
}

interface DetailAccessState extends ResultsResponse {
  label: string;
  description: string;
  reportToken?: string;
  adminToken?: string;
}

const monitoringOwnerTokenKey = "id-doppelganger-monitoring-owner-token";
const freeDetailOwnerTokenKey = "id-doppelganger-free-detail-owner-token";
const freeDetailUsedScanIdKey = "id-doppelganger-free-detail-used-scan-id";
const devAdminTokenKey = "id-doppelganger-dev-admin-token";
const scanSteps = [
  "공개 프로필 확인 중",
  "한국 서비스 확인 중",
  "SNS·블로그 확인 중",
  "후보 정리 중"
];
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

export function ScanExperience() {
  const [username, setUsername] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [history, setHistory] = useState<StoredScan[]>([]);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
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
    fetch("/api/dev/admin-session", {
      headers: devAdminHeaders(savedDevAdminToken)
    })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!body?.enabled) return;
        setDevAdminEnabled(true);
        if (typeof body.username === "string") setDevAdminUsername(body.username);
        if (body.authenticated && savedDevAdminToken) {
          setDevAdminToken(savedDevAdminToken);
          setDevAdminMessage("개발자 테스트 모드가 켜져 있어요.");
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isScanning) return;

    const timer = window.setInterval(() => {
      setProgress((value) => Math.min(96, value + 7));
      setStepIndex((value) => Math.min(scanSteps.length - 1, value + 1));
    }, 420);

    return () => window.clearInterval(timer);
  }, [isScanning]);

  useEffect(() => {
    if (!summary) return;

    const timer = window.setTimeout(() => {
      focusResultPanelNow();
    }, 40);

    return () => window.clearTimeout(timer);
  }, [summary?.scanId]);

  const usernameValidationMessage = useMemo(() => getUsernameValidationMessage(username), [username]);
  const canSubmit = username.trim().length >= 3 && !usernameValidationMessage && acknowledged && !isScanning;

  async function submitScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSummary(null);
    setProgress(9);
    setStepIndex(0);
    setIsScanning(true);

    try {
      const normalizedUsername = normalizeUsername(username);
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...devAdminHeaders(devAdminToken) },
        body: JSON.stringify({ username: normalizedUsername, purpose: "SELF_CHECK", mode: "quick" })
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error?.message ?? "점검을 시작하지 못했어요.");
      }

      await new Promise((resolve) => window.setTimeout(resolve, 720));
      setProgress(100);
      const nextSummary = body as ScanSummary;
      setSummary(nextSummary);
      saveHistory(nextSummary);
      focusResultsSection();
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "점검 중 문제가 발생했어요.");
    } finally {
      setIsScanning(false);
    }
  }

  function resetScanForNext() {
    setSummary(null);
    setError(null);
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
    const focusTarget =
      resultPanelRef.current ?? document.querySelector<HTMLElement>(".result-first-panel") ?? resultsTitleRef.current;
    if (!focusTarget) return;

    const top = Math.max(0, focusTarget.getBoundingClientRect().top + window.scrollY - 12);
    window.scrollTo({ top, behavior: "auto" });
    focusTarget?.focus({ preventScroll: true });
  }

  function saveHistory(nextSummary: ScanSummary) {
    const item: StoredScan = { ...nextSummary, savedAt: new Date().toISOString() };
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

  function restoreScanFromHistory(item: StoredScan) {
    setSummary(item);
    setUsername(item.username);
    setError(null);
    focusResultsSection();
  }

  async function submitMonitoring(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMonitoringMessage(null);
    setIsSavingMonitoring(true);

    const rawInput = monitoringInput.trim() || summary?.username || username.trim();
    const usernames = rawInput.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean);
    const ownerToken = window.localStorage.getItem(monitoringOwnerTokenKey) ?? undefined;

    try {
      const response = await fetch("/api/monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerToken, usernames, purpose: "SELF_CHECK" })
      });
      const body = await response.json();

      if (!response.ok) {
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
        <a className="brand-mark" href="/" aria-label="ID 도플갱어 홈">
          <BrandIcon />
          <span>ID 도플갱어</span>
        </a>
        <nav className="nav-links" aria-label="주요 링크">
          <a href="#results">결과</a>
          <a href="#pricing">가격</a>
          <a href="/guides/id-rarity-test">SEO 가이드</a>
          <a href="/toss">토스 인앱</a>
        </nav>
      </header>

      <section id="scan" className="container hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={15} aria-hidden />
            공개 아이디 사용 현황 테스트
          </span>
          <h1 id="hero-title">내 아이디, 전세계에서 나만 쓰는 줄 알았어?</h1>
          <p>
            아이디 하나로 공개 계정 후보를 확인하세요.
          </p>
          <div className="trust-strip" aria-label="안전 정책">
            <span className="trust-chip">
              <ShieldCheck size={15} aria-hidden /> 실명 검색 미지원
            </span>
            <span className="trust-chip">
              <ShieldCheck size={15} aria-hidden /> 전화번호·이메일 차단
            </span>
            <span className="trust-chip">
              <ShieldCheck size={15} aria-hidden /> 동일인 판정 안 함
            </span>
          </div>
        </div>

        <form className="scan-panel" onSubmit={submitScan} aria-label="아이디 점검">
          <div className="radar" aria-hidden>
            <div className="radar-core">
              {isScanning ? `${progress}%` : username.trim() || "username"}
            </div>
          </div>

          <div className="field-stack">
            <label htmlFor="username">아이디 입력</label>
            <input
              id="username"
              className="id-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="아이디만 입력"
              autoComplete="off"
              inputMode="text"
              maxLength={30}
            />
            {usernameValidationMessage ? (
              <p className="field-help" data-tone="error" role="alert">
                {usernameValidationMessage}
              </p>
            ) : username.trim().startsWith("@") ? (
              <p className="field-help">@ 없이 {username.trim().replace(/^@+/, "")}로 점검돼요.</p>
            ) : null}
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span>본인 아이디, 브랜드명, 사용 예정 닉네임 등 정당한 목적으로 검색해요.</span>
          </label>

          {isScanning ? (
            <div className="scan-loading-card" role="status" aria-live="polite">
              <div className="scan-loading-copy">
                <ScanEyeLoader />
                <p>{scanSteps[stepIndex]}</p>
              </div>
              <strong>{progress}%</strong>
            </div>
          ) : null}

          {error ? (
            <div className="error-box" role="alert">
              {error}
            </div>
          ) : null}

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
            />
          ) : null}

          <button className="primary-button" disabled={!canSubmit} type="submit">
            {isScanning ? <ScanEyeLoader compact /> : <Search size={18} aria-hidden />}
            {isScanning ? "찾는 중" : "공개 후보 확인"}
          </button>
        </form>
      </section>

      <section id="results" className="section light-section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2 className="result-heading" ref={resultsTitleRef} tabIndex={-1}>
                {summary ? `${summary.username}에서 발견된 공개 후보` : "아이디를 입력하면 결과가 바로 떠요"}
              </h2>
            </div>
            {summary ? (
              <button className="danger-button" type="button" onClick={() => deleteScan(summary.scanId)}>
                <Trash2 size={17} aria-hidden />
                기록 삭제
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
            />
          ) : (
            <EmptyResultPreview />
          )}
        </div>
      </section>

      <section id="pricing" className="section light-section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2>가격</h2>
            </div>
          </div>
          <div className="pricing-grid">
            <PricingCard title="무료" price="0원" items={["빠른 점검", "후보 카드 미리보기", "잠긴 URL 미리보기"]} />
            <PricingCard
              featured
              title="정밀 리포트"
              price="2,900원"
              items={["전체 결과 URL", "위험도 분석", "HTML/PDF 리포트"]}
            />
            <PricingCard
              title="월간 모니터링"
              price="3,900원/월"
              items={["월 1회 자동 재점검", "새 후보 알림", "아이디 3개 모니터링"]}
            />
          </div>
        </div>
      </section>

      <section className="section light-section">
        <div className="container results-grid">
          <section className="panel" aria-labelledby="monitoring-title">
            <div className="section-header">
              <div>
                <h2 id="monitoring-title">월간 자동 재점검</h2>
              </div>
            </div>
            <form className="monitoring-form" onSubmit={submitMonitoring}>
              <div className="field-stack">
                <label htmlFor="monitoring-usernames">모니터링할 아이디</label>
                <input
                  id="monitoring-usernames"
                  className="id-input"
                  value={monitoringInput}
                  onChange={(event) => setMonitoringInput(event.target.value)}
                  placeholder={summary?.username ?? (username.trim() || "쉼표로 여러 아이디 입력")}
                  autoComplete="off"
                />
              </div>
              <button className="primary-button" type="submit" disabled={isSavingMonitoring}>
                <Bell size={18} aria-hidden />
                {isSavingMonitoring ? "등록 중" : "월간 재점검 등록"}
              </button>
            </form>
            {monitoringMessage ? (
              <div className="mini-card" role="status" style={{ marginTop: 12 }}>
                <p>{monitoringMessage}</p>
              </div>
            ) : null}
          </section>

          <section className="panel" aria-labelledby="monitoring-status-title">
            <h2 id="monitoring-status-title">모니터링 상태</h2>
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
                  <p>다음 자동 재점검</p>
                  <strong>{new Date(monitoring.nextRunAt).toLocaleDateString("ko-KR")}</strong>
                </div>
                <div className="mini-card">
                  <p>최근 재점검</p>
                  <strong>{monitoring.lastRunAt ? new Date(monitoring.lastRunAt).toLocaleDateString("ko-KR") : "아직 없음"}</strong>
                </div>
                <button className="danger-button" type="button" onClick={deleteMonitoring}>
                  <Trash2 size={17} aria-hidden />
                  모니터링 해지
                </button>
              </div>
            ) : (
              <p style={{ color: "#6b7684", lineHeight: 1.65, margin: "14px 0 0" }}>
                아직 등록된 월간 모니터링이 없어요. 무료 점검 후 같은 아이디를 바로 등록할 수 있어요.
              </p>
            )}
          </section>
        </div>
      </section>

      <section className="section light-section">
        <div className="container results-grid">
          <section className="panel" aria-labelledby="history-title">
            <h2 id="history-title">최근 검색한 아이디</h2>
            <div className="history-list" style={{ marginTop: 14 }}>
              {history.length === 0 ? (
                <p style={{ color: "#6b7684", margin: 0 }}>이 브라우저에 저장된 검색 기록이 없어요.</p>
              ) : (
                history.map((item) => (
                  <div className="history-row" key={item.scanId}>
                    <div>
                      <strong>{item.username}</strong>
                      <span>
                        후보 {item.foundCount}개 · 희소성 {item.rarityScore}점
                      </span>
                    </div>
                    <div className="history-row-actions">
                      <button
                        aria-label={`${item.username} 결과 다시 보기`}
                        className="ghost-button"
                        type="button"
                        onClick={() => restoreScanFromHistory(item)}
                      >
                        <History size={16} aria-hidden />
                        다시 보기
                      </button>
                      <button
                        aria-label={`${item.username} 기록 삭제`}
                        className="ghost-button"
                        type="button"
                        onClick={() => deleteScan(item.scanId)}
                      >
                        <Trash2 size={16} aria-hidden />
                        삭제
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
          <section className="panel" aria-labelledby="faq-title">
            <h2 id="faq-title">FAQ</h2>
            <ul className="faq-list" style={{ marginTop: 14 }}>
              <li className="faq-item">
                <strong>이게 사람 찾기인가요?</strong>
                <span>아니요. 아이디 문자열의 공개 사용 현황만 확인해요.</span>
              </li>
              <li className="faq-item">
                <strong>결과가 모두 같은 사람인가요?</strong>
                <span>아니요. 동일인 여부를 판정하지 않아요.</span>
              </li>
              <li className="faq-item">
                <strong>검색 기록을 지울 수 있나요?</strong>
                <span>네. 무료 기록은 즉시 삭제할 수 있어요.</span>
              </li>
            </ul>
          </section>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <span>© 2026 ID 도플갱어</span>
          <div className="footer-links">
            <a href="/privacy">개인정보처리방침</a>
            <a href="/terms">이용약관</a>
            <a href="/responsible-use">책임 있는 사용</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function ResultDashboard({
  devAdminToken,
  summary,
  onPrepareMonitoring,
  onScanAgain,
  resultPanelRef
}: {
  devAdminToken: string | null;
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
  const activeAccess = detailAccess ?? previewAccessFromSummary(summary);
  const visibleResultCount = activeAccess.results.length;
  const lockedResultCount = activeAccess.lockedCount;
  const distribution = useMemo(() => {
    const countries = Object.entries(summary.countryDistribution);
    const categories = Object.entries(summary.categoryDistribution);
    return { countries, categories };
  }, [summary]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetailAccess() {
      setIsLoadingDetailAccess(true);
      setReportError(null);

      try {
        const nextAccess = devAdminToken
          ? await loadDevAdminResults(summary.scanId, devAdminToken)
          : await loadFirstFreeOrPreviewResults(summary.scanId);

        if (!cancelled) setDetailAccess(nextAccess);
      } catch (error) {
        if (!cancelled) {
          setDetailAccess(previewAccessFromSummary(summary));
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
  }, [devAdminToken, summary]);

  async function openFullReport() {
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
    const shareText = buildShareSummary(summary);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        copyTextFallback(shareText);
      }
      setCopyMessage("공유용 요약을 복사했어요.");
    } catch {
      setCopyMessage("복사하지 못했어요. 브라우저 권한을 확인해 주세요.");
    }
  }

  return (
    <div className="dashboard-stack">
      <section className="panel result-first-panel" ref={resultPanelRef} tabIndex={-1} aria-labelledby="preview-title">
        <div className="result-first-header">
          <div>
            <span className="source-badge" data-source={summary.scanSource ?? "LOCAL_FALLBACK"}>
              공개 후보
            </span>
            <h2 id="preview-title">
              {summary.foundCount > 0
                ? `${summary.username}에서 지금 잡힌 후보`
                : `${summary.username} 공개 후보 없음`}
            </h2>
          </div>
        </div>
        <ResultPreview
          detailAccess={activeAccess}
          isLoadingFull={isLoadingFull}
          isLoadingResults={isLoadingDetailAccess}
          onOpenFullReport={openFullReport}
        />
        <div className="result-first-metrics" aria-label="결과 규모">
          <span>
            <strong>{visibleResultCount}</strong>
            먼저 공개
          </span>
          <span>
            <strong>{lockedResultCount}</strong>
            잠긴 후보
          </span>
          <span>
            <strong>{summary.countryDistribution.KR ?? 0}</strong>
            한국
          </span>
        </div>
        {reportError ? (
          <div className="error-box" role="alert" style={{ marginTop: 12 }}>
            {reportError}
          </div>
        ) : null}
      </section>

      <section className="action-strip" aria-label="다음 작업">
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
            공유 카드 저장
          </a>
          <button className="secondary-button" type="button" onClick={copyShareSummary}>
            <Copy size={16} aria-hidden />
            결과 요약 복사
          </button>
          <button className="secondary-button" type="button" onClick={onPrepareMonitoring}>
            <Bell size={16} aria-hidden />
            월간 재점검에 넣기
          </button>
          <button className="ghost-button" type="button" onClick={onScanAgain}>
            <Search size={16} aria-hidden />
            다른 아이디 점검
          </button>
        </div>
      </section>

      {detailAccess?.access === "FULL" && detailAccess.maigretReportAvailable ? (
        <OriginalHtmlReportPanel detailAccess={detailAccess} />
      ) : null}

      <div className="results-grid analysis-grid" aria-label="점검 보조 분석">
        <section className="panel" aria-labelledby="distribution-title">
          <h2 id="distribution-title">결과 해석</h2>
          <div className="distribution-grid" style={{ marginTop: 14 }}>
            <MiniMetric label="검사 플랫폼" value={`${summary.checkedCount}개`} />
            <MiniMetric label="확인 실패" value={`${summary.failedRate}%`} />
            <MiniMetric label="한국 서비스" value={`${summary.countryDistribution.KR ?? 0}개`} />
          </div>
          <Distribution title="국가별 분포" entries={distribution.countries} labelMap={countryLabels} />
          <Distribution title="카테고리별 분포" entries={distribution.categories} labelMap={categoryLabels} />
        </section>

        <section className="panel" aria-labelledby="score-title">
          <h2 id="score-title">점수</h2>
          <div className="score-stack" style={{ marginTop: 14 }}>
            <div className="score-main compact-score">
              <div style={{ textAlign: "center" }}>
                <strong>{summary.doppelgangerScore}</strong>
                <span>점</span>
              </div>
            </div>
            <ul className="score-list">
              <ScoreLine label="희소성" value={summary.rarityScore} />
              <ScoreLine label="노출도" value={summary.exposureScore} />
              <ScoreLine label="사칭 가능성" value={summary.impersonationScore} />
              <ScoreLine label="방치 계정 위험" value={summary.cleanupScore} />
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function EmptyResultPreview() {
  return (
    <div className="dashboard-stack">
      <section className="panel result-first-panel empty-result-panel" aria-label="검색 전 결과 상태">
        <div className="empty-result-icon" aria-hidden>
          <Search size={24} />
        </div>
        <h2>아직 검색한 아이디가 없어요</h2>
      </section>
    </div>
  );
}

function ScoreLine({ label, value }: { label: string; value: number }) {
  return (
    <li className="score-item">
      <span>{label}</span>
      <span className="score-pill" data-tone={scoreTone(value)}>
        {value}점
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
  labelMap
}: {
  title: string;
  entries: [string, number][];
  labelMap: Record<string, string>;
}) {
  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ fontSize: 16 }}>{title}</h3>
      <div className="distribution-grid" style={{ marginTop: 10 }}>
        {(entries.length ? entries : [["없음", 0]]).map(([key, value]) => (
          <MiniMetric key={key} label={labelMap[key] ?? key} value={`${value}개`} />
        ))}
      </div>
    </div>
  );
}

function ResultPreview({
  detailAccess,
  isLoadingFull,
  isLoadingResults,
  onOpenFullReport
}: {
  detailAccess: DetailAccessState;
  isLoadingFull: boolean;
  isLoadingResults: boolean;
  onOpenFullReport: () => void;
}) {
  const isFullAccess = detailAccess.access === "FULL";
  const ctaLabel = isFullAccess ? "정밀 리포트 열기" : "전체 리포트 보기";
  const hiddenCount = Math.max(detailAccess.lockedCount, 0);
  const paidPreviewLead = detailAccess.label === "무료 미리보기" ? "1회 무료 상세 결과를 이미 사용했어요. " : "";
  const hasResults = detailAccess.results.length > 0;

  return (
    <div className="result-list" data-result-count={detailAccess.results.length}>
      {hasResults ? (
        detailAccess.results.map((result, index) => (
          <RichResultCard index={index} isFullAccess={isFullAccess} key={result.id} result={result} />
        ))
      ) : (
        <div className="locked-results">
          <span>무료 점검에서 공개 계정 후보가 발견되지 않았어요.</span>
          <CheckCircle2 size={18} aria-hidden />
        </div>
      )}

      {isLoadingResults ? (
        <div className="detail-access-status" role="status" aria-live="polite">
          <Radar size={17} aria-hidden />
          <span>상세 결과 확인 중</span>
        </div>
      ) : null}

      {!isFullAccess && hiddenCount > 0 ? (
        <div className="locked-mosaic-list" aria-label="잠긴 상세 결과">
          {Array.from({ length: Math.min(5, hiddenCount) }).map((_, index) => (
            <div className="locked-result-mosaic" key={`locked-${index}`}>
              <div className="mosaic-content">
                <strong>공개 계정 후보 #{detailAccess.results.length + index + 1}</strong>
                <span>URL, 위험도, 정리 가이드 잠김</span>
              </div>
              <LockKeyhole size={17} aria-hidden />
            </div>
          ))}
        </div>
      ) : null}

      <div className="locked-results" data-open={isFullAccess}>
        <span>
          {isFullAccess
            ? `${detailAccess.results.length}개 상세 결과가 열렸어요.`
            : hiddenCount > 0
              ? `${paidPreviewLead}상세 URL ${hiddenCount}개 잠김`
              : detailAccess.description}
        </span>
        <button className="secondary-button" type="button" onClick={onOpenFullReport} disabled={isLoadingFull}>
          {isFullAccess ? <Download size={16} aria-hidden /> : <CreditCard size={16} aria-hidden />}
          {isLoadingFull ? "주문 만드는 중" : ctaLabel}
        </button>
      </div>
    </div>
  );
}

function RichResultCard({ result, isFullAccess, index = 0 }: { result: ScanResult; isFullAccess: boolean; index?: number }) {
  const host = hostnameFromUrl(result.url);
  const visibleTags = (result.tags ?? []).slice(0, 4);
  const brandKey = platformBrandKey(result);

  return (
    <article className="rich-result-card" data-brand={brandKey} aria-label={`${result.platform} 공개 계정 후보`}>
      <div className="result-card-media">
        <PlatformIcon result={result} />
        <ResultProfileImage result={result} />
      </div>
      <div className="result-card-body">
        <div className="result-card-title-row">
          <div>
            <span className="result-rank-badge">#{index + 1} 발견됨</span>
            <h3>{result.platform}</h3>
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
            <div className="masked-url-teaser" aria-label={`${result.platform} 잠긴 상세 URL 미리보기`}>
              <ExternalLink size={15} aria-hidden />
              <span>{maskUrlPreview(result.url)}</span>
              <LockKeyhole size={14} aria-hidden />
            </div>
            <p className="preview-lock-copy">플랫폼 후보는 먼저 공개하고, 정확한 URL과 정리 가이드는 전체 리포트에서 열려요.</p>
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

function OriginalHtmlReportPanel({ detailAccess }: { detailAccess: DetailAccessState }) {
  const reportUrl = maigretReportUrlFor(detailAccess);

  if (!reportUrl) return null;

  return (
    <section className="panel source-report-panel" aria-labelledby="source-report-title">
      <div className="source-report-launch">
        <div>
          <h2 id="source-report-title">원본 HTML 리포트</h2>
        </div>
        <div className="source-report-actions">
          <a className="secondary-button" href={reportUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden />
            새 탭으로 보기
          </a>
          <a className="ghost-button" download={detailAccess.maigretReportFilename} href={reportUrl}>
            <Download size={16} aria-hidden />
            HTML 저장
          </a>
        </div>
      </div>
      <iframe className="source-report-frame" title="원본 HTML 리포트 미리보기" src={reportUrl} loading="lazy" />
    </section>
  );
}

function FullReport({ summary, results }: { summary: ScanSummary; results: ScanResult[] }) {
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
              {riskLabels[result.riskLevel]}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function downloadHtmlReport(summary: ScanSummary, results: ScanResult[]) {
  const rows = results
    .map(
      (result) => `<tr>
        <td>${escapeHtml(result.platform)}</td>
        <td>${escapeHtml(result.url)}</td>
        <td>${escapeHtml(categoryLabels[result.category])}</td>
        <td>${escapeHtml(countryLabels[result.country] ?? result.country)}</td>
        <td>${escapeHtml(riskLabels[result.riskLevel])}</td>
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
  <p>공개 계정 후보 ${summary.foundCount}개 · 희소성 ${summary.rarityScore}점 · 노출도 ${summary.exposureScore}점</p>
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

function buildShareSummary(summary: ScanSummary) {
  const origin = window.location.origin;

  return [
    `${summary.username} 공개 계정 후보 ${summary.foundCount}개`,
    `열린 후보 ${summary.previewResults.length}개 · 잠긴 상세 URL ${Math.max(0, summary.foundCount - summary.previewResults.length)}개`,
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

function maskUrlPreview(value: string) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./, "");
    const pathPart = parsed.pathname.split("/").filter(Boolean)[0] ?? "profile";
    const visiblePrefix = pathPart.slice(0, Math.min(4, pathPart.length));
    return `${host}/${visiblePrefix}${"•".repeat(Math.max(4, Math.min(8, pathPart.length)))}`;
  } catch {
    return "상세 URL 잠김";
  }
}

async function loadDevAdminResults(scanId: string, adminToken: string): Promise<DetailAccessState> {
  const response = await fetch(`/api/scans/${scanId}/results?access=full`, {
    headers: devAdminHeaders(adminToken)
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body?.error?.message ?? "어드민 전체 결과를 불러오지 못했어요.");
  }

  return {
    ...(body as ResultsResponse),
    label: "어드민 전체 결과",
    description: "개발자 테스트 모드로 결제 없이 전체 결과를 보고 있어요.",
    adminToken
  };
}

async function loadFirstFreeOrPreviewResults(scanId: string): Promise<DetailAccessState> {
  const ownerToken = window.localStorage.getItem(freeDetailOwnerTokenKey);
  const usedScanId = window.localStorage.getItem(freeDetailUsedScanIdKey);

  if (ownerToken && usedScanId && usedScanId !== scanId) {
    return loadPreviewResults(
      scanId,
      "무료 미리보기",
      "상세 URL 잠김"
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
      label: freeBody.reused ? "1회 무료 상세 결과 다시 보기" : "1회 무료 상세 결과",
      description: "전체 결과 열림",
      reportToken: freeBody.reportToken
    };
  }

  if (freeBody?.error?.code === "FIRST_FREE_USED") {
    window.localStorage.setItem(freeDetailUsedScanIdKey, scanId);
  }

  return loadPreviewResults(
    scanId,
    "무료 미리보기",
    freeBody?.error?.message ?? "상세 URL 잠김"
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

function previewAccessFromSummary(summary: ScanSummary): DetailAccessState {
  return {
    scanId: summary.scanId,
    access: "PREVIEW",
    lockedCount: Math.max(0, summary.foundCount - summary.previewResults.length),
    maigretReportAvailable: summary.maigretReportAvailable,
    maigretReportFilename: summary.maigretReportFilename,
    results: summary.previewResults,
    label: "무료 미리보기",
    description: "상세 URL 잠김"
  };
}

function devAdminHeaders(token: string | null | undefined): Record<string, string> {
  return token ? { "x-dev-admin-token": token } : {};
}

function DevAdminPanel({
  isActive,
  message,
  onLogin,
  onLogout,
  password,
  setPassword,
  setUsername,
  username
}: {
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
          <strong>개발자 테스트 모드</strong>
          <span>스캔 제한과 결제 잠금 없이 전체 결과를 확인합니다.</span>
          {message ? <span>{message}</span> : null}
        </div>
        <button className="ghost-button" type="button" onClick={onLogout}>
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="dev-admin-card">
      <div>
        <strong>개발자 테스트 로그인</strong>
        <span>로컬 테스트 기본 계정은 admin / admin 입니다.</span>
        {message ? <span role="alert">{message}</span> : null}
      </div>
      <div className="dev-admin-fields">
        <input
          aria-label="개발자 아이디"
          className="id-input"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
        />
        <input
          aria-label="개발자 비밀번호"
          className="id-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onLogin();
          }}
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호"
        />
        <button className="secondary-button" type="button" onClick={onLogin}>
          로그인
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

function getUsernameValidationMessage(value: string) {
  if (!value.trim()) return null;

  try {
    normalizeUsername(value);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "아이디를 다시 확인해 주세요.";
  }
}

function PricingCard({ title, price, items, featured = false }: { title: string; price: string; items: string[]; featured?: boolean }) {
  return (
    <article className="pricing-card" style={featured ? { borderColor: "#3182f6" } : undefined}>
      <h3>{title}</h3>
      <strong style={{ display: "block", margin: "10px 0", fontSize: 28 }}>{price}</strong>
      <ul className="guide-list">
        {items.map((item) => (
          <li key={item}>
            <span>{item}</span>
            {item.includes("다운로드") ? <Download size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
          </li>
        ))}
      </ul>
    </article>
  );
}
