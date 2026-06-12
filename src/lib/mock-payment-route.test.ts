import { afterEach, describe, expect, it } from "vitest";
import { POST } from "../app/api/payments/mock/confirm/route";
import { createOrder } from "./commerce";
import { resetCommerceRepositoryForTests, type CommerceRepository } from "./commerce-repository";
import { createScanJob } from "./scanner";
import type { ReportOrder } from "./types";

describe("mock payment confirmation route", () => {
  afterEach(() => {
    delete process.env.ENABLE_MOCK_PAYMENTS;
    delete process.env.PAYMENT_PROVIDER;
    resetCommerceRepositoryForTests(null);
  });

  it("does not unlock a report unless mock payments are explicitly enabled", async () => {
    const order = createOrder(createScanJob({ username: "lockedmock", purpose: "SELF_CHECK", mode: "QUICK" }), "MOCK");
    resetCommerceRepositoryForTests(new MemoryCommerceRepository([order]));
    process.env.PAYMENT_PROVIDER = "mock";

    const response = await POST(mockPaymentRequest(order.orderId));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("FORBIDDEN");
  });

  it("unlocks a report for local smoke tests when mock payments are enabled", async () => {
    const order = createOrder(createScanJob({ username: "localmock", purpose: "SELF_CHECK", mode: "QUICK" }), "MOCK");
    resetCommerceRepositoryForTests(new MemoryCommerceRepository([order]));
    process.env.PAYMENT_PROVIDER = "mock";
    process.env.ENABLE_MOCK_PAYMENTS = "true";

    const response = await POST(mockPaymentRequest(order.orderId));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.orderId).toBe(order.orderId);
    expect(body.productId).toBe("DETAILED_REPORT");
    expect(body.reportToken).toBeTruthy();
    expect(body.reportUrl).toContain("/reports/");
  });

  it("returns the monthly monitoring product id for local monthly checkout tests", async () => {
    const order = createOrder(
      createScanJob({ username: "localmonthly", purpose: "SELF_CHECK", mode: "QUICK" }),
      "MOCK",
      "MONTHLY_MONITORING"
    );
    resetCommerceRepositoryForTests(new MemoryCommerceRepository([order]));
    process.env.PAYMENT_PROVIDER = "mock";
    process.env.ENABLE_MOCK_PAYMENTS = "true";

    const response = await POST(mockPaymentRequest(order.orderId));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.orderId).toBe(order.orderId);
    expect(body.productId).toBe("MONTHLY_MONITORING");
    expect(body.reportToken).toBeTruthy();
  });

  it("does not mock-confirm Toss orders even when local mock payments are enabled", async () => {
    const order = createOrder(createScanJob({ username: "tossorder", purpose: "SELF_CHECK", mode: "QUICK" }), "TOSS");
    resetCommerceRepositoryForTests(new MemoryCommerceRepository([order]));
    process.env.PAYMENT_PROVIDER = "toss";
    process.env.ENABLE_MOCK_PAYMENTS = "true";

    const response = await POST(mockPaymentRequest(order.orderId));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("FORBIDDEN");
  });
});

function mockPaymentRequest(orderId: string) {
  return new Request("http://localhost/api/payments/mock/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId })
  });
}

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
