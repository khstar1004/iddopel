import { NextResponse } from "next/server";
import { handleApiError, jsonError, readJson } from "@/lib/api";
import { getCommerceRepository } from "@/lib/commerce-repository";
import { grantReportAccess } from "@/lib/entitlements";
import { confirmTossPayment } from "@/lib/payment-provider";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as Record<string, unknown>;
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const paymentKey = typeof body.paymentKey === "string" ? body.paymentKey : "";
    const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
    const order = await getCommerceRepository().get(orderId);

    if (!order) {
      return jsonError("NOT_FOUND", "주문을 찾을 수 없어요.", 404);
    }

    if (!paymentKey || !Number.isFinite(amount)) {
      return jsonError("VALIDATION_ERROR", "결제 승인 정보가 올바르지 않아요.", 422);
    }

    await confirmTossPayment(order, paymentKey, amount);
    const { token } = await grantReportAccess(order, paymentKey);

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
