"use client";

import { CheckCircle2, Gauge, RefreshCw, ShieldAlert, ShieldCheck, SlidersHorizontal } from "lucide-react";
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

const defaultSettings: BetaScanSettings = {
  publicScanEnabled: true,
  freeScanLimit: 5,
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
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
        const response = await fetch("/api/admin/scan-settings", {
          headers: { "x-dev-admin-token": nextToken }
        });
        const body = (await response.json()) as AdminSettingsResponse;
        if (!response.ok) {
          setStatusText(body.error?.message || "운영 설정을 불러오지 못했어요.");
          return;
        }
        setSettings(body.settings);
        setRuntime(body.runtime);
      } finally {
        setIsLoading(false);
      }
    },
    [adminToken]
  );

  useEffect(() => {
    const storedToken = window.localStorage.getItem(devAdminTokenKey) || "";
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
      window.localStorage.setItem(devAdminTokenKey, body.token);
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
      setStatusText("운영 설정을 저장했어요.");
    } finally {
      setIsSaving(false);
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
              <RuntimeItem label="스캔" value={runtime.scanProvider || "maigret"} />
              <RuntimeItem label="저장소" value={runtime.storage || "file"} />
              <RuntimeItem label="Admin" value={runtime.enabled ? "enabled" : "local only"} />
              <RuntimeItem label="업데이트" value={settings.updatedAt ? new Date(settings.updatedAt).toLocaleString("ko-KR") : "not saved"} />
            </dl>
          </div>

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
        </section>
      </div>
    </main>
  );
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
