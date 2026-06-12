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

const tossPaymentKeys = ["TOSS_CLIENT_KEY", "TOSS_SECRET_KEY", "TOSS_SECURITY_KEY"];
const polarPaymentKeys = [
  "POLAR_ACCESS_TOKEN",
  "POLAR_PRODUCT_ID",
  "POLAR_MONTHLY_MONITORING_PRODUCT_ID",
  "POLAR_WEBHOOK_SECRET",
  "POLAR_SERVER"
];

export const launchEnvFields: LaunchEnvField[] = [
  { key: "PRODUCTION_DOMAIN", label: "프로덕션 도메인", sensitive: false, placeholder: "id.yourdomain.kr" },
  { key: "STORE_SUPPORT_EMAIL", label: "스토어 지원 이메일", sensitive: false, placeholder: "support@yourdomain.kr" },
  { key: "DATABASE_URL", label: "프로덕션 Postgres URL", sensitive: true, placeholder: "postgres://USER:PASSWORD@HOST:5432/DB" },
  { key: "DATABASE_SSL", label: "DB SSL", sensitive: false, placeholder: "true" },
  { key: "CRON_SECRET", label: "Cron Secret", sensitive: true, placeholder: "32자 이상 랜덤 문자열" },
  { key: "REPORT_TOKEN_SECRET", label: "Report Token Secret", sensitive: true, placeholder: "32자 이상 랜덤 문자열" },
  { key: "FIRST_FREE_FINGERPRINT_SECRET", label: "1회 무료 판정 Secret", sensitive: true, placeholder: "32자 이상 랜덤 문자열" },
  { key: "PAYMENT_PROVIDER", label: "웹 결제 Provider", sensitive: false, placeholder: "toss 또는 polar" },
  { key: "TOSS_CLIENT_KEY", label: "Toss Payments Client Key", sensitive: true, placeholder: "test_ck_..." },
  { key: "TOSS_SECRET_KEY", label: "Toss Payments Secret Key", sensitive: true, placeholder: "test_sk_..." },
  { key: "TOSS_SECURITY_KEY", label: "Toss Payments Security Key", sensitive: true, placeholder: "64자 보안 키" },
  { key: "POLAR_ACCESS_TOKEN", label: "Polar Access Token", sensitive: true, placeholder: "polar access token" },
  { key: "POLAR_PRODUCT_ID", label: "Polar 정밀 리포트 상품 ID", sensitive: false, placeholder: "detailed report product id" },
  {
    key: "POLAR_MONTHLY_MONITORING_PRODUCT_ID",
    label: "Polar 월간 모니터링 상품 ID",
    sensitive: false,
    placeholder: "monthly monitoring product id"
  },
  { key: "POLAR_WEBHOOK_SECRET", label: "Polar Webhook Secret", sensitive: true, placeholder: "32자 이상 랜덤 문자열" },
  { key: "POLAR_SERVER", label: "Polar 서버", sensitive: false, placeholder: "production" },
  { key: "TOSS_CONSOLE_API_KEY", label: "Toss Console API Key", sensitive: true, placeholder: "Apps in Toss console API key" },
  { key: "TOSS_CONSOLE_APP_ID", label: "Toss Console App ID", sensitive: false, placeholder: "app_..." },
  { key: "TOSS_MINI_APP_NAME", label: "Toss Mini App Name", sensitive: false, placeholder: "id-doppelganger" },
  {
    key: "TOSS_ALLOWED_ORIGINS",
    label: "Toss 허용 Origin",
    sensitive: false,
    placeholder: "https://id-doppelganger.apps.tossmini.com,https://id-doppelganger.private-apps.tossmini.com"
  },
  { key: "TOSS_REVIEW_TEST_USERNAME", label: "Toss 심사용 아이디", sensitive: false, placeholder: "khstar104" },
  { key: "TOSS_REVIEW_SCENARIO", label: "Toss 심사 시나리오", sensitive: false, placeholder: "Enter the review username and run the flow." },
  { key: "WEB_DETAILED_REPORT_PAYWALL_ENABLED", label: "웹 정밀 리포트 유료잠금", sensitive: false, placeholder: "false" },
  { key: "MONITORING_PAYWALL_ENABLED", label: "월간 모니터링 유료잠금", sensitive: false, placeholder: "false" },
  { key: "ALERT_WEBHOOK_URL", label: "런칭 알림 Webhook", sensitive: true, placeholder: "https://hooks.yourdomain.kr/..." },
  { key: "ALERT_WEBHOOK_PROVIDER", label: "알림 Provider", sensitive: false, placeholder: "slack" },
  { key: "ALERT_RUNBOOK_URL", label: "장애 대응 Runbook URL", sensitive: false, placeholder: "https://docs.yourdomain.kr/runbook" },
  { key: "MOBILE_PAYMENTS_ENABLED", label: "네이티브 유료 리포트", sensitive: false, placeholder: "true" },
  { key: "APPLE_BUNDLE_ID", label: "Apple Bundle ID", sensitive: false, placeholder: "com.iddoppelganger.app" },
  { key: "APPLE_DETAILED_REPORT_PRODUCT_ID", label: "Apple 상세 리포트 상품 ID", sensitive: false, placeholder: "detailed_report" },
  { key: "APPLE_ENVIRONMENT", label: "Apple 영수증 환경", sensitive: false, placeholder: "production" },
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
  { key: "GOOGLE_PLAY_PACKAGE_NAME", label: "Google Play Package", sensitive: false, placeholder: "com.iddoppelganger.app" },
  { key: "GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID", label: "Google Play 상세 리포트 상품 ID", sensitive: false, placeholder: "detailed_report" },
  {
    key: "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
    label: "Google Play Service Account JSON",
    sensitive: true,
    placeholder: "{\"type\":\"service_account\"...}",
    multiline: true
  },
  {
    key: "GOOGLE_PLAY_UPLOAD_KEYSTORE_BASE64",
    label: "Google Play 업로드 Keystore Base64",
    sensitive: true,
    placeholder: "base64로 인코딩한 .jks 또는 .keystore",
    multiline: true
  },
  {
    key: "GOOGLE_PLAY_UPLOAD_KEYSTORE_PASSWORD",
    label: "Google Play Keystore Password",
    sensitive: true,
    placeholder: "업로드 keystore 비밀번호"
  },
  { key: "GOOGLE_PLAY_UPLOAD_KEY_ALIAS", label: "Google Play Key Alias", sensitive: false, placeholder: "upload" },
  {
    key: "GOOGLE_PLAY_UPLOAD_KEY_PASSWORD",
    label: "Google Play Key Password",
    sensitive: true,
    placeholder: "업로드 key 비밀번호"
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
  const paymentProvider = normalizePaymentProvider(values.PAYMENT_PROVIDER);

  validateProductionDomain(values.PRODUCTION_DOMAIN, errors);
  validateEmail(values.STORE_SUPPORT_EMAIL, "STORE_SUPPORT_EMAIL", "스토어 지원 이메일", errors);
  validatePostgresUrl(values.DATABASE_URL, errors);
  validateBoolean(values.DATABASE_SSL, "DATABASE_SSL", errors);
  validateMinimumLength(values.CRON_SECRET, "CRON_SECRET", "Cron Secret", 32, errors);
  validateMinimumLength(values.REPORT_TOKEN_SECRET, "REPORT_TOKEN_SECRET", "Report Token Secret", 32, errors);
  validateMinimumLength(values.FIRST_FREE_FINGERPRINT_SECRET, "FIRST_FREE_FINGERPRINT_SECRET", "1회 무료 판정 Secret", 32, errors);
  validateDistinctSecrets(
    values.REPORT_TOKEN_SECRET,
    values.FIRST_FREE_FINGERPRINT_SECRET,
    "REPORT_TOKEN_SECRET",
    "FIRST_FREE_FINGERPRINT_SECRET",
    errors
  );
  validatePaymentProvider(values.PAYMENT_PROVIDER, errors);
  if (paymentProvider === "toss") {
    validatePattern(values.TOSS_CLIENT_KEY, "TOSS_CLIENT_KEY", "Toss Payments Client Key", /^test_ck_|^live_ck_/, "test_ck_ 또는 live_ck_로 시작해야 해요.", errors);
    validateMinimumLength(values.TOSS_SECRET_KEY, "TOSS_SECRET_KEY", "Toss Payments Secret Key", 12, errors);
    validatePattern(values.TOSS_SECURITY_KEY, "TOSS_SECURITY_KEY", "Toss Payments Security Key", /^[a-f0-9]{64}$/i, "64자 hex 보안 키여야 해요.", errors);
  }
  if (paymentProvider === "polar") {
    validateMinimumLength(values.POLAR_ACCESS_TOKEN, "POLAR_ACCESS_TOKEN", "Polar Access Token", 12, errors);
    validateMinimumLength(values.POLAR_PRODUCT_ID, "POLAR_PRODUCT_ID", "Polar 정밀 리포트 상품 ID", 3, errors);
    validateMinimumLength(
      values.POLAR_MONTHLY_MONITORING_PRODUCT_ID,
      "POLAR_MONTHLY_MONITORING_PRODUCT_ID",
      "Polar 월간 모니터링 상품 ID",
      3,
      errors
    );
    validateMinimumLength(values.POLAR_WEBHOOK_SECRET, "POLAR_WEBHOOK_SECRET", "Polar Webhook Secret", 32, errors);
    validatePolarServer(values.POLAR_SERVER, errors);
  }
  validateMinimumLength(values.TOSS_CONSOLE_API_KEY, "TOSS_CONSOLE_API_KEY", "Toss Console API Key", 12, errors);
  validateTossAllowedOrigins(values.TOSS_ALLOWED_ORIGINS, errors);
  validateBoolean(values.WEB_DETAILED_REPORT_PAYWALL_ENABLED, "WEB_DETAILED_REPORT_PAYWALL_ENABLED", errors);
  validateBoolean(values.MONITORING_PAYWALL_ENABLED, "MONITORING_PAYWALL_ENABLED", errors);
  validateHttpsUrl(values.ALERT_WEBHOOK_URL, "ALERT_WEBHOOK_URL", "런칭 알림 Webhook", errors);
  validateWebhookProvider(values.ALERT_WEBHOOK_PROVIDER, errors);
  validateHttpsUrl(values.ALERT_RUNBOOK_URL, "ALERT_RUNBOOK_URL", "장애 대응 Runbook URL", errors);
  validateBoolean(values.MOBILE_PAYMENTS_ENABLED, "MOBILE_PAYMENTS_ENABLED", errors);
  validateSlug(values.TOSS_MINI_APP_NAME, "TOSS_MINI_APP_NAME", "Toss Mini App Name", errors);
  validatePattern(values.APPLE_BUNDLE_ID, "APPLE_BUNDLE_ID", "Apple Bundle ID", /^com\.iddoppelganger\.app$/, "com.iddoppelganger.app 이어야 해요.", errors);
  validateSlug(values.APPLE_DETAILED_REPORT_PRODUCT_ID, "APPLE_DETAILED_REPORT_PRODUCT_ID", "Apple 상세 리포트 상품 ID", errors);
  validateAppleEnvironment(values.APPLE_ENVIRONMENT, errors);
  validateMinimumLength(values.APPLE_KEY_ID, "APPLE_KEY_ID", "App Store Connect Key ID", 6, errors);
  validateMinimumLength(values.APPLE_ISSUER_ID, "APPLE_ISSUER_ID", "App Store Connect Issuer ID", 16, errors);
  validateMinimumLength(values.APPLE_PRIVATE_KEY, "APPLE_PRIVATE_KEY", "App Store Connect Private Key", 12, errors);
  validateNumeric(values.APPLE_APP_APPLE_ID, "APPLE_APP_APPLE_ID", "Apple App ID", errors);
  validatePattern(values.GOOGLE_PLAY_PACKAGE_NAME, "GOOGLE_PLAY_PACKAGE_NAME", "Google Play Package", /^com\.iddoppelganger\.app$/, "com.iddoppelganger.app 이어야 해요.", errors);
  validateSlug(values.GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID, "GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID", "Google Play 상세 리포트 상품 ID", errors);
  validateJsonObject(values.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "Google Play Service Account JSON", errors);
  validateGooglePlayUploadSigning(values, errors);
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

function normalizePaymentProvider(value: string | undefined) {
  const input = String(value || "").trim().toLowerCase();
  return input || "toss";
}

function validatePaymentProvider(value: string | undefined, errors: Record<string, string>) {
  const input = String(value || "").trim().toLowerCase();
  if (!input) return;
  if (!["toss", "polar"].includes(input)) {
    errors.PAYMENT_PROVIDER = "웹 결제 Provider는 toss 또는 polar 중 하나여야 해요.";
  }
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

function validatePolarServer(value: string | undefined, errors: Record<string, string>) {
  const input = String(value || "").trim();
  if (!input) return;
  if (!["production", "sandbox"].includes(input)) {
    errors.POLAR_SERVER = "Polar 서버는 production 또는 sandbox 이어야 해요.";
  }
}

function validateTossAllowedOrigins(value: string | undefined, errors: Record<string, string>) {
  const input = String(value || "").trim();
  if (!input) return;

  const origins = input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const normalizedHosts = [];
  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== "https:" || isLocalHostname(parsed.hostname)) {
        errors.TOSS_ALLOWED_ORIGINS = "Toss 허용 Origin은 실제 HTTPS Origin이어야 해요.";
        return;
      }
      normalizedHosts.push(parsed.hostname);
    } catch {
      errors.TOSS_ALLOWED_ORIGINS = "Toss 허용 Origin은 쉼표로 구분한 HTTPS Origin 목록이어야 해요.";
      return;
    }
  }

  if (!normalizedHosts.some((host) => host.endsWith(".apps.tossmini.com"))) {
    errors.TOSS_ALLOWED_ORIGINS = "공개 tossmini.com Origin을 포함해야 해요.";
    return;
  }

  if (!normalizedHosts.some((host) => host.endsWith(".private-apps.tossmini.com"))) {
    errors.TOSS_ALLOWED_ORIGINS = "QR/비공개 테스트용 private-apps.tossmini.com Origin을 포함해야 해요.";
  }
}

function validateAppleEnvironment(value: string | undefined, errors: Record<string, string>) {
  const input = String(value || "").trim();
  if (!input) return;
  if (!["sandbox", "production"].includes(input)) {
    errors.APPLE_ENVIRONMENT = "Apple 영수증 환경은 sandbox 또는 production 이어야 해요.";
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

function validateDistinctSecrets(
  left: string | undefined,
  right: string | undefined,
  leftKey: string,
  rightKey: string,
  errors: Record<string, string>
) {
  const leftValue = String(left || "").trim();
  const rightValue = String(right || "").trim();
  if (!leftValue || !rightValue || leftValue !== rightValue) return;
  errors[leftKey] ||= "Report Token Secret과 1회 무료 판정 Secret은 서로 달라야 해요.";
  errors[rightKey] ||= "Report Token Secret과 1회 무료 판정 Secret은 서로 달라야 해요.";
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

function validateGooglePlayUploadSigning(values: Record<string, string>, errors: Record<string, string>) {
  const signingValues = [
    values.GOOGLE_PLAY_UPLOAD_KEYSTORE_BASE64,
    values.GOOGLE_PLAY_UPLOAD_KEYSTORE_PASSWORD,
    values.GOOGLE_PLAY_UPLOAD_KEY_ALIAS,
    values.GOOGLE_PLAY_UPLOAD_KEY_PASSWORD
  ].map((value) => String(value || "").trim());
  if (!signingValues.some(Boolean)) return;

  requireLaunchValue(values.GOOGLE_PLAY_UPLOAD_KEYSTORE_BASE64, "GOOGLE_PLAY_UPLOAD_KEYSTORE_BASE64", "Google Play 업로드 Keystore Base64", errors);
  requireLaunchValue(
    values.GOOGLE_PLAY_UPLOAD_KEYSTORE_PASSWORD,
    "GOOGLE_PLAY_UPLOAD_KEYSTORE_PASSWORD",
    "Google Play Keystore Password",
    errors
  );
  requireLaunchValue(values.GOOGLE_PLAY_UPLOAD_KEY_ALIAS, "GOOGLE_PLAY_UPLOAD_KEY_ALIAS", "Google Play Key Alias", errors);
  requireLaunchValue(values.GOOGLE_PLAY_UPLOAD_KEY_PASSWORD, "GOOGLE_PLAY_UPLOAD_KEY_PASSWORD", "Google Play Key Password", errors);
  validateBase64(
    values.GOOGLE_PLAY_UPLOAD_KEYSTORE_BASE64,
    "GOOGLE_PLAY_UPLOAD_KEYSTORE_BASE64",
    "Google Play 업로드 Keystore Base64",
    errors
  );
  validateMinimumLength(
    values.GOOGLE_PLAY_UPLOAD_KEYSTORE_PASSWORD,
    "GOOGLE_PLAY_UPLOAD_KEYSTORE_PASSWORD",
    "Google Play Keystore Password",
    8,
    errors
  );
  validatePattern(
    values.GOOGLE_PLAY_UPLOAD_KEY_ALIAS,
    "GOOGLE_PLAY_UPLOAD_KEY_ALIAS",
    "Google Play Key Alias",
    /^\S+$/,
    "공백 없는 alias 여야 해요.",
    errors
  );
  validateMinimumLength(values.GOOGLE_PLAY_UPLOAD_KEY_PASSWORD, "GOOGLE_PLAY_UPLOAD_KEY_PASSWORD", "Google Play Key Password", 8, errors);
}

function validateBase64(value: string | undefined, key: string, label: string, errors: Record<string, string>) {
  const input = String(value || "").trim();
  if (!input) {
    return;
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input) || input.length % 4 === 1) {
    errors[key] = `${label}은 base64 문자열이어야 해요.`;
  }
}

function requireLaunchValue(value: string | undefined, key: string, label: string, errors: Record<string, string>) {
  const input = String(value || "").trim();
  if (!input) errors[key] = `${label}을 입력하세요.`;
}

function validateNoLaunchPlaceholders(values: Record<string, string>, errors: Record<string, string>) {
  const inactiveKeys = inactivePaymentProviderKeys(values);
  for (const field of launchEnvFields) {
    if (inactiveKeys.has(field.key)) continue;
    const input = String(values[field.key] || "").trim();
    if (!input || errors[field.key]) continue;
    if (hasLaunchPlaceholder(input)) {
      errors[field.key] = `${field.label}에 예시값이 아닌 실제 출시 값을 입력하세요.`;
    }
  }
}

function inactivePaymentProviderKeys(values: Record<string, string>) {
  const paymentProvider = normalizePaymentProvider(values.PAYMENT_PROVIDER);
  if (paymentProvider === "polar") return new Set(tossPaymentKeys);
  if (paymentProvider === "toss") return new Set(polarPaymentKeys);
  return new Set([...tossPaymentKeys, ...polarPaymentKeys]);
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
