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
      const quota = isAdminRequest
        ? null
        : await consumeBetaScanQuotaForRequest(request, settings);

      if (quota && !quota.allowed) {
        const response = jsonError(
          "BETA_FREE_SCAN_LIMITED",
          "무료 검색 티켓을 모두 사용했어요. 추천 링크를 공유하면 친구 방문마다 티켓 1장이 추가돼요.",
          429,
          {
            limit: quota.limit,
            remaining: quota.remaining,
            baseRemaining: quota.baseRemaining,
            bonusRemaining: quota.bonusRemaining,
            resetAt: quota.resetAt,
            retryAfterSeconds: quota.retryAfterSeconds,
            referralCode: quota.referralCode
          }
        );
        if (quota.retryAfterSeconds) response.headers.set("Retry-After", String(quota.retryAfterSeconds));
        setQuotaHeaders(response, quota);
        return withTossCors(request, response);
      }

      const job = await createStoredScan(input, {
        origin: new URL(request.url).origin
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

async function consumeBetaScanQuotaForRequest(request: Request, settings: BetaScanQuotaSettings) {
  const wallet = await resolveTicketWalletSession(request);
  const ownerToken = wallet?.ownerToken ?? request.headers.get("x-scan-owner-token");
  return consumeBetaScanQuota(request, ownerToken, settings, { accountScoped: Boolean(wallet) });
}

function setQuotaHeaders(
  response: NextResponse,
  quota: {
    limit: number;
    remaining: number;
    resetAt: string;
    baseRemaining?: number;
    bonusRemaining?: number;
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
  if (quota.referralCode) {
    response.headers.set("x-beta-free-ticket-referral-code", quota.referralCode);
  }
}
