import { randomUUID } from "node:crypto";
import type { ProductId, ReportOrder, ScanJob } from "./types";

export const products: Record<ProductId, { amount: number; currency: "KRW"; name: string }> = {
  DETAILED_REPORT: {
    amount: 2900,
    currency: "KRW",
    name: "ID 도플갱어 정밀 리포트"
  },
  MONTHLY_MONITORING: {
    amount: 3900,
    currency: "KRW",
    name: "ID 도플갱어 월간 모니터링"
  }
};

export function parseProductId(value: unknown): ProductId {
  return value === "MONTHLY_MONITORING" ? "MONTHLY_MONITORING" : "DETAILED_REPORT";
}

export function hasBillableResults(scan: Pick<ScanJob, "foundCount">, productId: ProductId) {
  return productId === "MONTHLY_MONITORING" || scan.foundCount > 0;
}

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

export function isPaymentProviderPortOne() {
  return process.env.PAYMENT_PROVIDER === "portone";
}

export function resolvePaymentProvider(): ReportOrder["provider"] {
  if (isPaymentProviderPortOne()) return "PORTONE";
  if (isPaymentProviderPolar()) return "POLAR";
  return isPaymentProviderToss() ? "TOSS" : "MOCK";
}
