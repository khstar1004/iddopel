import { NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api";
import { deleteMonitoringForOwner } from "@/lib/monitoring-service";

export const runtime = "nodejs";

type MonitoringRouteContext = {
  params: Promise<{ monitoringId: string }>;
};

export async function DELETE(request: Request, context: MonitoringRouteContext) {
  try {
    const { monitoringId } = await context.params;
    const ownerToken = request.headers.get("x-monitoring-owner-token")?.trim() ?? "";
    const monitoring = await deleteMonitoringForOwner(monitoringId, ownerToken);

    if (!monitoring) {
      return jsonError("NOT_FOUND", "삭제할 월간 모니터링을 찾을 수 없어요.", 404);
    }

    return NextResponse.json({ monitoring });
  } catch (error) {
    return handleApiError(error);
  }
}
