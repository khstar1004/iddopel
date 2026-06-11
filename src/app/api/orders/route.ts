import { NextResponse } from "next/server";
import { handleApiError, jsonError, readJson } from "@/lib/api";
import { createOrder, publicOrder, resolvePaymentProvider } from "@/lib/commerce";
import { getCommerceRepository } from "@/lib/commerce-repository";
import { attachCheckoutUrl } from "@/lib/payment-provider";
import { getStoredScan } from "@/lib/scan-store";
import { createTossPreflightResponse, rejectDisallowedTossCors, withTossCors } from "@/lib/toss-cors";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return createTossPreflightResponse(request, ["POST"]);
}

export async function POST(request: Request) {
  const corsError = rejectDisallowedTossCors(request);
  if (corsError) return corsError;

  try {
    const body = (await readJson(request)) as Record<string, unknown>;
    const scanId = typeof body.scanId === "string" ? body.scanId : "";
    const scan = await getStoredScan(scanId);

    if (!scan) {
      return withTossCors(request, jsonError("NOT_FOUND", "점검 기록을 찾을 수 없어요.", 404));
    }

    const provider = resolvePaymentProvider();
    const order = createOrder(scan, provider);
    const orderWithCheckout = await attachCheckoutUrl(order, requestOrigin(request));
    await getCommerceRepository().create(orderWithCheckout);

    return withTossCors(request, NextResponse.json(publicOrder(orderWithCheckout), { status: 201 }));
  } catch (error) {
    return withTossCors(request, handleApiError(error));
  }
}

function requestOrigin(request: Request) {
  const configured = process.env.SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}
