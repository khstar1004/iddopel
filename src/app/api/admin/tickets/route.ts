import { NextResponse } from "next/server";
import { AdminAuditChanges, recordAdminAuditEvent } from "@/lib/admin-audit-log";
import {
  betaScanReferralCode,
  grantBetaScanBonusTickets,
  getBetaScanUsageStore,
  normalizeBetaScanReferralCode
} from "@/lib/beta-scan-quota";
import { handleApiError, jsonError, readJson } from "@/lib/api";
import { devAdminUsername, isDevAdminRequest } from "@/lib/dev-admin";
import {
  TicketWalletAccount,
  TicketWalletError,
  findTicketWalletAccountByEmail,
  findTicketWalletAccountByRecoveryCode
} from "@/lib/ticket-wallet";

export const runtime = "nodejs";

type AdminTicketTarget =
  | { kind: "email"; referralCode: string; account: TicketWalletAccount }
  | { kind: "recoveryCode"; referralCode: string; account: TicketWalletAccount }
  | { kind: "referralCode"; referralCode: string; account: null };

export async function POST(request: Request) {
  if (!isDevAdminRequest(request)) {
    return jsonError("UNAUTHORIZED", "관리자 로그인이 필요해요.", 401);
  }

  try {
    const body = (await readJson(request)) as Record<string, unknown>;
    const amount = normalizeGrantAmount(body.amount);
    if (amount === null) {
      return jsonError("VALIDATION_ERROR", "지급 수량은 1부터 100 사이의 정수로 입력해 주세요.", 422);
    }

    const target = await resolveAdminTicketTarget(body.target);
    if (!target) {
      return jsonError("TICKET_TARGET_NOT_FOUND", "해당 이메일 또는 코드를 가진 티켓 지갑을 찾지 못했어요.", 404);
    }

    const grant = await grantBetaScanBonusTickets(getBetaScanUsageStore(), target.referralCode, amount);
    if (!grant.granted) {
      return jsonError("VALIDATION_ERROR", "티켓을 지급할 수 없는 추천코드예요.", 422);
    }

    const memo = sanitizeMemo(body.memo);
    await recordAdminAuditEvent(request, {
      action: "tickets.grant",
      actor: devAdminUsername(),
      changes: ticketGrantAuditChanges(target, grant.previousBonusRemaining, grant.bonusRemaining, amount, memo)
    });

    return NextResponse.json({
      target: publicAdminTicketTarget(target),
      grant: {
        amount,
        previousBonusRemaining: grant.previousBonusRemaining,
        bonusRemaining: grant.bonusRemaining
      }
    });
  } catch (error) {
    if (error instanceof TicketWalletError) {
      return jsonError("VALIDATION_ERROR", error.message, 422);
    }
    return handleApiError(error);
  }
}

function normalizeGrantAmount(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 100) return null;
  return value;
}

async function resolveAdminTicketTarget(value: unknown): Promise<AdminTicketTarget | null> {
  if (typeof value !== "string") {
    throw new TicketWalletError("TICKET_TARGET_INVALID", "이메일, 추천코드 또는 복구코드를 입력해 주세요.");
  }

  const target = value.trim();
  if (!target) {
    throw new TicketWalletError("TICKET_TARGET_INVALID", "이메일, 추천코드 또는 복구코드를 입력해 주세요.");
  }

  if (target.includes("@")) {
    const account = await findTicketWalletAccountByEmail(target);
    return account ? accountTarget("email", account) : null;
  }

  const referralCode = normalizeBetaScanReferralCode(target);
  if (referralCode) {
    return { kind: "referralCode", referralCode, account: null };
  }

  const account = await findTicketWalletAccountByRecoveryCode(target);
  return account ? accountTarget("recoveryCode", account) : null;
}

function accountTarget(kind: "email" | "recoveryCode", account: TicketWalletAccount): AdminTicketTarget {
  const referralCode = betaScanReferralCode(account.ownerToken);
  if (!referralCode) {
    throw new TicketWalletError("TICKET_TARGET_INVALID", "티켓 지갑 추천코드를 만들지 못했어요.", 422);
  }
  return { kind, referralCode, account };
}

function publicAdminTicketTarget(target: AdminTicketTarget) {
  return {
    kind: target.kind,
    referralCode: target.referralCode,
    accountId: target.account?.accountId ?? null,
    emailMasked: target.account?.emailMasked ?? null
  };
}

function ticketGrantAuditChanges(
  target: AdminTicketTarget,
  previousBonusRemaining: number,
  bonusRemaining: number,
  amount: number,
  memo: string | null
): AdminAuditChanges {
  const identifier = target.account?.emailMasked ?? target.referralCode;
  const changes: AdminAuditChanges = {
    targetKind: { before: null, after: target.kind },
    targetIdentifier: { before: null, after: identifier },
    amount: { before: 0, after: amount },
    bonusRemaining: { before: previousBonusRemaining, after: bonusRemaining }
  };
  if (memo) changes.memo = { before: null, after: memo };
  return changes;
}

function sanitizeMemo(value: unknown) {
  if (typeof value !== "string") return null;
  const memo = value.trim().replace(/\s+/g, " ").slice(0, 120);
  return memo || null;
}
