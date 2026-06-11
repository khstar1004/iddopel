import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { assertRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { sendTelemetryAlert } from "@/lib/telemetry-alerts";
import { buildTelemetryLog, parseTelemetryPayload, TelemetryValidationError } from "@/lib/telemetry";

export const runtime = "nodejs";

const maxTelemetryBytes = 16 * 1024;

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > maxTelemetryBytes) {
      return jsonError("PAYLOAD_TOO_LARGE", "Telemetry payload is too large.", 413);
    }

    try {
      assertRateLimit(rateLimitKey(request, "telemetry"), 120, 60 * 1000);
    } catch (error) {
      const seconds = error instanceof Error && error.message.startsWith("RATE_LIMIT:")
        ? error.message.split(":")[1]
        : "60";
      return jsonError("RATE_LIMITED", `${seconds} seconds until telemetry can resume.`, 429);
    }

    const event = parseTelemetryPayload(await readJson(request));
    const requestId = request.headers.get("x-request-id") ?? undefined;
    const log = buildTelemetryLog(event, process.env, requestId);

    if (process.env.TELEMETRY_DISABLED !== "true") {
      console.info(JSON.stringify(log));
      const alertDelivery = await sendTelemetryAlert(log);
      if (alertDelivery.attempted && !alertDelivery.ok) {
        console.warn(
          JSON.stringify({
            event: "id_doppelganger_alert_delivery_failed",
            requestId: log.requestId,
            reason: alertDelivery.reason,
            status: alertDelivery.status
          })
        );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        requestId: log.requestId
      },
      {
        status: 202,
        headers: {
          "Cache-Control": "no-store",
          "X-Request-Id": log.requestId
        }
      }
    );
  } catch (error) {
    if (error instanceof TelemetryValidationError) {
      return jsonError("VALIDATION_ERROR", error.message, 422);
    }

    return jsonError("INTERNAL_ERROR", "Telemetry could not be recorded.", 500);
  }
}
