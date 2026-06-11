import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { deleteStoredScan, getStoredSummary } from "@/lib/scan-store";

interface RouteContext {
  params: Promise<{ scanId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { scanId } = await context.params;
  const summary = await getStoredSummary(scanId);

  if (!summary) {
    return jsonError("NOT_FOUND", "점검 기록을 찾을 수 없어요.", 404);
  }

  return NextResponse.json({
    scanId,
    status: summary.status,
    progress: summary.progress,
    createdAt: summary.createdAt,
    finishedAt: summary.finishedAt
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { scanId } = await context.params;
  await deleteStoredScan(scanId);

  return NextResponse.json({
    scanId,
    deleted: true
  });
}
