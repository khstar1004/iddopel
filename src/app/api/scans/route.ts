import { NextResponse } from "next/server";
import { handleApiError, jsonError, readJson } from "@/lib/api";
import { isDevAdminRequest } from "@/lib/dev-admin";
import { assertRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createStoredScan } from "@/lib/scan-store";
import { publicSummary } from "@/lib/scanner";
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
    if (!isDevAdminRequest(request)) {
      try {
        assertRateLimit(rateLimitKey(request, "anonymous"), 12, 60 * 60 * 1000);
      } catch (error) {
        const seconds = error instanceof Error && error.message.startsWith("RATE_LIMIT:")
          ? error.message.split(":")[1]
          : "3600";
        return withTossCors(request, jsonError("RATE_LIMITED", `${seconds}초 후 다시 점검할 수 있어요.`, 429));
      }
    }

    const input = parseCreateScanInput(await readJson(request));
    const job = await createStoredScan(input, { origin: new URL(request.url).origin });
    return withTossCors(request, NextResponse.json(publicSummary(job), { status: 201 }));
  } catch (error) {
    return withTossCors(request, handleApiError(error));
  }
}
