import { NextResponse } from "next/server";
import { handleApiError, jsonError, readJson } from "@/lib/api";
import { getMonitoringForOwner, registerMonitoring } from "@/lib/monitoring-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const ownerToken = request.headers.get("x-monitoring-owner-token")?.trim() ?? "";
    const monitoring = await getMonitoringForOwner(ownerToken);

    if (!monitoring) {
      return jsonError("NOT_FOUND", "등록된 월간 모니터링을 찾을 수 없어요.", 404);
    }

    return NextResponse.json({ monitoring });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as Record<string, unknown>;
    const result = await registerMonitoring({
      ownerToken: body.ownerToken,
      usernames: body.usernames,
      purpose: body.purpose
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
