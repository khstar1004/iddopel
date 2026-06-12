import { NextResponse } from "next/server";
import { handleApiError, jsonError, readJson } from "@/lib/api";
import { FirstFreeReportError, firstFreeRequestFingerprint, grantFirstFreeReportAccess } from "@/lib/entitlements";
import { getStoredScan } from "@/lib/scan-store";
import { isWebDetailedReportPaywallEnabled, webPaywallEnabledMessage } from "@/lib/web-report-paywall";
import { createTossPreflightResponse, rejectDisallowedTossCors, withTossCors } from "@/lib/toss-cors";

interface RouteContext {
  params: Promise<{ scanId: string }>;
}

export function OPTIONS(request: Request) {
  return createTossPreflightResponse(request, ["POST"]);
}

export async function POST(request: Request, context: RouteContext) {
  let softFailure = false;

  const corsError = rejectDisallowedTossCors(request);
  if (corsError) return corsError;

  try {
    const { scanId } = await context.params;
    const scan = await getStoredScan(scanId);

    if (!scan) {
      return withTossCors(request, jsonError("NOT_FOUND", "점검 결과를 찾을 수 없어요.", 404));
    }

    const body = (await readJson(request).catch(() => ({}))) as Record<string, unknown>;
    softFailure = body.soft === true;

    if (isWebDetailedReportPaywallEnabled()) {
      return withTossCors(
        request,
        jsonError("WEB_PAYWALL_ENABLED", webPaywallEnabledMessage(), softFailure ? 200 : 402)
      );
    }

    const ownerToken = typeof body.ownerToken === "string" && body.ownerToken.length > 0 ? body.ownerToken : null;
    const grant = await grantFirstFreeReportAccess(scan, ownerToken, firstFreeRequestFingerprint(request));

    return withTossCors(
      request,
      NextResponse.json(
        {
          ok: true,
          access: "FIRST_FREE",
          scanId,
          ownerToken: grant.ownerToken,
          reportToken: grant.token,
          reportUrl: `/reports/${scanId}?token=${encodeURIComponent(grant.token)}`,
          reused: grant.reused
        },
        { status: grant.reused ? 200 : 201 }
      )
    );
  } catch (error) {
    if (error instanceof FirstFreeReportError) {
      if (softFailure && error.code === "FIRST_FREE_USED") {
        return withTossCors(request, jsonError(error.code, error.message, 200));
      }
      return withTossCors(request, jsonError(error.code, error.message, error.status));
    }
    return withTossCors(request, handleApiError(error));
  }
}
