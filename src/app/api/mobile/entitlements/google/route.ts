import { NextResponse } from "next/server";
import { handleApiError, jsonError, readJson } from "@/lib/api";
import { NativePurchaseError, redeemVerifiedNativePurchase, verifyGooglePlayPurchase } from "@/lib/native-purchases";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as Record<string, unknown>;
    const scanId = typeof body.scanId === "string" ? body.scanId : "";
    const productId = typeof body.productId === "string" ? body.productId : "";
    const purchaseToken = typeof body.purchaseToken === "string" ? body.purchaseToken : "";

    const purchase = await verifyGooglePlayPurchase({ productId, purchaseToken });
    const entitlement = await redeemVerifiedNativePurchase(scanId, purchase);
    return NextResponse.json({ ok: true, ...entitlement });
  } catch (error) {
    if (error instanceof NativePurchaseError) {
      return jsonError(error.code, error.message, error.status);
    }
    return handleApiError(error);
  }
}
