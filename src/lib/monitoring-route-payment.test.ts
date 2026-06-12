import { afterEach, describe, expect, it } from "vitest";
import { POST } from "../app/api/monitoring/route";
import { createOrder } from "./commerce";
import { resetCommerceRepositoryForTests, type CommerceRepository } from "./commerce-repository";
import { hashReportToken } from "./report-access";
import { resetMonitoringRepositoryForTests, type MonitoringRepository } from "./monitoring-repository";
import type { MonitoringSubscription, ReportOrder } from "./types";
import { createScanJob } from "./scanner";

describe("monitoring route payment gate", () => {
  afterEach(() => {
    delete process.env.MONITORING_PAYWALL_ENABLED;
    resetCommerceRepositoryForTests(null);
    resetMonitoringRepositoryForTests(null);
  });

  it("rejects monthly monitoring registration without paid monitoring access when the paywall is enabled", async () => {
    process.env.MONITORING_PAYWALL_ENABLED = "true";
    resetCommerceRepositoryForTests(new MemoryCommerceRepository([]));
    resetMonitoringRepositoryForTests(new MemoryMonitoringRepository());

    const response = await POST(monitoringRequest({ usernames: ["khstar104"], purpose: "SELF_CHECK" }));
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body.error?.code).toBe("MONITORING_PAYMENT_REQUIRED");
  });

  it("allows monthly monitoring registration with a paid monitoring order token", async () => {
    process.env.MONITORING_PAYWALL_ENABLED = "true";
    const paymentToken = "paid-monitoring-token";
    const order = {
      ...createOrder(createScanJob({ username: "khstar104", purpose: "SELF_CHECK", mode: "QUICK" }), "POLAR", "MONTHLY_MONITORING"),
      status: "PAID" as const,
      reportTokenHash: hashReportToken(paymentToken),
      paidAt: new Date("2026-06-12T00:00:00.000Z").toISOString()
    };
    resetCommerceRepositoryForTests(new MemoryCommerceRepository([order]));
    resetMonitoringRepositoryForTests(new MemoryMonitoringRepository());

    const response = await POST(
      monitoringRequest({
        usernames: ["khstar104"],
        purpose: "SELF_CHECK",
        paymentOrderId: order.orderId,
        paymentToken
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.monitoring.usernames).toEqual(["khstar104"]);
  });
});

function monitoringRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/monitoring", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
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

class MemoryMonitoringRepository implements MonitoringRepository {
  private subscriptions = new Map<string, MonitoringSubscription>();

  async upsert(subscription: MonitoringSubscription) {
    this.subscriptions.set(subscription.monitoringId, subscription);
    return subscription;
  }

  async getByOwnerTokenHash(ownerTokenHash: string) {
    return [...this.subscriptions.values()].find((subscription) => subscription.ownerTokenHash === ownerTokenHash) ?? null;
  }

  async getById(monitoringId: string) {
    return this.subscriptions.get(monitoringId) ?? null;
  }

  async markDeleted() {
    return null;
  }

  async listDue() {
    return [];
  }
}
