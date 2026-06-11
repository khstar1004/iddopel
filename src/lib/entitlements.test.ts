import { afterEach, describe, expect, it } from "vitest";
import { resetCommerceRepositoryForTests, type CommerceRepository } from "./commerce-repository";
import { canAccessFullReport, grantFirstFreeReportAccess } from "./entitlements";
import { createScanJob } from "./scanner";
import type { ReportOrder } from "./types";

describe("first free report entitlement", () => {
  afterEach(() => {
    resetCommerceRepositoryForTests(null);
  });

  it("prevents a second free report when browser storage was cleared but the request fingerprint matches", async () => {
    const repository = new MemoryCommerceRepository();
    resetCommerceRepositoryForTests(repository);
    const firstScan = createScanJob({ username: "firstfree", purpose: "SELF_CHECK", mode: "QUICK" });
    const secondScan = createScanJob({ username: "secondfree", purpose: "SELF_CHECK", mode: "QUICK" });
    const fingerprint = "request:fingerprint-one";

    const firstGrant = await grantFirstFreeReportAccess(firstScan, null, fingerprint);
    await expect(canAccessFullReport(firstScan.scanId, firstGrant.token)).resolves.toBe(true);

    await expect(grantFirstFreeReportAccess(secondScan, null, fingerprint)).rejects.toMatchObject({
      code: "FIRST_FREE_USED",
      status: 409
    });
  });

  it("keeps the first free report reusable for the same scan through owner token and request fingerprint aliases", async () => {
    resetCommerceRepositoryForTests(new MemoryCommerceRepository());
    const scan = createScanJob({ username: "samefree", purpose: "SELF_CHECK", mode: "QUICK" });

    const firstGrant = await grantFirstFreeReportAccess(scan, null, "request:fingerprint-two");
    const ownerReuse = await grantFirstFreeReportAccess(scan, firstGrant.ownerToken, null);
    const fingerprintReuse = await grantFirstFreeReportAccess(scan, null, "request:fingerprint-two");

    expect(ownerReuse.reused).toBe(true);
    expect(fingerprintReuse.reused).toBe(true);
    await expect(canAccessFullReport(scan.scanId, ownerReuse.token)).resolves.toBe(true);
    await expect(canAccessFullReport(scan.scanId, fingerprintReuse.token)).resolves.toBe(true);
  });
});

class MemoryCommerceRepository implements CommerceRepository {
  private orders = new Map<string, ReportOrder>();

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
