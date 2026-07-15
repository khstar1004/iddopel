import { NextResponse } from "next/server";
import { handleApiError, jsonError, readJson } from "@/lib/api";
import {
  acquireBetaScanLoadSlot,
  consumeBetaScanQuota,
  getBetaScanSettingsStore,
  type BetaScanQuotaSettings
} from "@/lib/beta-scan-quota";
import { isDevAdminRequest } from "@/lib/dev-admin";
import { publicScanResponse } from "@/lib/scan-response";
import { createStoredScan } from "@/lib/scan-store";
import { hashScanTicketAccessOwner } from "@/lib/scan-ticket-access";
import { resolveTicketWalletSession } from "@/lib/ticket-wallet";
import { createTossPreflightResponse, rejectDisallowedTossCors, withTossCors } from "@/lib/toss-cors";
import { parseCreateScanInput } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export function OPTIONS(request: Request) {
  return createTossPreflightResponse(request, ["POST"]);
}

export async function POST(request: Request) {
  const corsError = rejectDisallowedTossCors(request);
  if (corsError) return corsError;

  try {
    const isAdminRequest = isDevAdminRequest(request);
    const settings = await getBetaScanSettingsStore().get();

    if (!isAdminRequest && !settings.publicScanEnabled) {
      return withTossCors(
        request,
        jsonError("BETA_SCAN_DISABLED", "출시 전 점검을 위해 잠시 검색을 막아두었어요.", 503)
      );
    }

    const input = parseCreateScanInput(await readJson(request));
    const loadLease = isAdminRequest ? null : await acquireBetaScanLoadSlot(settings);

    if (loadLease && !loadLease.allowed) {
      const retryAfterSeconds = String(loadLease.retryAfterSeconds);
      const response = jsonError(
        "BETA_SCAN_BUSY",
        "검색 요청이 몰려 잠시 대기 중이에요. 잠시 후 다시 시도해 주세요.",
        503,
        {
          active: loadLease.active,
          limit: loadLease.limit,
          retryAfterSeconds: loadLease.retryAfterSeconds
        }
      );
      response.headers.set("Retry-After", retryAfterSeconds);
      response.headers.set("x-beta-scan-active", String(loadLease.active));
      response.headers.set("x-beta-scan-concurrency-limit", String(loadLease.limit));
      return withTossCors(request, response);
    }

    try {
      const ticketPrincipal = isAdminRequest ? null : await resolveScanTicketPrincipal(request);
      const quota = ticketPrincipal ? await consumeBetaScanQuotaForPrincipal(request, ticketPrincipal, settings) : null;
      const paywalledForMissingTicket = Boolean(quota && !quota.allowed);

      const job = await createStoredScan(input, {
        origin: new URL(request.url).origin,
        freePreviewLocked: paywalledForMissingTicket,
        freePreviewLockReason: paywalledForMissingTicket ? "BETA_FREE_SCAN_LIMITED" : undefined,
        ticketAccessOwnerTokenHash: quota?.allowed ? hashScanTicketAccessOwner(ticketPrincipal?.ownerToken) : null
      });
      const response = NextResponse.json(publicScanResponse(job), { status: 201 });
      if (quota) setQuotaHeaders(response, quota);
      return withTossCors(request, response);
    } finally {
      await loadLease?.release?.();
    }
  } catch (error) {
    return withTossCors(request, handleApiError(error));
  }
}

async function resolveScanTicketPrincipal(request: Request) {
  const wallet = await resolveTicketWalletSession(request);
  const ownerToken = wallet?.ownerToken ?? request.headers.get("x-scan-owner-token");
  return {
    ownerToken,
    accountScoped: Boolean(wallet)
  };
}

async function consumeBetaScanQuotaForPrincipal(
  request: Request,
  principal: Awaited<ReturnType<typeof resolveScanTicketPrincipal>>,
  settings: BetaScanQuotaSettings
) {
  return consumeBetaScanQuota(request, principal.ownerToken, settings, { accountScoped: principal.accountScoped });
}

function setQuotaHeaders(
  response: NextResponse,
  quota: {
    limit: number;
    remaining: number;
    resetAt: string;
    baseRemaining?: number;
    bonusRemaining?: number;
    lifetime?: boolean;
    referralCode?: string | null;
  }
) {
  response.headers.set("x-beta-free-scan-limit", String(quota.limit));
  response.headers.set("x-beta-free-scans-remaining", String(quota.remaining));
  response.headers.set("x-beta-free-scan-reset-at", quota.resetAt);
  if (quota.baseRemaining !== undefined) {
    response.headers.set("x-beta-free-ticket-base-remaining", String(quota.baseRemaining));
  }
  if (quota.bonusRemaining !== undefined) {
    response.headers.set("x-beta-free-ticket-bonus-remaining", String(quota.bonusRemaining));
  }
  if (quota.lifetime !== undefined) {
    response.headers.set("x-beta-free-scan-lifetime", String(quota.lifetime));
  }
  if (quota.referralCode) {
    response.headers.set("x-beta-free-ticket-referral-code", quota.referralCode);
  }
}
