import { afterEach, describe, expect, it, vi } from "vitest";
import { resetCommerceRepositoryForTests, type CommerceRepository } from "./commerce-repository";
import { createOrder } from "./commerce";
import { completePolarCheckout, grantPolarOrderPaid } from "./polar-payments";
import { createScanJob } from "./scanner";
import type { ReportOrder } from "./types";

describe("completePolarCheckout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.POLAR_ACCESS_TOKEN;
    delete process.env.POLAR_PRODUCT_ID;
    resetCommerceRepositoryForTests(null);
  });

  it("verifies the Polar checkout and returns a report token", async () => {
    const order = createOrder(createScanJob({ username: "polaruser", purpose: "SELF_CHECK", mode: "QUICK" }), "POLAR");
    resetCommerceRepositoryForTests(new MemoryCommerceRepository([order]));
    process.env.POLAR_ACCESS_TOKEN = "polar_test_token";
    process.env.POLAR_PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: "chk_123",
          status: "succeeded",
          product_id: "11111111-1111-4111-8111-111111111111",
          currency: "krw",
          metadata: {
            orderId: order.orderId,
            scanId: order.scanId,
            productId: "DETAILED_REPORT"
          }
        })
      )
    );

    const result = await completePolarCheckout(order.orderId, "chk_123");

    expect(result.reportToken).toBeTruthy();
    expect(result.reportUrl).toContain(`/reports/${order.scanId}?token=`);
  });
});

describe("grantPolarOrderPaid", () => {
  afterEach(() => {
    delete process.env.POLAR_PRODUCT_ID;
    resetCommerceRepositoryForTests(null);
  });

  it("unlocks the local report from a paid Polar order webhook payload", async () => {
    const order = createOrder(createScanJob({ username: "polarhook", purpose: "SELF_CHECK", mode: "QUICK" }), "POLAR");
    const repository = new MemoryCommerceRepository([order]);
    resetCommerceRepositoryForTests(repository);
    process.env.POLAR_PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

    const result = await grantPolarOrderPaid({
      id: "ord_polar",
      checkoutId: "chk_123",
      paid: true,
      productId: "11111111-1111-4111-8111-111111111111",
      currency: "krw",
      metadata: {
        orderId: order.orderId,
        scanId: order.scanId,
        productId: "DETAILED_REPORT"
      }
    });

    const paidOrder = await repository.get(order.orderId);
    expect(result.alreadyPaid).toBe(false);
    expect(paidOrder).toMatchObject({
      status: "PAID",
      paymentKey: "polar_checkout:chk_123"
    });
  });

  it("rejects webhook payloads without local order metadata", async () => {
    await expect(grantPolarOrderPaid({ id: "ord_polar", checkoutId: "chk_123", paid: true })).rejects.toThrow(
      "Polar 주문 메타데이터에 로컬 주문 ID가 없어요."
    );
  });
});

class MemoryCommerceRepository implements CommerceRepository {
  private orders = new Map<string, ReportOrder>();

  constructor(orders: ReportOrder[]) {
    for (const order of orders) this.orders.set(order.orderId, order);
  }

  async create(order: ReportOrder) {
    this.orders.set(order.orderId, order);
    return order;
  }

  async get(orderId: string) {
    return this.orders.get(orderId) ?? null;
  }

  async update(order: ReportOrder) {
    this.orders.set(order.orderId, order);
    return order;
  }

  async findPaidOrderByTokenHash(scanId: string, tokenHash: string) {
    return (
      [...this.orders.values()].find(
        (order) => order.scanId === scanId && order.status === "PAID" && order.reportTokenHash === tokenHash
      ) ?? null
    );
  }

  async findPaidOrderByPaymentKey(provider: ReportOrder["provider"], paymentKey: string) {
    return (
      [...this.orders.values()].find(
        (order) => order.provider === provider && order.status === "PAID" && order.paymentKey === paymentKey
      ) ?? null
    );
  }
}
