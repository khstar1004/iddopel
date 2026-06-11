import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { MonitoringSubscription, PublicMonitoringSubscription, ScanPurpose } from "./types";
import { normalizeUsername, ValidationError } from "./validation";

const ownerTokenBytes = 32;

export function generateOwnerToken() {
  return randomBytes(ownerTokenBytes).toString("base64url");
}

export function hashOwnerToken(ownerToken: string) {
  if (!isValidOwnerToken(ownerToken)) {
    throw new ValidationError("VALIDATION_ERROR", "모니터링 소유 토큰이 올바르지 않아요.");
  }

  return createHash("sha256").update(ownerToken).digest("hex");
}

export function isValidOwnerToken(ownerToken: string) {
  return /^[A-Za-z0-9_-]{32,128}$/.test(ownerToken);
}

export function parseOwnerTokenHeader(request: Request) {
  const ownerToken = request.headers.get("x-monitoring-owner-token")?.trim() ?? "";
  return hashOwnerToken(ownerToken);
}

export function normalizeMonitoringUsernames(raw: unknown) {
  if (!Array.isArray(raw)) {
    throw new ValidationError("VALIDATION_ERROR", "모니터링할 아이디 목록을 입력해 주세요.");
  }

  const normalized = raw.map((value) => normalizeUsername(value));
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of normalized) {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(value);
    }
  }

  if (unique.length < 1) {
    throw new ValidationError("VALIDATION_ERROR", "모니터링할 아이디를 1개 이상 입력해 주세요.");
  }

  if (unique.length > 3) {
    throw new ValidationError("VALIDATION_ERROR", "월간 모니터링은 아이디 3개까지 등록할 수 있어요.");
  }

  return unique;
}

export function nextMonthlyRun(from = new Date()) {
  const next = new Date(from);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next.toISOString();
}

export function createMonitoringSubscription(input: {
  ownerTokenHash: string;
  usernames: string[];
  purpose: ScanPurpose;
  now?: Date;
}): MonitoringSubscription {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();

  return {
    monitoringId: `mon_${randomUUID().replaceAll("-", "").slice(0, 24)}`,
    ownerTokenHash: input.ownerTokenHash,
    usernames: input.usernames,
    purpose: input.purpose,
    cadence: "MONTHLY",
    status: "ACTIVE",
    latestScanIds: {},
    createdAt: nowIso,
    updatedAt: nowIso,
    lastRunAt: null,
    nextRunAt: nextMonthlyRun(now)
  };
}

export function updateMonitoringSubscription(
  existing: MonitoringSubscription,
  input: { usernames: string[]; purpose: ScanPurpose; now?: Date }
): MonitoringSubscription {
  return {
    ...existing,
    usernames: input.usernames,
    purpose: input.purpose,
    status: "ACTIVE",
    updatedAt: (input.now ?? new Date()).toISOString()
  };
}

export function markMonitoringRun(
  existing: MonitoringSubscription,
  input: { latestScanIds: Record<string, string>; now?: Date }
): MonitoringSubscription {
  const now = input.now ?? new Date();
  return {
    ...existing,
    latestScanIds: {
      ...existing.latestScanIds,
      ...input.latestScanIds
    },
    status: "ACTIVE",
    updatedAt: now.toISOString(),
    lastRunAt: now.toISOString(),
    nextRunAt: nextMonthlyRun(now)
  };
}

export function publicMonitoring(subscription: MonitoringSubscription): PublicMonitoringSubscription {
  const { ownerTokenHash: _ownerTokenHash, ...publicFields } = subscription;
  return publicFields;
}
