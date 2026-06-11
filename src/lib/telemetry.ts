import { randomUUID } from "node:crypto";

export type TelemetryEventName = "page_view" | "client_error" | "unhandled_rejection" | "web_vital";

export interface TelemetryEvent {
  name: TelemetryEventName;
  path: string;
  occurredAt: string;
  metric?: {
    name: "FCP" | "LCP" | "CLS" | "TTFB";
    value: number;
    rating?: "good" | "needs-improvement" | "poor";
  };
  error?: {
    message: string;
    source?: string;
    line?: number;
    column?: number;
  };
}

export interface TelemetryLog extends TelemetryEvent {
  event: "id_doppelganger_telemetry";
  requestId: string;
  receivedAt: string;
  release: string;
  environment: string;
}

type TelemetryMetric = NonNullable<TelemetryEvent["metric"]>;

const eventNames = new Set<TelemetryEventName>(["page_view", "client_error", "unhandled_rejection", "web_vital"]);
const metricNames = new Set<TelemetryMetric["name"]>(["FCP", "LCP", "CLS", "TTFB"]);
const metricRatings = new Set<TelemetryMetric["rating"]>(["good", "needs-improvement", "poor"]);

export class TelemetryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelemetryValidationError";
  }
}

export function parseTelemetryPayload(body: unknown, now = new Date()): TelemetryEvent {
  if (!body || typeof body !== "object") {
    throw new TelemetryValidationError("Telemetry payload must be an object.");
  }

  const record = body as Record<string, unknown>;
  const name = parseEventName(record.name);
  const path = normalizePath(record.path);
  const occurredAt = parseOccurredAt(record.occurredAt, now);
  const event: TelemetryEvent = { name, path, occurredAt };

  if (name === "web_vital") {
    event.metric = parseMetric(record.metric);
  }

  if (name === "client_error" || name === "unhandled_rejection") {
    event.error = parseClientError(record.error);
  }

  return event;
}

export function buildTelemetryLog(event: TelemetryEvent, env: Record<string, string | undefined>, requestId: string = randomUUID(), now = new Date()): TelemetryLog {
  return {
    ...event,
    event: "id_doppelganger_telemetry",
    requestId,
    receivedAt: now.toISOString(),
    release: boundedString(env.RELEASE_VERSION ?? env.VERCEL_GIT_COMMIT_SHA ?? "local", 80),
    environment: boundedString(env.VERCEL_ENV ?? env.NODE_ENV ?? "development", 40)
  };
}

export function redactTelemetryText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/g, "[redacted-phone]")
    .replace(/\b\d{6}[-\s]?[1-4]\d{6}\b/g, "[redacted-id]")
    .replace(/\b(token|secret|key|password)=([^&\s]+)/gi, "$1=[redacted]");
}

function parseEventName(value: unknown): TelemetryEventName {
  if (typeof value !== "string" || !eventNames.has(value as TelemetryEventName)) {
    throw new TelemetryValidationError("Unsupported telemetry event name.");
  }
  return value as TelemetryEventName;
}

function normalizePath(value: unknown) {
  if (typeof value !== "string" || value.length > 300) {
    throw new TelemetryValidationError("Telemetry path is invalid.");
  }

  try {
    const parsed = new URL(value, "https://id-doppelganger.local");
    if (!parsed.pathname.startsWith("/")) {
      throw new Error("Invalid path");
    }
    return parsed.pathname.slice(0, 200);
  } catch {
    throw new TelemetryValidationError("Telemetry path is invalid.");
  }
}

function parseOccurredAt(value: unknown, now: Date) {
  if (typeof value !== "string") return now.toISOString();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return now.toISOString();

  const maxSkewMs = 24 * 60 * 60 * 1000;
  if (Math.abs(now.getTime() - parsed.getTime()) > maxSkewMs) {
    return now.toISOString();
  }

  return parsed.toISOString();
}

function parseMetric(value: unknown): TelemetryMetric {
  if (!value || typeof value !== "object") {
    throw new TelemetryValidationError("Telemetry metric is required.");
  }

  const record = value as Record<string, unknown>;
  if (typeof record.name !== "string" || !metricNames.has(record.name as TelemetryMetric["name"])) {
    throw new TelemetryValidationError("Telemetry metric name is invalid.");
  }

  const numericValue = typeof record.value === "number" ? record.value : Number(record.value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new TelemetryValidationError("Telemetry metric value is invalid.");
  }

  const metric: TelemetryMetric = {
    name: record.name as TelemetryMetric["name"],
    value: Math.round(Math.min(numericValue, 120_000) * 1000) / 1000
  };

  if (typeof record.rating === "string" && metricRatings.has(record.rating as TelemetryMetric["rating"])) {
    metric.rating = record.rating as TelemetryMetric["rating"];
  }

  return metric;
}

function parseClientError(value: unknown): NonNullable<TelemetryEvent["error"]> {
  if (!value || typeof value !== "object") {
    return { message: "unknown client error" };
  }

  const record = value as Record<string, unknown>;
  const error: NonNullable<TelemetryEvent["error"]> = {
    message: boundedString(redactTelemetryText(typeof record.message === "string" ? record.message : "unknown client error"), 220)
  };

  if (typeof record.source === "string") {
    error.source = normalizePath(record.source);
  }
  if (typeof record.line === "number" && Number.isInteger(record.line) && record.line >= 0 && record.line < 1_000_000) {
    error.line = record.line;
  }
  if (typeof record.column === "number" && Number.isInteger(record.column) && record.column >= 0 && record.column < 1_000_000) {
    error.column = record.column;
  }

  return error;
}

function boundedString(value: string, maxLength: number) {
  return redactTelemetryText(value).trim().slice(0, maxLength) || "unknown";
}
