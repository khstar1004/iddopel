import { describe, expect, it } from "vitest";
import { attachCheckoutUrl } from "./payment-provider";
import type { ReportOrder } from "./types";

describe("attachCheckoutUrl", () => {
  it("returns an absolute checkout URL for mock orders created from a Toss-hosted mini app", async () => {
    const order: ReportOrder = {
      orderId: "order_mock",
      scanId: "scan_mock",
      productId: "DETAILED_REPORT",
      amount: 2900,
      currency: "KRW",
      orderName: "ID 도플갱어 정밀 리포트",
      provider: "MOCK",
      status: "READY",
      checkoutUrl: null,
      paymentKey: null,
      reportTokenHash: null,
      createdAt: "2026-06-11T00:00:00.000Z",
      paidAt: null
    };

    await expect(attachCheckoutUrl(order, "https://id-doppelganger.kr")).resolves.toMatchObject({
      checkoutUrl: "https://id-doppelganger.kr/checkout/order_mock"
    });
  });
});
