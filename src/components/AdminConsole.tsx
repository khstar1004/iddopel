"use client";

import { ArrowLeft, LogOut, Save, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { BrandIcon } from "./BrandIcon";
import { devAdminTokenKey } from "./client-tokens";

interface AdminScanSettings {
  freeScanLimit: number;
  windowHours: number;
  updatedAt?: string;
}

export function AdminConsole() {
  const [enabled, setEnabled] = useState(true);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [settings, setSettings] = useState<AdminScanSettings | null>(null);
  const [freeScanLimit, setFreeScanLimit] = useState("5");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = useCallback(async (token: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/scan-settings", {
        headers: devAdminHeaders(token)
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error?.message ?? "관리자 설정을 불러오지 못했어요.");
      }

      setSettings(body.settings as AdminScanSettings);
      setFreeScanLimit(String(body.settings.freeScanLimit));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "관리자 설정을 불러오지 못했어요.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(devAdminTokenKey);

    fetch("/api/dev/admin-session", {
      headers: savedToken ? devAdminHeaders(savedToken) : undefined
    })
      .then((response) => response.json())
      .then((body) => {
        setEnabled(Boolean(body.enabled));
        if (typeof body.username === "string") setUsername(body.username);
        if (body.authenticated && savedToken) {
          setAdminToken(savedToken);
          void loadSettings(savedToken);
          return;
        }

        setIsLoading(false);
      })
      .catch(() => {
        setEnabled(false);
        setIsLoading(false);
      });
  }, [loadSettings]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/dev/admin-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const body = await response.json().catch(() => null);

      if (!response.ok || !body?.token) {
        throw new Error(body?.error?.message ?? "관리자 로그인에 실패했어요.");
      }

      window.localStorage.setItem(devAdminTokenKey, body.token);
      setAdminToken(body.token);
      setPassword("");
      setMessage("관리자 로그인이 완료됐어요.");
      await loadSettings(body.token);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "관리자 로그인에 실패했어요.");
      setIsLoading(false);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminToken) return;

    setIsSaving(true);
    setError(null);
    setMessage(null);

    const nextLimit = Number(freeScanLimit);
    if (!Number.isInteger(nextLimit) || nextLimit < 0 || nextLimit > 1000) {
      setError("무료검색 한도는 0부터 1000 사이의 정수로 입력해 주세요.");
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/scan-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...devAdminHeaders(adminToken)
        },
        body: JSON.stringify({ freeScanLimit: nextLimit })
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error?.message ?? "설정을 저장하지 못했어요.");
      }

      setSettings(body.settings as AdminScanSettings);
      setFreeScanLimit(String(body.settings.freeScanLimit));
      setMessage("무료검색 한도를 저장했어요.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "설정을 저장하지 못했어요.");
    } finally {
      setIsSaving(false);
    }
  }

  function logout() {
    window.localStorage.removeItem(devAdminTokenKey);
    setAdminToken(null);
    setSettings(null);
    setPassword("");
    setMessage("관리자 로그아웃이 완료됐어요.");
  }

  return (
    <main className="admin-shell">
      <header className="container admin-topbar">
        <a className="brand-mark" href="/" aria-label="ID 도플갱어 홈">
          <BrandIcon />
          <span>ID 도플갱어</span>
        </a>
        <a className="ghost-button" href="/">
          <ArrowLeft size={17} aria-hidden />
          홈으로
        </a>
      </header>

      <section className="container admin-hero" aria-labelledby="admin-title">
        <div>
          <span className="admin-badge">
            <ShieldCheck size={16} aria-hidden />
            관리자
          </span>
          <h1 id="admin-title">베타 운영 설정</h1>
          <p>무료검색 quota를 조절하고, 출시 전 검색 부하를 제어합니다.</p>
        </div>

        <div className="admin-panel">
          {!enabled ? (
            <div className="admin-alert" role="alert">
              관리자 로그인이 비활성화되어 있어요. `ENABLE_DEV_ADMIN=true`와 `DEV_ADMIN_PASSWORD`를 설정해 주세요.
            </div>
          ) : adminToken ? (
            <form className="admin-settings-form" onSubmit={saveSettings}>
              <div className="admin-panel-title">
                <SlidersHorizontal size={20} aria-hidden />
                <div>
                  <h2>무료검색 한도</h2>
                  <p>비관리자 기준, {settings?.windowHours ?? 24}시간 동안 허용할 검색 수입니다.</p>
                </div>
              </div>

              <label className="admin-number-field" htmlFor="free-scan-limit">
                <span>인당 무료검색 수</span>
                <input
                  id="free-scan-limit"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={1000}
                  step={1}
                  value={freeScanLimit}
                  onChange={(event) => setFreeScanLimit(event.target.value)}
                />
              </label>

              <div className="admin-action-row">
                <button className="primary-button" type="submit" disabled={isSaving || isLoading}>
                  <Save size={17} aria-hidden />
                  {isSaving ? "저장 중" : "저장"}
                </button>
                <button className="ghost-button" type="button" onClick={logout}>
                  <LogOut size={17} aria-hidden />
                  로그아웃
                </button>
              </div>

              {settings?.updatedAt ? <p className="admin-note">최근 저장: {formatDateTime(settings.updatedAt)}</p> : null}
            </form>
          ) : (
            <form className="admin-login" onSubmit={login}>
              <h2>관리자 로그인</h2>
              <label htmlFor="admin-username">
                <span>아이디</span>
                <input
                  id="admin-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                />
              </label>
              <label htmlFor="admin-password">
                <span>비밀번호</span>
                <input
                  id="admin-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  type="password"
                />
              </label>
              <button className="primary-button" type="submit" disabled={isLoading}>
                {isLoading ? "확인 중" : "로그인"}
              </button>
            </form>
          )}

          {message ? <div className="admin-status" role="status">{message}</div> : null}
          {error ? <div className="admin-alert" role="alert">{error}</div> : null}
        </div>
      </section>
    </main>
  );
}

function devAdminHeaders(token: string) {
  return { "x-dev-admin-token": token };
}

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
}
