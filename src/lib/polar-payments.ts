import { getCommerceRepository } from "./commerce-repository";
import { grantReportAccess } from "./entitlements";
import { confirmPolarCheckout, polarPaymentKey, validatePolarCheckoutForOrder } from "./payment-provider";
import type { ReportOrder } from "./types";

export class PolarPaymentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422
  ) {
    super(message);
  }
}

interface PolarPaidOrderPayload {
  id?: string | null;
  checkoutId?: string | null;
  productId?: string | null;
  currency?: string | null;
  metadata?: Record<string, unknown>;
  paid?: boolean;
}

export async function completePolarCheckout(orderId: string, checkoutId: string) {
  const order = await getPolarLocalOrder(orderId);
  const checkout = await confirmPolarCheckout(order, checkoutId);
  const { token } = await grantReportAccess(order, polarPaymentKey(checkout.id ?? checkoutId));

  return {
    scanId: order.scanId,
    orderId: order.orderId,
    reportUrl: `/reports/${order.scanId}?token=${encodeURIComponent(token)}`,
    reportToken: token
  };
}

export async function grantPolarOrderPaid(payload: PolarPaidOrderPayload) {
  const orderId = stringMetadata(payload.metadata, "orderId");
  if (!orderId) {
    throw new PolarPaymentError("VALIDATION_ERROR", "Polar 주문 메타데이터에 로컬 주문 ID가 없어요.");
  }

  const order = await getPolarLocalOrder(orderId);
  if (order.status === "PAID" && order.reportTokenHash) {
    return { order, alreadyPaid: true };
  }

  if (payload.paid === false) {
    throw new PolarPaymentError("PAYMENT_NOT_COMPLETED", "Polar 주문이 아직 결제 완료 상태가 아니에요.");
  }

  validatePolarCheckoutForOrder(order, {
    id: payload.checkoutId ?? payload.id ?? undefined,
    status: "succeeded",
    product_id: payload.productId,
    currency: payload.currency,
    metadata: payload.metadata
  });

  const paymentKeySource = payload.checkoutId || payload.id;
  if (!paymentKeySource) {
    throw new PolarPaymentError("VALIDATION_ERROR", "Polar 결제 식별자가 없어요.");
  }

  const { order: paidOrder } = await grantReportAccess(order, polarPaymentKey(paymentKeySource));
  return { order: paidOrder, alreadyPaid: false };
}

async function getPolarLocalOrder(orderId: string) {
  const normalizedOrderId = orderId.trim();
  if (!normalizedOrderId) {
    throw new PolarPaymentError("VALIDATION_ERROR", "주문 ID가 필요해요.");
  }

  const order = await getCommerceRepository().get(normalizedOrderId);
  if (!order) {
    throw new PolarPaymentError("NOT_FOUND", "주문을 찾을 수 없어요.", 404);
  }

  if (order.provider !== "POLAR") {
    throw new PolarPaymentError("FORBIDDEN", "Polar 결제로 승인할 수 없는 주문이에요.", 403);
  }

  return order;
}

function stringMetadata(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}
