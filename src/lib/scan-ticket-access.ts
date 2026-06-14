import { createHash, timingSafeEqual } from "node:crypto";
import { resolveTicketWalletSession } from "./ticket-wallet";
import type { ScanJob } from "./types";

const hashPrefix = "scan-ticket-access-owner:";

export function hashScanTicketAccessOwner(ownerToken: string | null | undefined) {
  const normalized = normalizeOwnerToken(ownerToken);
  if (!normalized) return null;

  return createHash("sha256").update(`${hashPrefix}${normalized}`).digest("hex");
}

export async function canAccessTicketUnlockedScan(job: ScanJob, request: Request) {
  if (!job.ticketAccessOwnerTokenHash) return false;

  const wallet = await resolveTicketWalletSession(request);
  const ownerToken = wallet?.ownerToken ?? request.headers.get("x-scan-owner-token");
  return verifyScanTicketAccessOwner(ownerToken, job.ticketAccessOwnerTokenHash);
}

function verifyScanTicketAccessOwner(ownerToken: string | null | undefined, expectedHash: string) {
  const actualHash = hashScanTicketAccessOwner(ownerToken);
  if (!actualHash) return false;

  const actual = Buffer.from(actualHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;

  return timingSafeEqual(actual, expected);
}

function normalizeOwnerToken(ownerToken: string | null | undefined) {
  const normalized = ownerToken?.trim().slice(0, 256) ?? "";
  return normalized.length > 0 ? normalized : null;
}
