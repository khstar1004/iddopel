import { NextResponse } from "next/server";
import { handleApiError, jsonError, readJson } from "@/lib/api";
import { isMonitoringPaywallEnabled, monitoringPaywallEnabledMessage } from "@/lib/monitoring-paywall";
import { getMonitoringForOwner, registerMonitoring } from "@/lib/monitoring-service";
import { assertPaidProductAccess, PaidProductAccessError } from "@/lib/paid-product-access";

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

    if (isMonitoringPaywallEnabled()) {
      await assertPaidProductAccess({
        orderId: body.paymentOrderId,
        token: body.paymentToken,
        productId: "MONTHLY_MONITORING"
      });
    }

    const result = await registerMonitoring({
      ownerToken: body.ownerToken,
      usernames: body.usernames,
      purpose: body.purpose
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PaidProductAccessError) {
      return jsonError(
        error.code === "PAYMENT_REQUIRED" ? "MONITORING_PAYMENT_REQUIRED" : error.code,
        error.code === "PAYMENT_REQUIRED" ? monitoringPaywallEnabledMessage() : error.message,
        error.status
      );
    }

    return handleApiError(error);
  }
}
