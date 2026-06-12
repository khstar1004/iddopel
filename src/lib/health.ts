import { hasPostgresUrl } from "./postgres-env";

export interface HealthStatus {
  ok: true;
  service: "id-doppelganger";
  timestamp: string;
  storage: "postgres" | "file";
  scanProvider: string;
  paymentProvider: string;
}

export function buildHealthStatus(env: Record<string, string | undefined>, now = new Date()): HealthStatus {
  return {
    ok: true,
    service: "id-doppelganger",
    timestamp: now.toISOString(),
    storage: hasPostgresUrl(env) ? "postgres" : "file",
    scanProvider: normalizeProvider(env.SCAN_PROVIDER, "maigret"),
    paymentProvider: normalizeProvider(env.PAYMENT_PROVIDER, "mock")
  };
}

function normalizeProvider(value: string | undefined, fallback: string) {
  return value?.trim().toLowerCase() || fallback;
}
