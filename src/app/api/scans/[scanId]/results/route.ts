import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { canAccessFullReport } from "@/lib/entitlements";
import { getStoredScan } from "@/lib/scan-store";
import { foundScanResults, lockedPreviewResultsFor, lockedResultsCountFor, publicPreviewResultsFor } from "@/lib/scanner";
import { createTossPreflightResponse, rejectDisallowedTossCors, withTossCors } from "@/lib/toss-cors";
import type { ScanJob } from "@/lib/types";

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
  const job = await getStoredScan(scanId);

  if (!job) {
    return withTossCors(request, jsonError("NOT_FOUND", "점검 결과를 찾을 수 없어요.", 404));
  }

  const url = new URL(request.url);
  const fullAccess = url.searchParams.get("access") === "full";
  const hasPaidAccess = await canAccessFullReport(scanId, url.searchParams.get("token"), request);
  const foundResults = foundScanResults(job.results);
  const previewResults = publicPreviewResultsFor(job.results);
  const lockedCount = lockedResultsCountFor(job.results);
  const lockedResults = lockedPreviewResultsFor(job.results);

  if (fullAccess && !hasPaidAccess) {
    return withTossCors(request, NextResponse.json(
      {
        scanId,
        access: "LOCKED",
        summary: reportSummary(job),
        lockedCount,
        lockedResults,
        maigretReportAvailable: Boolean(job.maigretReport?.html),
        maigretReportFilename: job.maigretReport?.htmlFilename,
        results: previewResults
      },
      { status: 402 }
    ));
  }

  return withTossCors(request, NextResponse.json({
    scanId,
    access: fullAccess && hasPaidAccess ? "FULL" : "PREVIEW",
    summary: reportSummary(job),
    lockedCount: fullAccess && hasPaidAccess ? 0 : lockedCount,
    lockedResults: fullAccess && hasPaidAccess ? [] : lockedResults,
    maigretReportAvailable: Boolean(job.maigretReport?.html),
    maigretReportFilename: job.maigretReport?.htmlFilename,
    results: fullAccess && hasPaidAccess ? foundResults : previewResults
  }));
}

function reportSummary(job: ScanJob) {
  return {
    username: job.username,
    purpose: job.purpose,
    mode: job.mode,
    foundCount: job.foundCount,
    checkedCount: job.checkedCount,
    failedRate: job.failedRate,
    doppelgangerScore: job.doppelgangerScore,
    rarityScore: job.rarityScore,
    exposureScore: job.exposureScore,
    impersonationScore: job.impersonationScore,
    cleanupScore: job.cleanupScore,
    countryDistribution: job.countryDistribution,
    categoryDistribution: job.categoryDistribution,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt
  };
}
