import { NextResponse } from "next/server";
import { handleApiError, jsonError, readJson } from "@/lib/api";
import { NativePurchaseError, redeemVerifiedNativePurchase, verifyApplePurchase } from "@/lib/native-purchases";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as Record<string, unknown>;
    const scanId = typeof body.scanId === "string" ? body.scanId : "";
    const transactionId = typeof body.transactionId === "string" ? body.transactionId : "";

    const purchase = await verifyApplePurchase({ transactionId });
    const entitlement = await redeemVerifiedNativePurchase(scanId, purchase);
    return NextResponse.json({ ok: true, ...entitlement });
  } catch (error) {
    if (error instanceof NativePurchaseError) {
      return jsonError(error.code, error.message, error.status);
    }
    return handleApiError(error);
  }
}
