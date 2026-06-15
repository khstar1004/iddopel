import { NextResponse } from "next/server";
import { handleApiError, jsonError, readJson } from "@/lib/api";
import { getCommerceRepository } from "@/lib/commerce-repository";
import { createInicisPaymentRequest } from "@/lib/payment-provider";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as Record<string, unknown>;
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const order = await getCommerceRepository().get(orderId);

    if (!order) {
      return jsonError("NOT_FOUND", "주문을 찾을 수 없어요.", 404);
    }
    if (order.provider !== "INICIS") {
      return jsonError("VALIDATION_ERROR", "KG이니시스 주문이 아니에요.", 422);
    }

    return NextResponse.json(createInicisPaymentRequest(order, requestOrigin(request)), {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function requestOrigin(request: Request) {
  const configured = process.env.SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}
