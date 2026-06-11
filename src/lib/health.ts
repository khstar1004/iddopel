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
    storage: env.DATABASE_URL?.startsWith("postgres") ? "postgres" : "file",
    scanProvider: normalizeProvider(env.SCAN_PROVIDER, "auto"),
    paymentProvider: normalizeProvider(env.PAYMENT_PROVIDER, "mock")
  };
}

function normalizeProvider(value: string | undefined, fallback: string) {
  return value?.trim().toLowerCase() || fallback;
}
