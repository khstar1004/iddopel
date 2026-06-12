import { getMonitoringRepository } from "./monitoring-repository";
import {
  createMonitoringSubscription,
  generateOwnerToken,
  hashOwnerToken,
  isValidOwnerToken,
  markMonitoringRun,
  normalizeMonitoringUsernames,
  publicMonitoring,
  updateMonitoringSubscription
} from "./monitoring";
import { createStoredScan, getStoredSummary } from "./scan-store";
import { extendStoredScanExpiration } from "./scan-store";
import { expiresAtForMonitoring } from "./retention";
import type { CreateScanInput, MonitoringSubscription, PublicMonitoringScanSnapshot, PublicMonitoringSubscription, ScanJob, ScanPurpose } from "./types";
import { ValidationError } from "./validation";

const purposeMap: Record<string, ScanPurpose> = {
  self_check: "SELF_CHECK",
  brand_check: "BRAND_CHECK",
  nickname_check: "NICKNAME_CHECK",
  SELF_CHECK: "SELF_CHECK",
  BRAND_CHECK: "BRAND_CHECK",
  NICKNAME_CHECK: "NICKNAME_CHECK"
};

export interface RegisterMonitoringResult {
  ownerToken: string;
  monitoring: PublicMonitoringSubscription;
}

export async function registerMonitoring(input: {
  ownerToken?: unknown;
  usernames: unknown;
  purpose?: unknown;
}): Promise<RegisterMonitoringResult> {
  const ownerToken = resolveOwnerToken(input.ownerToken);
  const ownerTokenHash = hashOwnerToken(ownerToken);
  const usernames = normalizeMonitoringUsernames(input.usernames);
  const purpose = parseMonitoringPurpose(input.purpose);
  const repository = getMonitoringRepository();
  const existing = await repository.getByOwnerTokenHash(ownerTokenHash);
  const subscription = existing
    ? updateMonitoringSubscription(existing, { usernames, purpose })
    : createMonitoringSubscription({ ownerTokenHash, usernames, purpose });
  const saved = await repository.upsert(subscription);

  return {
    ownerToken,
    monitoring: publicMonitoring(saved)
  };
}

export async function getMonitoringForOwner(ownerToken: string): Promise<PublicMonitoringSubscription | null> {
  const subscription = await getMonitoringRepository().getByOwnerTokenHash(hashOwnerToken(ownerToken));
  return subscription ? publicMonitoringWithLatestScans(subscription) : null;
}

export async function deleteMonitoringForOwner(monitoringId: string, ownerToken: string): Promise<PublicMonitoringSubscription | null> {
  const subscription = await getMonitoringRepository().markDeleted(monitoringId, hashOwnerToken(ownerToken));
  return subscription ? publicMonitoring(subscription) : null;
}

export async function runDueMonitoringSubscriptions(options: {
  now?: Date;
  limit?: number;
  scan?: (input: CreateScanInput) => Promise<ScanJob>;
  extendScanExpiration?: (scanId: string, expiresAt: string) => Promise<void>;
} = {}) {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 3;
  const scan = options.scan ?? createStoredScan;
  const extendScanExpiration = options.extendScanExpiration ?? extendStoredScanExpiration;
  const repository = getMonitoringRepository();
  const due = await repository.listDue(now, limit);
  const processed: PublicMonitoringSubscription[] = [];
  const failures: Array<{ monitoringId: string; message: string }> = [];
  let scanCount = 0;

  for (const subscription of due) {
    try {
      const latestScanIds: Record<string, string> = {};
      for (const username of subscription.usernames) {
        const job = await scan({ username, purpose: subscription.purpose, mode: "QUICK" });
        await extendScanExpiration(job.scanId, expiresAtForMonitoring(now));
        latestScanIds[username] = job.scanId;
        scanCount += 1;
      }
      const saved = await repository.upsert(markMonitoringRun(subscription, { latestScanIds, now }));
      processed.push(publicMonitoring(saved));
    } catch (error) {
      failures.push({
        monitoringId: subscription.monitoringId,
        message: error instanceof Error ? error.message : "monitoring scan failed"
      });
    }
  }

  return {
    ok: failures.length === 0,
    checked: due.length,
    processed: processed.length,
    scanCount,
    monitoring: processed,
    failures
  };
}

function resolveOwnerToken(raw: unknown) {
  if (raw === undefined || raw === null || raw === "") return generateOwnerToken();
  if (typeof raw !== "string" || !isValidOwnerToken(raw.trim())) {
    throw new ValidationError("VALIDATION_ERROR", "모니터링 소유 토큰이 올바르지 않아요.");
  }
  return raw.trim();
}

function parseMonitoringPurpose(raw: unknown): ScanPurpose {
  if (raw === undefined || raw === null || raw === "") return "SELF_CHECK";
  const purpose = typeof raw === "string" ? purposeMap[raw] : undefined;
  if (!purpose) {
    throw new ValidationError("VALIDATION_ERROR", "모니터링 목적을 선택해 주세요.");
  }
  return purpose;
}

async function publicMonitoringWithLatestScans(subscription: MonitoringSubscription): Promise<PublicMonitoringSubscription> {
  const snapshots: PublicMonitoringScanSnapshot[] = [];

  for (const username of subscription.usernames) {
    const scanId = subscription.latestScanIds[username];
    if (!scanId) continue;

    const summary = await getStoredSummary(scanId);
    if (!summary) continue;

    snapshots.push({
      username,
      scanId,
      foundCount: summary.foundCount,
      checkedCount: summary.checkedCount,
      exposureScore: summary.exposureScore,
      createdAt: summary.createdAt
    });
  }

  return {
    ...publicMonitoring(subscription),
    latestScans: snapshots
  };
}
