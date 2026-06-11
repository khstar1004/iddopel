import { NextResponse } from "next/server";
import { handleApiError, jsonError, readJson } from "@/lib/api";
import { getCommerceRepository } from "@/lib/commerce-repository";
import { grantReportAccess } from "@/lib/entitlements";

export async function POST(request: Request) {
  try {
    if (process.env.ENABLE_MOCK_PAYMENTS !== "true") {
      return jsonError("FORBIDDEN", "테스트 결제는 비활성화되어 있어요.", 403);
    }

    const body = (await readJson(request)) as Record<string, unknown>;
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const order = await getCommerceRepository().get(orderId);

    if (!order) {
      return jsonError("NOT_FOUND", "주문을 찾을 수 없어요.", 404);
    }

    if (order.provider !== "MOCK") {
      return jsonError("FORBIDDEN", "테스트 결제로 승인할 수 없는 주문이에요.", 403);
    }

    if (order.status === "PAID" && order.reportTokenHash) {
      return jsonError("ALREADY_PAID", "이미 결제 완료된 주문이에요. 새 주문을 만들어 주세요.", 409);
    }

    const { token } = await grantReportAccess(order, "mock_payment");
    return NextResponse.json({
      ok: true,
      scanId: order.scanId,
      reportUrl: `/reports/${order.scanId}?token=${encodeURIComponent(token)}`,
      reportToken: token
    });
  } catch (error) {
    return handleApiError(error);
  }
}
