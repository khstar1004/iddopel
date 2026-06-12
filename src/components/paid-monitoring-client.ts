"use client";

export const pendingMonitoringKey = "id-doppelganger-pending-monitoring";
export const monitoringOwnerTokenKey = "id-doppelganger-monitoring-owner-token";

export interface PaymentAccessResponse {
  orderId: string;
  productId?: string;
  reportUrl?: string;
  reportToken: string;
}

interface PendingMonitoringRegistration {
  orderId: string;
  ownerToken?: string;
  usernames: string[];
  purpose: string;
}

export function isMonthlyMonitoringPayment(payment: PaymentAccessResponse) {
  return payment.productId === "MONTHLY_MONITORING";
}

export async function registerPaidMonitoringFromPayment(payment: PaymentAccessResponse) {
  const pending = readPendingMonitoringRegistration(payment.orderId);
  if (!pending) {
    throw new Error("월간 모니터링 등록 정보가 브라우저에 남아 있지 않아요. 결제 완료 후 다시 등록을 눌러 주세요.");
  }

  const response = await fetch("/api/monitoring", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ownerToken: pending.ownerToken,
      usernames: pending.usernames,
      purpose: pending.purpose,
      paymentOrderId: payment.orderId,
      paymentToken: payment.reportToken
    })
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error?.message ?? "결제는 확인됐지만 월간 모니터링 등록에 실패했어요.");
  }

  if (typeof body?.ownerToken === "string") {
    window.localStorage.setItem(monitoringOwnerTokenKey, body.ownerToken);
  }
  window.localStorage.removeItem(pendingMonitoringKey);
}

function readPendingMonitoringRegistration(orderId: string): PendingMonitoringRegistration | null {
  const raw = window.localStorage.getItem(pendingMonitoringKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PendingMonitoringRegistration>;
    if (
      parsed.orderId !== orderId ||
      !Array.isArray(parsed.usernames) ||
      parsed.usernames.some((item) => typeof item !== "string") ||
      typeof parsed.purpose !== "string"
    ) {
      return null;
    }

    return {
      orderId,
      ownerToken: typeof parsed.ownerToken === "string" ? parsed.ownerToken : undefined,
      usernames: parsed.usernames,
      purpose: parsed.purpose
    };
  } catch {
    return null;
  }
}
