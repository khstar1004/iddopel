import { NextResponse } from "next/server";
import { handleApiError, jsonError, readJson } from "@/lib/api";
import { acquireBetaScanLoadSlot, consumeBetaScanQuota, getBetaScanSettingsStore } from "@/lib/beta-scan-quota";
import { isDevAdminRequest } from "@/lib/dev-admin";
import { publicScanResponse } from "@/lib/scan-response";
import { createStoredScan } from "@/lib/scan-store";
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
        : await consumeBetaScanQuota(request, request.headers.get("x-scan-owner-token"), settings);

      const freePreviewLocked = Boolean(quota && !quota.allowed);
      const job = await createStoredScan(input, {
        origin: new URL(request.url).origin,
        freePreviewLocked,
        freePreviewLockReason: freePreviewLocked ? "BETA_FREE_SCAN_LIMITED" : undefined
      });
      const response = NextResponse.json(publicScanResponse(job), { status: 201 });
      if (quota) setQuotaHeaders(response, quota);
      if (freePreviewLocked) {
        response.headers.set("x-beta-free-preview-locked", "true");
      }
      return withTossCors(request, response);
    } finally {
      await loadLease?.release?.();
    }
  } catch (error) {
    return withTossCors(request, handleApiError(error));
  }
}

function setQuotaHeaders(
  response: NextResponse,
  quota: { limit: number; remaining: number; resetAt: string }
) {
  response.headers.set("x-beta-free-scan-limit", String(quota.limit));
  response.headers.set("x-beta-free-scans-remaining", String(quota.remaining));
  response.headers.set("x-beta-free-scan-reset-at", quota.resetAt);
}
