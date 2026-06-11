export const launchConfirmPhrase = "LAUNCH";

type EnvLike = Record<string, string | undefined>;

export type LaunchEnvField = {
  key: string;
  label: string;
  sensitive: boolean;
  placeholder: string;
  multiline?: boolean;
};

export type LaunchConsoleOptions = {
  ship: boolean;
  localGate: boolean;
  execute: boolean;
  saveEnv: boolean;
  confirm: string;
};

export const launchEnvFields: LaunchEnvField[] = [
  { key: "PRODUCTION_DOMAIN", label: "프로덕션 도메인", sensitive: false, placeholder: "id.yourdomain.kr" },
  { key: "STORE_SUPPORT_EMAIL", label: "스토어 지원 이메일", sensitive: false, placeholder: "support@yourdomain.kr" },
  { key: "DATABASE_URL", label: "프로덕션 Postgres URL", sensitive: true, placeholder: "postgres://USER:PASSWORD@HOST:5432/DB" },
  { key: "DATABASE_SSL", label: "DB SSL", sensitive: false, placeholder: "true" },
  { key: "CRON_SECRET", label: "Cron Secret", sensitive: true, placeholder: "32자 이상 랜덤 문자열" },
  { key: "TOSS_CLIENT_KEY", label: "Toss Payments Client Key", sensitive: true, placeholder: "test_ck_..." },
  { key: "TOSS_SECRET_KEY", label: "Toss Payments Secret Key", sensitive: true, placeholder: "test_sk_..." },
  { key: "TOSS_SECURITY_KEY", label: "Toss Payments Security Key", sensitive: true, placeholder: "64자 보안 키" },
  { key: "TOSS_CONSOLE_API_KEY", label: "Toss Console API Key", sensitive: true, placeholder: "Apps in Toss console API key" },
  { key: "TOSS_CONSOLE_APP_ID", label: "Toss Console App ID", sensitive: false, placeholder: "app_..." },
  { key: "TOSS_MINI_APP_NAME", label: "Toss Mini App Name", sensitive: false, placeholder: "id-doppelganger" },
  { key: "TOSS_REVIEW_TEST_USERNAME", label: "Toss 심사용 아이디", sensitive: false, placeholder: "khstar104" },
  { key: "TOSS_REVIEW_SCENARIO", label: "Toss 심사 시나리오", sensitive: false, placeholder: "Enter the review username and run the flow." },
  { key: "ALERT_WEBHOOK_URL", label: "런칭 알림 Webhook", sensitive: true, placeholder: "https://hooks.yourdomain.kr/..." },
  { key: "ALERT_WEBHOOK_PROVIDER", label: "알림 Provider", sensitive: false, placeholder: "slack" },
  { key: "ALERT_RUNBOOK_URL", label: "장애 대응 Runbook URL", sensitive: false, placeholder: "https://docs.yourdomain.kr/runbook" },
  { key: "MOBILE_PAYMENTS_ENABLED", label: "네이티브 유료 리포트", sensitive: false, placeholder: "true" },
  { key: "APPLE_KEY_ID", label: "App Store Connect Key ID", sensitive: true, placeholder: "ABC123DEFG" },
  { key: "APPLE_ISSUER_ID", label: "App Store Connect Issuer ID", sensitive: true, placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
  {
    key: "APPLE_PRIVATE_KEY",
    label: "App Store Connect Private Key",
    sensitive: true,
    placeholder: "Paste App Store Connect .p8 contents",
    multiline: true
  },
  { key: "APPLE_APP_APPLE_ID", label: "Apple App ID", sensitive: false, placeholder: "1234567890" },
  {
    key: "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
    label: "Google Play Service Account JSON",
    sensitive: true,
    placeholder: "{\"type\":\"service_account\"...}",
    multiline: true
  }
];

const launchEnvMaxValueLength = 20_000;

export function isLaunchConsoleAvailable(request: Request, env: EnvLike = process.env) {
  void env;
  return isLoopbackRequest(request);
}

export function isLaunchConsoleExecutionEnabled(request: Request, env: EnvLike = process.env) {
  return isLoopbackRequest(request) && env.ENABLE_LAUNCH_CONSOLE === "true";
}

export function parseLaunchConsoleOptions(input: Record<string, unknown>): LaunchConsoleOptions {
  return {
    ship: parseBoolean(input.ship),
    localGate: parseBoolean(input.localGate),
    execute: parseBoolean(input.execute),
    saveEnv: parseBoolean(input.saveEnv),
    confirm: typeof input.confirm === "string" ? input.confirm.trim() : ""
  };
}

export function sanitizeLaunchEnvUpdates(input: Record<string, unknown>) {
  const updates: Record<string, string> = {};

  for (const field of launchEnvFields) {
    const rawValue = input[field.key];
    if (typeof rawValue !== "string") continue;
    const value = rawValue.trim();
    if (!value || value.length > launchEnvMaxValueLength) continue;
    updates[field.key] = value;
  }

  return updates;
}

export function mergeLaunchEnvValues(existing: Record<string, string>, updates: Record<string, string>) {
  const merged: Record<string, string> = {};

  for (const field of launchEnvFields) {
    const existingValue = existing[field.key];
    const updateValue = updates[field.key];
    if (typeof updateValue === "string" && updateValue.trim()) {
      merged[field.key] = updateValue.trim();
    } else if (typeof existingValue === "string" && existingValue.trim()) {
      merged[field.key] = existingValue.trim();
    }
  }

  return merged;
}

export function createLaunchEnvStatus(values: Record<string, string>) {
  const errors = validateLaunchEnvValues(values);

  return launchEnvFields.map((field) => {
    const value = values[field.key] || "";
    return {
      key: field.key,
      label: field.label,
      sensitive: field.sensitive,
      multiline: Boolean(field.multiline),
      configured: value.trim().length > 0,
      value: field.sensitive ? "" : value,
      placeholder: field.placeholder,
      error: errors[field.key] || ""
    };
  });
}

export function validateLaunchEnvValues(values: Record<string, string>) {
  const errors: Record<string, string> = {};

  validateProductionDomain(values.PRODUCTION_DOMAIN, errors);
  validateEmail(values.STORE_SUPPORT_EMAIL, "STORE_SUPPORT_EMAIL", "스토어 지원 이메일", errors);
  validatePostgresUrl(values.DATABASE_URL, errors);
  validateBoolean(values.DATABASE_SSL, "DATABASE_SSL", errors);
  validateMinimumLength(values.CRON_SECRET, "CRON_SECRET", "Cron Secret", 32, errors);
  validatePattern(values.TOSS_CLIENT_KEY, "TOSS_CLIENT_KEY", "Toss Payments Client Key", /^test_ck_|^live_ck_/, "test_ck_ 또는 live_ck_로 시작해야 해요.", errors);
  validateMinimumLength(values.TOSS_SECRET_KEY, "TOSS_SECRET_KEY", "Toss Payments Secret Key", 12, errors);
  validatePattern(values.TOSS_SECURITY_KEY, "TOSS_SECURITY_KEY", "Toss Payments Security Key", /^[a-f0-9]{64}$/i, "64자 hex 보안 키여야 해요.", errors);
  validateMinimumLength(values.TOSS_CONSOLE_API_KEY, "TOSS_CONSOLE_API_KEY", "Toss Console API Key", 12, errors);
  validateHttpsUrl(values.ALERT_WEBHOOK_URL, "ALERT_WEBHOOK_URL", "런칭 알림 Webhook", errors);
  validateWebhookProvider(values.ALERT_WEBHOOK_PROVIDER, errors);
  validateHttpsUrl(values.ALERT_RUNBOOK_URL, "ALERT_RUNBOOK_URL", "장애 대응 Runbook URL", errors);
  validateBoolean(values.MOBILE_PAYMENTS_ENABLED, "MOBILE_PAYMENTS_ENABLED", errors);
  validateSlug(values.TOSS_MINI_APP_NAME, "TOSS_MINI_APP_NAME", "Toss Mini App Name", errors);
  validateMinimumLength(values.APPLE_KEY_ID, "APPLE_KEY_ID", "App Store Connect Key ID", 6, errors);
  validateMinimumLength(values.APPLE_ISSUER_ID, "APPLE_ISSUER_ID", "App Store Connect Issuer ID", 16, errors);
  validateMinimumLength(values.APPLE_PRIVATE_KEY, "APPLE_PRIVATE_KEY", "App Store Connect Private Key", 12, errors);
  validateNumeric(values.APPLE_APP_APPLE_ID, "APPLE_APP_APPLE_ID", "Apple App ID", errors);
  validateJsonObject(values.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "Google Play Service Account JSON", errors);
  validateNoLaunchPlaceholders(values, errors);

  return errors;
}

export function renderLaunchEnvFile(values: Record<string, string>) {
  const lines = [
    "# Generated by ID Doppelganger launch console.",
    "# Keep this file local. It can contain production secrets.",
    ""
  ];

  for (const field of launchEnvFields) {
    const value = values[field.key];
    if (!value) continue;
    lines.push(`${field.key}=${formatEnvValue(value)}`);
  }

  return `${lines.join("\n")}\n`;
}

function parseBoolean(value: unknown) {
  return value === true || value === "true" || value === "1" || value === "on";
}

function formatEnvValue(value: string) {
  if (/^[A-Za-z0-9_./:@+-]+$/.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/"/g, '\\"')}"`;
}

function validateProductionDomain(value: string | undefined, errors: Record<string, string>) {
  const input = String(value || "").trim();
  if (!input) return;

  const url = parseUrlWithDefaultHttps(input);
  if (!url || url.protocol !== "https:" || isLocalHostname(url.hostname) || !url.hostname.includes(".")) {
    errors.PRODUCTION_DOMAIN = "실제 HTTPS 도메인을 입력하세요. localhost, IP, http URL은 출시값으로 저장할 수 없어요.";
  }
}

function validateEmail(value: string | undefined, key: string, label: string, errors: Record<string, string>) {
  const input = String(value || "").trim();
  if (!input) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
    errors[key] = `${label}은 이메일 형식이어야 해요.`;
  }
}

function validatePostgresUrl(value: string | undefined, errors: Record<string, string>) {
  const input = String(value || "").trim();
  if (!input) return;

  try {
    const url = new URL(input);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || isLocalHostname(url.hostname)) {
      errors.DATABASE_URL = "프로덕션 Postgres URL을 입력하세요. postgres:// 또는 postgresql:// 형식이어야 해요.";
    }
  } catch {
    errors.DATABASE_URL = "프로덕션 Postgres URL을 입력하세요. postgres:// 또는 postgresql:// 형식이어야 해요.";
  }
}

function validateBoolean(value: string | undefined, key: string, errors: Record<string, string>) {
  const input = String(value || "").trim();
  if (!input) return;
  if (!["true", "false"].includes(input.toLowerCase())) {
    errors[key] = `${key} 값은 true 또는 false 여야 해요.`;
  }
}

function validateHttpsUrl(value: string | undefined, key: string, label: string, errors: Record<string, string>) {
  const input = String(value || "").trim();
  if (!input) return;

  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || isLocalHostname(url.hostname)) {
      errors[key] = `${label}은 실제 HTTPS URL이어야 해요.`;
    }
  } catch {
    errors[key] = `${label}은 실제 HTTPS URL이어야 해요.`;
  }
}

function validateWebhookProvider(value: string | undefined, errors: Record<string, string>) {
  const input = String(value || "").trim();
  if (!input) return;
  if (!["generic", "slack", "discord"].includes(input)) {
    errors.ALERT_WEBHOOK_PROVIDER = "알림 Provider는 generic, slack, discord 중 하나여야 해요.";
  }
}

function validateSlug(value: string | undefined, key: string, label: string, errors: Record<string, string>) {
  const input = String(value || "").trim();
  if (!input) return;
  if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
    errors[key] = `${label}은 영문, 숫자, 하이픈, 언더스코어만 사용할 수 있어요.`;
  }
}

function validateMinimumLength(
  value: string | undefined,
  key: string,
  label: string,
  minimumLength: number,
  errors: Record<string, string>
) {
  const input = String(value || "").trim();
  if (!input) return;
  if (input.length < minimumLength) {
    errors[key] = `${label}은 ${minimumLength}자 이상이어야 해요.`;
  }
}

function validatePattern(
  value: string | undefined,
  key: string,
  label: string,
  pattern: RegExp,
  message: string,
  errors: Record<string, string>
) {
  const input = String(value || "").trim();
  if (!input) return;
  if (!pattern.test(input)) {
    errors[key] = `${label}은 ${message}`;
  }
}

function validateNumeric(value: string | undefined, key: string, label: string, errors: Record<string, string>) {
  const input = String(value || "").trim();
  if (!input) return;
  if (!/^\d+$/.test(input)) {
    errors[key] = `${label}은 숫자만 입력하세요.`;
  }
}

function validateJsonObject(value: string | undefined, key: string, label: string, errors: Record<string, string>) {
  const input = String(value || "").trim();
  if (!input) return;
  try {
    const parsed = JSON.parse(input);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errors[key] = `${label}은 JSON 객체여야 해요.`;
    }
  } catch {
    errors[key] = `${label}은 올바른 JSON 객체여야 해요.`;
  }
}

function validateNoLaunchPlaceholders(values: Record<string, string>, errors: Record<string, string>) {
  for (const field of launchEnvFields) {
    const input = String(values[field.key] || "").trim();
    if (!input || errors[field.key]) continue;
    if (hasLaunchPlaceholder(input)) {
      errors[field.key] = `${field.label}에 예시값이 아닌 실제 출시 값을 입력하세요.`;
    }
  }
}

function hasLaunchPlaceholder(value: string) {
  return /YOUR_|your-|replace-with|example\.com|support@YOUR_DOMAIN/i.test(value);
}

function parseUrlWithDefaultHttps(input: string) {
  try {
    return new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
}

function isLoopbackRequest(request: Request) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "0.0.0.0" || normalized === "::1";
}
