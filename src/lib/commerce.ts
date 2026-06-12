import { randomUUID } from "node:crypto";
import type { ProductId, ReportOrder, ScanJob } from "./types";

export const products: Record<ProductId, { amount: number; currency: "KRW"; name: string }> = {
  DETAILED_REPORT: {
    amount: 2900,
    currency: "KRW",
    name: "ID 도플갱어 정밀 리포트"
  }
};

export function createOrder(scan: ScanJob, provider: ReportOrder["provider"], productId: ProductId = "DETAILED_REPORT"): ReportOrder {
  const product = products[productId];
  const now = new Date().toISOString();

  return {
    orderId: `ord_${randomUUID().replaceAll("-", "").slice(0, 24)}`,
    scanId: scan.scanId,
    productId,
    amount: product.amount,
    currency: product.currency,
    orderName: `${product.name} - ${scan.username}`,
    provider,
    status: "READY",
    checkoutUrl: null,
    paymentKey: null,
    reportTokenHash: null,
    createdAt: now,
    paidAt: null
  };
}

export function publicOrder(order: ReportOrder) {
  const { reportTokenHash: _reportTokenHash, paymentKey: _paymentKey, ...publicFields } = order;
  return publicFields;
}

export function isPaymentProviderToss() {
  return process.env.PAYMENT_PROVIDER === "toss";
}

export function isPaymentProviderPolar() {
  return process.env.PAYMENT_PROVIDER === "polar";
}

export function resolvePaymentProvider(): ReportOrder["provider"] {
  if (isPaymentProviderPolar()) return "POLAR";
  return isPaymentProviderToss() ? "TOSS" : "MOCK";
}
