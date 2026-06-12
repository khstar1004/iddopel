import { NextResponse } from "next/server";
import { handleApiError, jsonError, readJson } from "@/lib/api";
import { consumeBetaScanQuota } from "@/lib/beta-scan-quota";
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
    const quota = isAdminRequest
      ? null
      : await consumeBetaScanQuota(request, request.headers.get("x-scan-owner-token"));

    if (quota && !quota.allowed) {
      const retryAfterSeconds = String(quota.retryAfterSeconds ?? 3600);
      const response = jsonError(
        "BETA_FREE_SCAN_LIMITED",
        `베타 무료검색은 ${quota.limit}회까지 가능해요. ${retryAfterSeconds}초 후 다시 시도해 주세요.`,
        429,
        {
          limit: quota.limit,
          used: quota.used,
          remaining: quota.remaining,
          resetAt: quota.resetAt
        }
      );
      response.headers.set("Retry-After", retryAfterSeconds);
      setQuotaHeaders(response, quota);
      return withTossCors(request, response);
    }

    const input = parseCreateScanInput(await readJson(request));
    const job = await createStoredScan(input, { origin: new URL(request.url).origin });
    const response = NextResponse.json(publicScanResponse(job), { status: 201 });
    if (quota) setQuotaHeaders(response, quota);
    return withTossCors(request, response);
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
