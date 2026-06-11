import { publicSummary } from "./scanner";
import { getScanRepository } from "./repository";
import { runScan } from "./scan-runner";
import type { CreateScanInput, ScanJob } from "./types";

interface CreateStoredScanOptions {
  origin?: string;
}

export async function createStoredScan(input: CreateScanInput, options: CreateStoredScanOptions = {}): Promise<ScanJob> {
  const job = await runScan(input, { origin: options.origin });
  return getScanRepository().create(job);
}

export function getStoredScan(scanId: string): Promise<ScanJob | null> {
  return getScanRepository().get(scanId);
}

export async function getStoredSummary(scanId: string) {
  const job = await getStoredScan(scanId);
  return job ? publicSummary(job) : null;
}

export function deleteStoredScan(scanId: string): Promise<void> {
  return getScanRepository().delete(scanId);
}

export function extendStoredScanExpiration(scanId: string, expiresAt: string): Promise<void> {
  return getScanRepository().extendExpiration(scanId, expiresAt);
}

export function pruneExpiredScans(now?: Date): Promise<number> {
  return getScanRepository().pruneExpired(now);
}
