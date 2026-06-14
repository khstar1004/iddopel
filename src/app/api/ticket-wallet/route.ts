import { NextResponse } from "next/server";
import { handleApiError, jsonError, readJson } from "@/lib/api";
import {
  claimTicketWallet,
  clearTicketWalletSessionCookie,
  logoutTicketWallet,
  publicTicketWallet,
  resolveTicketWalletSession,
  ticketWalletSessionCookie,
  TicketWalletError
} from "@/lib/ticket-wallet";
import { getBetaScanSettingsStore, getBetaScanTicketStatusForRequest } from "@/lib/beta-scan-quota";
import { assertRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const account = await resolveTicketWalletSession(request);
    if (!account) return noStore(NextResponse.json({ wallet: null }));

    const settings = await getBetaScanSettingsStore().get();
    const tickets = await getBetaScanTicketStatusForRequest(request, account.ownerToken, settings, { accountScoped: true });
    return noStore(NextResponse.json({ wallet: publicTicketWallet(account), tickets }));
  } catch (error) {
    return walletErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertWalletRateLimit(request);
    const body = (await readJson(request)) as Record<string, unknown>;
    const ownerToken = request.headers.get("x-scan-owner-token");
    const result = await claimTicketWallet({
      email: body.email,
      recoveryCode: body.recoveryCode,
      anonymousOwnerToken: ownerToken
    });
    const settings = await getBetaScanSettingsStore().get();
    const tickets = await getBetaScanTicketStatusForRequest(request, result.account.ownerToken, settings, {
      accountScoped: true
    });
    const response = NextResponse.json(
      {
        wallet: result.wallet,
        tickets,
        recoveryCode: result.recoveryCode,
        created: result.created,
        transferredReferralTickets: result.transferredReferralTickets
      },
      { status: result.created ? 201 : 200 }
    );
    response.headers.set("set-cookie", ticketWalletSessionCookie(result.sessionToken, request));
    return noStore(response);
  } catch (error) {
    return walletErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await logoutTicketWallet(request);
    const response = NextResponse.json({ wallet: null });
    response.headers.set("set-cookie", clearTicketWalletSessionCookie(request));
    return noStore(response);
  } catch (error) {
    return walletErrorResponse(error);
  }
}

function assertWalletRateLimit(request: Request) {
  try {
    assertRateLimit(`ticket-wallet:${rateLimitKey(request, "anonymous")}`, 8, 10 * 60 * 1000);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("RATE_LIMIT:")) {
      const retryAfterSeconds = Number(message.split(":")[1] ?? 60);
      throw new TicketWalletError(
        "RATE_LIMITED",
        "요청이 많아요. 잠시 후 다시 시도해 주세요.",
        429,
        { retryAfterSeconds }
      );
    }
    throw error;
  }
}

function walletErrorResponse(error: unknown) {
  if (error instanceof TicketWalletError) {
    return noStore(jsonError(error.code, error.message, error.status, error.details));
  }
  return noStore(handleApiError(error));
}

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}
