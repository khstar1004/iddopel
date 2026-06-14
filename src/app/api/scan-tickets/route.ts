import { NextResponse } from "next/server";
import { handleApiError, jsonError, readJson } from "@/lib/api";
import {
  getBetaScanSettingsStore,
  getBetaScanTicketStatusForRequest,
  grantBetaScanReferralTicketForRequest
} from "@/lib/beta-scan-quota";
import { publicTicketWallet, resolveTicketWalletSession } from "@/lib/ticket-wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ownerToken = request.headers.get("x-scan-owner-token");
    const wallet = await resolveTicketWalletSession(request);
    const principalOwnerToken = wallet?.ownerToken ?? ownerToken;
    if (!principalOwnerToken?.trim()) {
      return noStore(jsonError("SCAN_OWNER_TOKEN_REQUIRED", "무료 티켓 소유자 토큰이 필요해요.", 400));
    }

    const settings = await getBetaScanSettingsStore().get();
    const tickets = await getBetaScanTicketStatusForRequest(request, principalOwnerToken, settings, {
      accountScoped: Boolean(wallet)
    });
    return noStore(NextResponse.json({ tickets, wallet: wallet ? publicTicketWallet(wallet) : null }));
  } catch (error) {
    return noStore(handleApiError(error));
  }
}

export async function POST(request: Request) {
  try {
    const ownerToken = request.headers.get("x-scan-owner-token");
    const wallet = await resolveTicketWalletSession(request);
    const principalOwnerToken = wallet?.ownerToken ?? ownerToken;
    if (!principalOwnerToken?.trim()) {
      return noStore(jsonError("SCAN_OWNER_TOKEN_REQUIRED", "무료 티켓 소유자 토큰이 필요해요.", 400));
    }

    const body = (await readJson(request)) as Record<string, unknown>;
    const referralCode = typeof body.referralCode === "string" ? body.referralCode : null;
    const settings = await getBetaScanSettingsStore().get();
    const result = await grantBetaScanReferralTicketForRequest(request, principalOwnerToken, referralCode, settings, {
      accountScoped: Boolean(wallet)
    });
    return noStore(NextResponse.json({ ...result, wallet: wallet ? publicTicketWallet(wallet) : null }));
  } catch (error) {
    return noStore(handleApiError(error));
  }
}

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}
