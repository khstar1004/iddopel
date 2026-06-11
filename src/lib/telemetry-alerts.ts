import type { TelemetryLog } from "./telemetry";

type AlertProvider = "generic" | "slack" | "discord";
type FetchLike = typeof fetch;

export interface TelemetryAlertPayload {
  headers: Record<string, string>;
  body: unknown;
}

export interface TelemetryAlertDelivery {
  attempted: boolean;
  ok: boolean;
  status?: number;
  reason?: string;
}

export function shouldSendTelemetryAlert(log: TelemetryLog) {
  if (log.name === "client_error" || log.name === "unhandled_rejection") return true;
  return log.name === "web_vital" && log.metric?.rating === "poor";
}

export function buildTelemetryAlertPayload(
  log: TelemetryLog,
  env: Record<string, string | undefined>
): TelemetryAlertPayload {
  const provider = parseProvider(env.ALERT_WEBHOOK_PROVIDER);
  const summary = `[ID 도플갱어] ${log.name} on ${log.path}`;
  const fields = [
    `requestId=${log.requestId}`,
    `release=${log.release}`,
    `env=${log.environment}`,
    log.error?.message ? `message=${log.error.message}` : null,
    log.metric ? `metric=${log.metric.name}:${log.metric.value}:${log.metric.rating ?? "unknown"}` : null,
    safeRunbook(env.ALERT_RUNBOOK_URL) ? `runbook=${env.ALERT_RUNBOOK_URL}` : null
  ].filter(Boolean);

  if (provider === "slack") {
    return {
      headers: { "Content-Type": "application/json" },
      body: {
        text: summary,
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: `*${summary}*` }
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: fields.map((field) => `\`${field}\``).join("\n") }
          }
        ]
      }
    };
  }

  if (provider === "discord") {
    return {
      headers: { "Content-Type": "application/json" },
      body: {
        content: summary,
        embeds: [
          {
            title: "Launch telemetry alert",
            description: fields.join("\n"),
            color: 15_167_430
          }
        ]
      }
    };
  }

  return {
    headers: { "Content-Type": "application/json" },
    body: {
      event: "id_doppelganger_alert",
      summary,
      severity: "page",
      requestId: log.requestId,
      release: log.release,
      environment: log.environment,
      telemetryName: log.name,
      path: log.path,
      error: log.error,
      metric: log.metric,
      runbookUrl: safeRunbook(env.ALERT_RUNBOOK_URL) ? env.ALERT_RUNBOOK_URL : undefined
    }
  };
}

export async function sendTelemetryAlert(
  log: TelemetryLog,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: FetchLike = fetch
): Promise<TelemetryAlertDelivery> {
  if (!shouldSendTelemetryAlert(log)) return { attempted: false, ok: true, reason: "not alertable" };

  const webhookUrl = env.ALERT_WEBHOOK_URL?.trim();
  if (!webhookUrl) return { attempted: false, ok: true, reason: "webhook not configured" };
  if (!isHttpsUrl(webhookUrl)) return { attempted: false, ok: false, reason: "unsafe webhook url" };

  const timeoutMs = parseTimeout(env.ALERT_WEBHOOK_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const payload = buildTelemetryAlertPayload(log, env);

  try {
    const response = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: payload.headers,
      body: JSON.stringify(payload.body),
      signal: controller.signal
    });

    return {
      attempted: true,
      ok: response.ok,
      status: response.status,
      reason: response.ok ? undefined : `webhook returned ${response.status}`
    };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      reason: error instanceof Error ? error.message : "webhook request failed"
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseProvider(value: string | undefined): AlertProvider {
  return value === "slack" || value === "discord" || value === "generic" ? value : "generic";
}

function parseTimeout(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1500;
  return Math.min(Math.max(parsed, 250), 5000);
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function safeRunbook(value: string | undefined) {
  return Boolean(value && isHttpsUrl(value));
}
