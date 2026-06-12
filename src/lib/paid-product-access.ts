import { getCommerceRepository } from "./commerce-repository";
import { verifyReportToken } from "./report-access";
import type { ProductId } from "./types";

export class PaidProductAccessError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 402
  ) {
    super(message);
  }
}

export async function assertPaidProductAccess(input: {
  orderId: unknown;
  token: unknown;
  productId: ProductId;
}) {
  const orderId = typeof input.orderId === "string" ? input.orderId.trim() : "";
  const token = typeof input.token === "string" ? input.token.trim() : "";

  if (!orderId || !token) {
    throw new PaidProductAccessError("PAYMENT_REQUIRED", "유료 상품 결제 정보가 필요해요.");
  }

  const order = await getCommerceRepository().get(orderId);
  if (!order || order.status !== "PAID") {
    throw new PaidProductAccessError("PAYMENT_REQUIRED", "결제 완료된 주문을 찾을 수 없어요.");
  }

  if (order.productId !== input.productId) {
    throw new PaidProductAccessError("PRODUCT_MISMATCH", "결제한 상품이 요청한 상품과 일치하지 않아요.");
  }

  if (!verifyReportToken(token, order.reportTokenHash)) {
    throw new PaidProductAccessError("PAYMENT_TOKEN_INVALID", "결제 권한 토큰이 올바르지 않아요.", 403);
  }

  return order;
}
