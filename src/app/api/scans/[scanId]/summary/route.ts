import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getStoredSummary } from "@/lib/scan-store";
import { createTossPreflightResponse, rejectDisallowedTossCors, withTossCors } from "@/lib/toss-cors";

interface RouteContext {
  params: Promise<{ scanId: string }>;
}

export function OPTIONS(request: Request) {
  return createTossPreflightResponse(request, ["GET"]);
}

export async function GET(request: Request, context: RouteContext) {
  const corsError = rejectDisallowedTossCors(request);
  if (corsError) return corsError;

  const { scanId } = await context.params;
  const summary = await getStoredSummary(scanId);

  if (!summary) {
    return withTossCors(request, jsonError("NOT_FOUND", "점검 요약을 찾을 수 없어요.", 404));
  }

  return withTossCors(request, NextResponse.json(summary));
}
