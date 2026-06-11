"use client";

import { AlertTriangle, CheckCircle2, LockKeyhole, Play, RefreshCw, Rocket, ShieldCheck, Terminal } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const devAdminTokenKey = "id-doppelganger-dev-admin-token";

const launchRequirementGroups = [
  {
    id: "web",
    label: "웹/운영 배포",
    keys: ["PRODUCTION_DOMAIN", "DATABASE_URL", "CRON_SECRET", "WEB_DETAILED_REPORT_PAYWALL_ENABLED", "ALERT_WEBHOOK_URL", "ALERT_RUNBOOK_URL"]
  },
  {
    id: "toss",
    label: "Toss 결제/인앱",
    keys: [
      "STORE_SUPPORT_EMAIL",
      "TOSS_CLIENT_KEY",
      "TOSS_SECRET_KEY",
      "TOSS_SECURITY_KEY",
      "TOSS_CONSOLE_API_KEY",
      "TOSS_CONSOLE_APP_ID",
      "TOSS_MINI_APP_NAME",
      "TOSS_ALLOWED_ORIGINS"
    ]
  },
  {
    id: "store",
    label: "App Store / Google Play",
    keys: [
      "MOBILE_PAYMENTS_ENABLED",
      "APPLE_BUNDLE_ID",
      "APPLE_DETAILED_REPORT_PRODUCT_ID",
      "APPLE_ENVIRONMENT",
      "APPLE_KEY_ID",
      "APPLE_ISSUER_ID",
      "APPLE_PRIVATE_KEY",
      "APPLE_APP_APPLE_ID",
      "GOOGLE_PLAY_PACKAGE_NAME",
      "GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID",
      "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"
    ]
  }
];

type LaunchStep = {
  id: string;
  description: string;
  command: string;
  env: Record<string, string>;
};

type LaunchReport = {
  ok: boolean;
  ship: boolean;
  localGate: boolean;
  envFile: string;
  missing: string[];
  steps: LaunchStep[];
};

type LaunchConsoleState = {
  ok: boolean;
  authenticated: boolean;
  username: string;
  executeEnabled: boolean;
  confirmPhrase: string;
  envFileExists: boolean;
  envStatus: Array<{
    key: string;
    label: string;
    sensitive: boolean;
    multiline: boolean;
    configured: boolean;
    value: string;
    placeholder: string;
    error: string;
  }>;
  report: LaunchReport;
  result?: {
    ok: boolean;
    failedStep: string | null;
    results: Array<{ id: string; command: string; ok: boolean; status: number; durationMs: number }>;
  };
  error?: {
    code: string;
    message: string;
  };
};

export function LaunchConsole() {
  const [adminToken, setAdminToken] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [ship, setShip] = useState(true);
  const [localGate, setLocalGate] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const [envDraft, setEnvDraft] = useState<Record<string, string>>({});
  const [state, setState] = useState<LaunchConsoleState | null>(null);
  const [statusText, setStatusText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSavingEnv, setIsSavingEnv] = useState(false);

  const requestHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {};
    if (adminToken) headers["x-dev-admin-token"] = adminToken;
    return headers;
  }, [adminToken]);

  const refreshPlan = useCallback(
    async (nextToken = adminToken, nextShip = ship, nextLocalGate = localGate) => {
      if (!nextToken) return;
      setIsLoading(true);
      setStatusText("");
      try {
        const response = await fetch(`/api/dev/launch-button?ship=${nextShip ? "true" : "false"}&localGate=${nextLocalGate ? "true" : "false"}`, {
          headers: { "x-dev-admin-token": nextToken }
        });
        const body = (await response.json()) as LaunchConsoleState | { error?: { message?: string } };
        if (!response.ok || !("report" in body)) {
          setStatusText(body.error?.message || "출시 계획을 불러오지 못했어요.");
          setState(null);
          return;
        }
        applyConsoleState(body);
      } finally {
        setIsLoading(false);
      }
    },
    [adminToken, localGate, ship]
  );

  useEffect(() => {
    const storedToken = window.localStorage.getItem(devAdminTokenKey) || "";
    if (storedToken) {
      setAdminToken(storedToken);
      void refreshPlan(storedToken, ship, localGate);
    }
  }, [localGate, refreshPlan, ship]);

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
      await refreshPlan(body.token, ship, localGate);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExecute() {
    if (!adminToken || !state) return;
    setIsExecuting(true);
    setStatusText("");
    try {
      const response = await fetch("/api/dev/launch-button", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...requestHeaders
        },
        body: JSON.stringify({
          ship,
          localGate,
          execute: true,
          confirm: confirmText
        })
      });
      const body = (await response.json()) as LaunchConsoleState;
      applyConsoleState(body);
      if (!response.ok) {
        setStatusText(body.error?.message || "출시 실행이 중단됐어요.");
      }
    } finally {
      setIsExecuting(false);
    }
  }

  function applyShip(nextValue: boolean) {
    setShip(nextValue);
    void refreshPlan(adminToken, nextValue, localGate);
  }

  function applyLocalGate(nextValue: boolean) {
    setLocalGate(nextValue);
    void refreshPlan(adminToken, ship, nextValue);
  }

  async function handleSaveEnv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminToken) return;
    setIsSavingEnv(true);
    setStatusText("");
    try {
      const response = await fetch("/api/dev/launch-button", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...requestHeaders
        },
        body: JSON.stringify({
          ship,
          localGate,
          saveEnv: true,
          envValues: envDraft
        })
      });
      const body = (await response.json()) as LaunchConsoleState & { saved?: boolean; savedKeys?: string[] };
      if (!response.ok || body.saved === false || body.error) {
        if (body.report) applyConsoleState(body);
        setStatusText(body.error?.message || "출시 환경값을 저장하지 못했어요.");
        return;
      }
      applyConsoleState(body);
      setStatusText(`${body.savedKeys?.length || 0}개 값을 .env.launch에 저장했어요.`);
    } finally {
      setIsSavingEnv(false);
    }
  }

  function applyConsoleState(nextState: LaunchConsoleState) {
    setState(nextState);
    setEnvDraft(
      Object.fromEntries(
        nextState.envStatus.map((item) => [item.key, item.sensitive ? "" : item.value])
      )
    );
  }

  const report = state?.report;
  const readinessGroups = useMemo(() => {
    if (!state || !report) return [];

    const missingKeys = new Set(report.missing);
    const statusByKey = new Map(state.envStatus.map((item) => [item.key, item]));

    return launchRequirementGroups.map((group) => {
      const missing = group.keys.filter((key) => missingKeys.has(key));
      const invalid = group.keys.filter((key) => Boolean(statusByKey.get(key)?.error));
      return {
        ...group,
        missing,
        invalid,
        ready: missing.length === 0 && invalid.length === 0,
        labels: group.keys.map((key) => statusByKey.get(key)?.label || key)
      };
    });
  }, [report, state]);
  const canExecute =
    Boolean(state?.executeEnabled) && Boolean(report?.ok) && confirmText.trim() === state?.confirmPhrase && !isExecuting && !isLoading;

  return (
    <main className="launch-shell">
      <div className="container launch-container">
        <header className="launch-topbar">
          <a className="brand-mark" href="/">
            <span className="brand-icon">ID</span>
            <span>ID 도플갱어</span>
          </a>
          <span className="launch-env-badge">
            <ShieldCheck size={16} aria-hidden="true" />
            로컬 운영자
          </span>
        </header>

        <section className="launch-hero" aria-labelledby="launch-title">
          <div>
            <p className="eyebrow">Launch Console</p>
            <h1 id="launch-title">출시 계획을 바로 확인하고 실행합니다</h1>
          </div>

          {!adminToken ? (
            <form className="launch-login" onSubmit={handleLogin}>
              <label>
                <span>개발자 아이디</span>
                <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
              </label>
              <label>
                <span>개발자 비밀번호</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <button type="submit" disabled={isLoading}>
                <LockKeyhole size={17} aria-hidden="true" />
                로그인
              </button>
            </form>
          ) : (
            <div className="launch-actions" aria-label="출시 모드">
              <button type="button" data-active={localGate} onClick={() => applyLocalGate(!localGate)}>
                <CheckCircle2 size={17} aria-hidden="true" />
                로컬 게이트
              </button>
              <button type="button" data-active={ship} onClick={() => applyShip(!ship)}>
                <Rocket size={17} aria-hidden="true" />
                Compose 배포
              </button>
              <button type="button" onClick={() => refreshPlan()} disabled={isLoading}>
                <RefreshCw size={17} aria-hidden="true" />
                계획 새로고침
              </button>
            </div>
          )}
        </section>

        {statusText ? (
          <div className="launch-alert" role="status">
            <AlertTriangle size={18} aria-hidden="true" />
            {statusText}
          </div>
        ) : null}

        {report ? (
          <section className="launch-board" aria-label="출시 계획">
            <div className="launch-summary">
              <div>
                <span>상태</span>
                <strong>{report.ok ? "실행 가능" : "값 필요"}</strong>
              </div>
              <div>
                <span>실행 단계</span>
                <strong>{report.steps.length}개</strong>
              </div>
              <div>
                <span>환경 파일</span>
                <strong>{state.envFileExists ? report.envFile : "없음"}</strong>
              </div>
              <div>
                <span>누락값</span>
                <strong>{report.missing.length}개</strong>
              </div>
            </div>

            <div className="launch-content-grid">
              <section className="launch-panel launch-env-editor" aria-labelledby="env-editor-title">
                <div className="launch-panel-title">
                  <ShieldCheck size={18} aria-hidden="true" />
                  <h2 id="env-editor-title">출시 값 입력</h2>
                </div>
                <form className="launch-env-form" onSubmit={handleSaveEnv}>
                  {state.envStatus.map((item) => (
                    <label className="launch-env-field" key={item.key} data-missing={!item.configured}>
                      <span>
                        {item.label}
                        <code>{item.key}</code>
                      </span>
                      {item.multiline ? (
                        <textarea
                          aria-label={item.label}
                          aria-invalid={item.error ? "true" : "false"}
                          aria-describedby={item.error ? `${item.key}-error` : undefined}
                          value={envDraft[item.key] || ""}
                          onChange={(event) => setEnvDraft((current) => ({ ...current, [item.key]: event.target.value }))}
                          placeholder={item.configured && item.sensitive ? "저장됨 - 새 값 입력 시 교체" : item.placeholder}
                          rows={5}
                          spellCheck={false}
                        />
                      ) : (
                        <input
                          aria-label={item.label}
                          aria-invalid={item.error ? "true" : "false"}
                          aria-describedby={item.error ? `${item.key}-error` : undefined}
                          type={item.sensitive ? "password" : "text"}
                          value={envDraft[item.key] || ""}
                          onChange={(event) => setEnvDraft((current) => ({ ...current, [item.key]: event.target.value }))}
                          placeholder={item.configured && item.sensitive ? "저장됨 - 새 값 입력 시 교체" : item.placeholder}
                        />
                      )}
                      {item.error ? (
                        <small className="launch-env-error" id={`${item.key}-error`}>
                          {item.error}
                        </small>
                      ) : null}
                    </label>
                  ))}
                  <button className="launch-primary-button" type="submit" disabled={isSavingEnv}>
                    <ShieldCheck size={18} aria-hidden="true" />
                    {isSavingEnv ? "저장 중" : ".env.launch 저장"}
                  </button>
                </form>
              </section>

              <section className="launch-panel" aria-labelledby="missing-title">
                <div className="launch-panel-title">
                  <AlertTriangle size={18} aria-hidden="true" />
                  <h2 id="missing-title">출시 전 남은 값</h2>
                </div>
                <div className="launch-requirement-grid">
                  {readinessGroups.map((group) => (
                    <article className="launch-requirement-card" data-ready={group.ready} key={group.id}>
                      <div>
                        <strong>{group.label}</strong>
                        <span>{group.ready ? "완료" : `${group.missing.length + group.invalid.length}개 필요`}</span>
                      </div>
                      <p>{group.ready ? "출시 실행 조건을 충족했어요." : group.labels.join(", ")}</p>
                    </article>
                  ))}
                </div>
                {report.missing.length > 0 ? (
                  <div className="launch-missing-list">
                    {report.missing.map((key) => (
                      <code key={key}>{key}</code>
                    ))}
                  </div>
                ) : (
                  <p className="launch-empty">필수 값이 채워졌습니다.</p>
                )}
              </section>

              <section className="launch-panel" aria-labelledby="execute-title">
                <div className="launch-panel-title">
                  <Play size={18} aria-hidden="true" />
                  <h2 id="execute-title">출시 실행</h2>
                </div>
                <label className="launch-confirm">
                  <span>확인 문구</span>
                  <input
                    aria-label="출시 확인 문구"
                    value={confirmText}
                    onChange={(event) => setConfirmText(event.target.value)}
                    placeholder={state.confirmPhrase}
                  />
                </label>
                <button className="launch-primary-button" type="button" onClick={handleExecute} disabled={!canExecute}>
                  <Rocket size={18} aria-hidden="true" />
                  {isExecuting ? "실행 중" : "출시 실행"}
                </button>
                <p className="launch-note">
                  {state.executeEnabled ? "실행 잠금 해제됨" : "ENABLE_LAUNCH_CONSOLE=true 필요"}
                </p>
              </section>
            </div>

            <section className="launch-steps" aria-labelledby="steps-title">
              <div className="launch-panel-title">
                <Terminal size={18} aria-hidden="true" />
                <h2 id="steps-title">실행 순서</h2>
              </div>
              <div className="launch-step-list">
                {report.steps.map((step, index) => (
                  <article className="launch-step" key={step.id}>
                    <span className="launch-step-index">{index + 1}</span>
                    <div>
                      <h3>{step.command}</h3>
                      <p>{step.description}</p>
                      {Object.keys(step.env).length > 0 ? (
                        <div className="launch-env-list">
                          {Object.entries(step.env).map(([key, value]) => (
                            <code key={key}>
                              {key}={value}
                            </code>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {state.result ? (
              <section className="launch-result" role="status">
                <CheckCircle2 size={18} aria-hidden="true" />
                {state.result.ok ? "출시 명령이 완료됐어요." : `${state.result.failedStep} 단계에서 중단됐어요.`}
              </section>
            ) : null}
          </section>
        ) : (
          <section className="launch-board launch-board-empty" aria-label="출시 계획">
            <Terminal size={26} aria-hidden="true" />
            <h2>개발자 로그인 후 출시 계획이 표시됩니다</h2>
          </section>
        )}
      </div>
    </main>
  );
}
