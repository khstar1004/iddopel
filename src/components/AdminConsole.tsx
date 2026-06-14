"use client";

import { Activity, CheckCircle2, Gauge, Gift, History, RefreshCw, ShieldAlert, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const devAdminTokenKey = "id-doppelganger-dev-admin-token";

type AdminRuntime = {
  enabled?: boolean;
  loginConfigured?: boolean;
  setupRequired?: boolean;
  local?: boolean;
  passwordConfigured?: boolean;
  secretConfigured?: boolean;
  username?: string | null;
  scanProvider?: string;
  storage?: string;
};

type BetaScanSettings = {
  publicScanEnabled: boolean;
  freeScanLimit: number;
  windowHours: number;
  maxConcurrentScans: number;
  busyRetryAfterSeconds: number;
  scanLeaseTtlSeconds: number;
  updatedAt?: string;
};

type NumericSettingsKey =
  | "freeScanLimit"
  | "windowHours"
  | "maxConcurrentScans"
  | "busyRetryAfterSeconds"
  | "scanLeaseTtlSeconds";

type AdminSettingsResponse = {
  settings: BetaScanSettings;
  runtime: AdminRuntime;
  error?: { message?: string };
};

type AdminRecommendation = {
  level: "critical" | "warning" | "info" | "ok";
  title: string;
  detail: string;
};

type AdminAuditEvent = {
  id: string;
  action: string;
  actor: string;
  changes: Record<string, { before: string | number | boolean | null; after: string | number | boolean | null }>;
  createdAt: string;
};

type AdminOverviewResponse = AdminSettingsResponse & {
  recommendations?: AdminRecommendation[];
  recentAuditEvents?: AdminAuditEvent[];
};

type AdminTicketTargetKind = "email" | "recoveryCode" | "referralCode";

type AdminTicketGrantResponse = {
  target?: {
    kind: AdminTicketTargetKind;
    referralCode: string;
    accountId: string | null;
    emailMasked: string | null;
  };
  grant?: {
    amount: number;
    previousBonusRemaining: number;
    bonusRemaining: number;
  };
  error?: { message?: string };
};

const defaultSettings: BetaScanSettings = {
  publicScanEnabled: true,
  freeScanLimit: 1,
  windowHours: 24,
  maxConcurrentScans: 6,
  busyRetryAfterSeconds: 30,
  scanLeaseTtlSeconds: 90
};

export function AdminConsole() {
  const [adminToken, setAdminToken] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [settings, setSettings] = useState<BetaScanSettings>(defaultSettings);
  const [runtime, setRuntime] = useState<AdminRuntime>({});
  const [statusText, setStatusText] = useState("");
  const [recommendations, setRecommendations] = useState<AdminRecommendation[]>([]);
  const [recentAuditEvents, setRecentAuditEvents] = useState<AdminAuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [ticketTarget, setTicketTarget] = useState("");
  const [ticketAmount, setTicketAmount] = useState(1);
  const [ticketMemo, setTicketMemo] = useState("");
  const [ticketGrantStatus, setTicketGrantStatus] = useState("");
  const [isGrantingTickets, setIsGrantingTickets] = useState(false);

  const headers = useMemo<Record<string, string>>(() => {
    const nextHeaders: Record<string, string> = {};
    if (adminToken) nextHeaders["x-dev-admin-token"] = adminToken;
    return nextHeaders;
  }, [adminToken]);

  const loadSettings = useCallback(
    async (nextToken = adminToken) => {
      if (!nextToken) return;
      setIsLoading(true);
      setStatusText("");
      try {
        const response = await fetch("/api/admin/overview", {
          headers: { "x-dev-admin-token": nextToken }
        });
        const body = (await response.json()) as AdminOverviewResponse;
        if (!response.ok) {
          setStatusText(body.error?.message || "운영 설정을 불러오지 못했어요.");
          return;
        }
        setSettings(body.settings);
        setRuntime(body.runtime);
        setRecommendations(body.recommendations || []);
        setRecentAuditEvents(body.recentAuditEvents || []);
      } finally {
        setIsLoading(false);
      }
    },
    [adminToken]
  );

  useEffect(() => {
    const storedToken = readLocalStorage(devAdminTokenKey) || "";
    fetch("/api/dev/admin-session", {
      headers: storedToken ? { "x-dev-admin-token": storedToken } : undefined
    })
      .then((response) => response.json())
      .then((body: AdminRuntime & { authenticated?: boolean }) => {
        setRuntime(body);
        if (typeof body.username === "string") setUsername(body.username);
        if (storedToken && body.authenticated) {
          setAdminToken(storedToken);
          void loadSettings(storedToken);
        }
      })
      .catch(() => setStatusText("관리자 상태를 확인하지 못했어요."));
  }, [loadSettings]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setStatusText("");
    try {
      const response = await fetch("/api/dev/admin-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const body = (await response.json()) as { token?: string; error?: { message?: string } };
      if (!response.ok || !body.token) {
        setStatusText(body.error?.message || "로그인하지 못했어요.");
        return;
      }
      writeLocalStorage(devAdminTokenKey, body.token);
      setAdminToken(body.token);
      setPassword("");
      await loadSettings(body.token);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminToken) return;
    setIsSaving(true);
    setStatusText("");
    try {
      const response = await fetch("/api/admin/scan-settings", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...headers
        },
        body: JSON.stringify(settings)
      });
      const body = (await response.json()) as AdminSettingsResponse;
      if (!response.ok) {
        setStatusText(body.error?.message || "운영 설정을 저장하지 못했어요.");
        return;
      }
      setSettings(body.settings);
      setRuntime(body.runtime);
      await loadSettings(adminToken);
      setStatusText("운영 설정을 저장했어요.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGrantTickets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminToken) return;
    setIsGrantingTickets(true);
    setTicketGrantStatus("");
    try {
      const response = await fetch("/api/admin/tickets", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...headers
        },
        body: JSON.stringify({
          target: ticketTarget,
          amount: ticketAmount,
          memo: ticketMemo
        })
      });
      const body = (await response.json()) as AdminTicketGrantResponse;
      if (!response.ok || !body.grant || !body.target) {
        setTicketGrantStatus(body.error?.message || "티켓을 지급하지 못했어요.");
        return;
      }

      setTicketGrantStatus(
        `${ticketTargetLabel(body.target.kind)} ${body.target.emailMasked || body.target.referralCode}에 ${body.grant.amount}장을 지급했어요. 현재 추천권 ${body.grant.bonusRemaining}장`
      );
      setTicketTarget("");
      setTicketAmount(1);
      setTicketMemo("");
      await loadSettings(adminToken);
    } finally {
      setIsGrantingTickets(false);
    }
  }

  function updateNumber(key: NumericSettingsKey, value: string) {
    setSettings((current) => ({
      ...current,
      [key]: Number(value)
    }));
  }

  return (
    <main className="admin-shell">
      <div className="container">
        <header className="admin-topbar">
          <a className="brand-mark" href="/">
            <span className="brand-icon">ID</span>
            <span>ID 도플갱어</span>
          </a>
          <span className="admin-badge">
            <ShieldCheck size={16} aria-hidden="true" />
            운영 설정
          </span>
        </header>

        <section className="admin-hero" aria-labelledby="admin-title">
          <div>
            <span className="admin-badge">
              <Gauge size={16} aria-hidden="true" />
              베타 운영
            </span>
            <h1 id="admin-title">검색 한도 관리</h1>
            <p>베타 기간의 무료 검색량과 동시 실행 상한을 조정합니다.</p>

            <dl className="admin-runtime-list">
              <RuntimeItem label="스캔" value={scanProviderLabel(runtime.scanProvider)} />
              <RuntimeItem label="저장소" value={runtime.storage || "file"} />
              <RuntimeItem label="Admin" value={runtime.enabled ? "enabled" : "local only"} />
              <RuntimeItem label="업데이트" value={settings.updatedAt ? new Date(settings.updatedAt).toLocaleString("ko-KR") : "not saved"} />
            </dl>

            {adminToken ? (
              <section className="admin-panel admin-ops-panel" aria-labelledby="admin-ops-title">
                <div className="admin-panel-title">
                  <Activity size={20} aria-hidden="true" />
                  <div>
                    <h2 id="admin-ops-title">운영 상태</h2>
                    <p>출시 전 막히기 쉬운 설정만 우선 점검합니다.</p>
                  </div>
                </div>
                <ul className="admin-recommendation-list">
                  {recommendations.map((item) => (
                    <li key={`${item.level}-${item.title}`} data-level={item.level}>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <div className="admin-side-stack">
            {runtime.setupRequired ? (
              <section className="admin-panel admin-setup-panel" aria-labelledby="admin-setup-title">
                <div className="admin-panel-title">
                  <ShieldAlert size={20} aria-hidden="true" />
                  <div>
                    <h2 id="admin-setup-title">관리자 보안 설정 필요</h2>
                    <p>공개 배포에서는 기본 비밀번호를 열지 않습니다. 아래 환경변수를 설정한 뒤 재배포하면 로그인 폼이 열립니다.</p>
                  </div>
                </div>
                <ul className="admin-check-list">
                  <li>
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <span>`ENABLE_DEV_ADMIN=true`</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <span>`DEV_ADMIN_PASSWORD`에 긴 비밀번호 설정</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <span>`DEV_ADMIN_SECRET`에 32자 이상 랜덤 문자열 설정</span>
                  </li>
                </ul>
                <p className="admin-note">이 상태에서는 운영 설정 API가 잠겨 있어 검색 한도 변경이 적용되지 않습니다.</p>
              </section>
            ) : !adminToken ? (
              <form className="admin-login admin-panel" onSubmit={handleLogin}>
                <h2>관리자 로그인</h2>
                <label htmlFor="admin-username">
                  <span>아이디</span>
                  <input id="admin-username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
                </label>
                <label htmlFor="admin-password">
                  <span>비밀번호</span>
                  <input
                    id="admin-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </label>
                <button className="primary-button" type="submit" disabled={isLoading}>
                  로그인
                </button>
                {statusText ? <div className="admin-alert">{statusText}</div> : null}
              </form>
            ) : (
              <section className="admin-panel" aria-labelledby="settings-title">
                <div className="admin-panel-title">
                  <SlidersHorizontal size={20} aria-hidden="true" />
                  <div>
                    <h2 id="settings-title">베타 검색 설정</h2>
                    <p>저장 즉시 새 검색 요청부터 적용됩니다.</p>
                  </div>
                </div>

                <form className="admin-settings-form" onSubmit={handleSave}>
                  <label className="admin-switch-field">
                    <input
                      type="checkbox"
                      checked={settings.publicScanEnabled}
                      onChange={(event) => setSettings((current) => ({ ...current, publicScanEnabled: event.target.checked }))}
                    />
                    <span>
                      <strong>공개 검색 허용</strong>
                      <small>끄면 베타 공개 검색 요청을 막습니다.</small>
                    </span>
                  </label>

                  <div className="admin-field-grid">
                    <NumberField id="free-scan-limit" label="무료 검색" unit="회" min={0} max={1000} value={settings.freeScanLimit} onChange={(value) => updateNumber("freeScanLimit", value)} />
                    <NumberField id="window-hours" label="기준 시간" unit="시간" min={1} max={720} value={settings.windowHours} onChange={(value) => updateNumber("windowHours", value)} />
                    <NumberField id="max-concurrent-scans" label="동시 검색" unit="개" min={1} max={50} value={settings.maxConcurrentScans} onChange={(value) => updateNumber("maxConcurrentScans", value)} />
                    <NumberField id="busy-retry-after-seconds" label="재시도" unit="초" min={1} max={3600} value={settings.busyRetryAfterSeconds} onChange={(value) => updateNumber("busyRetryAfterSeconds", value)} />
                    <NumberField id="scan-lease-ttl-seconds" label="슬롯 TTL" unit="초" min={10} max={600} value={settings.scanLeaseTtlSeconds} onChange={(value) => updateNumber("scanLeaseTtlSeconds", value)} />
                  </div>

                  <div className="admin-action-row">
                    <button className="primary-button" type="submit" disabled={isSaving}>
                      <CheckCircle2 size={17} aria-hidden="true" />
                      {isSaving ? "저장 중" : "설정 저장"}
                    </button>
                    <button className="secondary-button" type="button" onClick={() => loadSettings()} disabled={isLoading}>
                      <RefreshCw size={17} aria-hidden="true" />
                      새로고침
                    </button>
                  </div>
                  {statusText ? <div className={statusText.includes("저장했어요") ? "admin-status" : "admin-alert"}>{statusText}</div> : null}
                </form>
              </section>
            )}

            {adminToken ? (
              <section className="admin-panel" aria-labelledby="ticket-grant-title">
                <div className="admin-panel-title">
                  <Gift size={20} aria-hidden="true" />
                  <div>
                    <h2 id="ticket-grant-title">무료 검색권 지급</h2>
                    <p>티켓 지갑 이메일, 복구코드, 추천코드 중 하나로 bonus 검색권을 추가합니다.</p>
                  </div>
                </div>
                <form className="admin-ticket-form" onSubmit={handleGrantTickets}>
                  <label className="admin-text-field" htmlFor="ticket-target">
                    <span>대상</span>
                    <input
                      id="ticket-target"
                      value={ticketTarget}
                      onChange={(event) => setTicketTarget(event.target.value)}
                      placeholder="email@example.com 또는 복구코드"
                      autoComplete="off"
                    />
                  </label>
                  <div className="admin-field-grid admin-ticket-grid">
                    <NumberField
                      id="ticket-grant-amount"
                      label="지급"
                      unit="장"
                      min={1}
                      max={100}
                      value={ticketAmount}
                      onChange={(value) => setTicketAmount(Number(value))}
                    />
                    <label className="admin-text-field" htmlFor="ticket-memo">
                      <span>메모</span>
                      <input
                        id="ticket-memo"
                        value={ticketMemo}
                        onChange={(event) => setTicketMemo(event.target.value)}
                        placeholder="고객지원 지급"
                        maxLength={120}
                      />
                    </label>
                  </div>
                  <div className="admin-action-row">
                    <button className="primary-button" type="submit" disabled={isGrantingTickets || !ticketTarget.trim()}>
                      <Gift size={17} aria-hidden="true" />
                      {isGrantingTickets ? "지급 중" : "티켓 지급"}
                    </button>
                  </div>
                  {ticketGrantStatus ? (
                    <div className={ticketGrantStatus.includes("지급했어요") ? "admin-status" : "admin-alert"}>
                      {ticketGrantStatus}
                    </div>
                  ) : null}
                </form>
              </section>
            ) : null}

            {adminToken ? (
              <section className="admin-panel" aria-labelledby="admin-audit-title">
                <div className="admin-panel-title">
                  <History size={20} aria-hidden="true" />
                  <div>
                    <h2 id="admin-audit-title">최근 변경</h2>
                    <p>운영 설정 변경 이력을 최신순으로 표시합니다.</p>
                  </div>
                </div>
                <ul className="admin-audit-list">
                  {recentAuditEvents.length > 0 ? (
                    recentAuditEvents.map((event) => (
                      <li key={event.id}>
                        <div>
                          <strong>{auditActionLabel(event.action)}</strong>
                          <span>
                            {event.actor} · {new Date(event.createdAt).toLocaleString("ko-KR")}
                          </span>
                        </div>
                        <p>{summarizeAuditChanges(event.changes)}</p>
                      </li>
                    ))
                  ) : (
                    <li>
                      <div>
                        <strong>변경 이력 없음</strong>
                        <span>설정을 저장하면 여기에 기록됩니다.</span>
                      </div>
                    </li>
                  )}
                </ul>
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function auditActionLabel(action: string) {
  if (action === "scan_settings.update") return "검색 설정 변경";
  if (action === "tickets.grant") return "무료 검색권 지급";
  return action;
}

function summarizeAuditChanges(changes: AdminAuditEvent["changes"]) {
  const entries = Object.entries(changes);
  if (entries.length === 0) return "표시할 변경 항목이 없습니다.";

  return entries
    .map(([key, change]) => `${settingLabel(key)} ${formatAuditValue(change.before)} -> ${formatAuditValue(change.after)}`)
    .join(", ");
}

function settingLabel(key: string) {
  const labels: Record<string, string> = {
    publicScanEnabled: "공개 검색",
    freeScanLimit: "무료 검색",
    windowHours: "기준 시간",
    maxConcurrentScans: "동시 검색",
    busyRetryAfterSeconds: "재시도",
    scanLeaseTtlSeconds: "슬롯 TTL",
    targetKind: "대상",
    targetIdentifier: "식별자",
    amount: "지급",
    bonusRemaining: "추천권",
    memo: "메모"
  };
  return labels[key] || key;
}

function ticketTargetLabel(kind: AdminTicketTargetKind) {
  if (kind === "email") return "이메일";
  if (kind === "recoveryCode") return "복구코드";
  return "추천코드";
}

function readLocalStorage(key: string) {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // The active token is still kept in component state for the current tab.
  }
}

function formatAuditValue(value: string | number | boolean | null) {
  if (typeof value === "boolean") return value ? "켜짐" : "꺼짐";
  if (value === null) return "없음";
  return String(value);
}

function scanProviderLabel(value: string | undefined) {
  if (value === "maigret") return "실제 검색";
  if (value === "mock") return "테스트 검색";
  return value || "실제 검색";
}

function RuntimeItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function NumberField({
  id,
  label,
  unit,
  min,
  max,
  value,
  onChange
}: {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="admin-number-field" htmlFor={id}>
      <span>{label}</span>
      <span className="admin-input-with-unit">
        <input id={id} type="number" min={min} max={max} value={value} onChange={(event) => onChange(event.target.value)} />
        <small>{unit}</small>
      </span>
    </label>
  );
}
