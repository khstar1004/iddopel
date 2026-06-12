import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { pruneExpiredScans } from "@/lib/scan-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return jsonError("MISCONFIGURED", "CRON_SECRET is not configured.", 500);
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return jsonError("UNAUTHORIZED", "Unauthorized cron request.", 401);
  }

  const prunedCount = await pruneExpiredScans();
  return NextResponse.json({
    ok: true,
    prunedCount
  });
}
