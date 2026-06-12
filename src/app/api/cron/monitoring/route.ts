import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { runDueMonitoringSubscriptions } from "@/lib/monitoring-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return jsonError("MISCONFIGURED", "CRON_SECRET is not configured.", 500);
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return jsonError("UNAUTHORIZED", "Unauthorized cron request.", 401);
  }

  const configuredLimit = Number(process.env.MONITORING_CRON_LIMIT ?? "3");
  const result = await runDueMonitoringSubscriptions({
    limit: Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 3
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
