import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { canAccessFullReport } from "@/lib/entitlements";
import { getStoredScan } from "@/lib/scan-store";

interface RouteContext {
  params: Promise<{ scanId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { scanId } = await context.params;
  const job = await getStoredScan(scanId);

  if (!job) {
    return jsonError("NOT_FOUND", "점검 결과를 찾을 수 없어요.", 404);
  }

  const url = new URL(request.url);
  const fullAccess = url.searchParams.get("access") === "full";
  const hasPaidAccess = await canAccessFullReport(scanId, url.searchParams.get("token"), request);
  const foundResults = job.results.filter((result) => result.status === "FOUND");

  if (fullAccess && !hasPaidAccess) {
    return NextResponse.json(
      {
        scanId,
        access: "LOCKED",
        lockedCount: Math.max(0, foundResults.length - job.previewResults.length),
        maigretReportAvailable: Boolean(job.maigretReport?.html),
        maigretReportFilename: job.maigretReport?.htmlFilename,
        results: job.previewResults
      },
      { status: 402 }
    );
  }

  return NextResponse.json({
    scanId,
    access: fullAccess && hasPaidAccess ? "FULL" : "PREVIEW",
    lockedCount: fullAccess && hasPaidAccess ? 0 : Math.max(0, foundResults.length - job.previewResults.length),
    maigretReportAvailable: Boolean(job.maigretReport?.html),
    maigretReportFilename: job.maigretReport?.htmlFilename,
    results: fullAccess && hasPaidAccess ? foundResults : job.previewResults
  });
}
