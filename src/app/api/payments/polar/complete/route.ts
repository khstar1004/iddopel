import { NextResponse } from "next/server";
import { handleApiError, jsonError, readJson } from "@/lib/api";
import { completePolarCheckout, PolarPaymentError } from "@/lib/polar-payments";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as Record<string, unknown>;
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const checkoutId = typeof body.checkoutId === "string" ? body.checkoutId : "";

    const result = await completePolarCheckout(orderId, checkoutId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof PolarPaymentError) {
      return jsonError(error.code, error.message, error.status);
    }

    return handleApiError(error);
  }
}
