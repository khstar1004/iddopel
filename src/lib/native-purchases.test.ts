import { describe, expect, it, afterEach } from "vitest";
import { resetCommerceRepositoryForTests, type CommerceRepository } from "./commerce-repository";
import {
  NativePurchaseError,
  nativePaymentKey,
  redeemVerifiedNativePurchase,
  validateAppleTransactionPayload,
  validateGoogleProductPurchase
} from "./native-purchases";
import { resetScanRepositoryForTests, type ScanRepository } from "./repository";
import { createScanJob } from "./scanner";
import { canAccessFullReport } from "./entitlements";
import type { ReportOrder, ScanJob } from "./types";

describe("native purchases", () => {
  afterEach(() => {
    resetScanRepositoryForTests(null);
    resetCommerceRepositoryForTests(null);
  });

  it("grants a full report token for a verified App Store purchase", async () => {
    const scan = createScanJob({ username: "nativeuser", purpose: "SELF_CHECK", mode: "QUICK" });
    resetScanRepositoryForTests(new MemoryScanRepository([scan]));
    resetCommerceRepositoryForTests(new MemoryCommerceRepository());

    const result = await redeemVerifiedNativePurchase(scan.scanId, {
      provider: "APP_STORE",
      productId: "DETAILED_REPORT",
      externalPurchaseId: "1000000000001",
      storeProductId: "detailed_report"
    });

    expect(result.reportToken).toHaveLength(43);
    await expect(canAccessFullReport(scan.scanId, result.reportToken)).resolves.toBe(true);
  });

  it("prevents reusing the same native purchase for a different scan", async () => {
    const firstScan = createScanJob({ username: "nativeone", purpose: "SELF_CHECK", mode: "QUICK" });
    const secondScan = createScanJob({ username: "nativetwo", purpose: "SELF_CHECK", mode: "QUICK" });
    resetScanRepositoryForTests(new MemoryScanRepository([firstScan, secondScan]));
    resetCommerceRepositoryForTests(new MemoryCommerceRepository());

    const purchase = {
      provider: "GOOGLE_PLAY" as const,
      productId: "DETAILED_REPORT" as const,
      externalPurchaseId: "GPA.1111-2222-3333-44444",
      storeProductId: "detailed_report"
    };

    await redeemVerifiedNativePurchase(firstScan.scanId, purchase);
    await expect(redeemVerifiedNativePurchase(secondScan.scanId, purchase)).rejects.toMatchObject({
      code: "PURCHASE_ALREADY_USED",
      status: 409
    });
  });

  it("validates App Store payload product, bundle, and revocation status", () => {
    expect(() =>
      validateAppleTransactionPayload(
        {
          transactionId: "1001",
          bundleId: "com.iddoppelganger.app",
          productId: "detailed_report",
          revocationDate: 1710000000000
        },
        { transactionId: "1001", bundleId: "com.iddoppelganger.app", storeProductId: "detailed_report" }
      )
    ).toThrow(NativePurchaseError);
  });

  it("rejects Google Play purchases that are not purchased", () => {
    expect(() =>
      validateGoogleProductPurchase(
        { purchaseState: 1, orderId: "GPA.pending" },
        { purchaseToken: "token", storeProductId: "detailed_report" }
      )
    ).toThrow(NativePurchaseError);
  });
});

class MemoryScanRepository implements ScanRepository {
  private scans = new Map<string, ScanJob>();

  constructor(scans: ScanJob[]) {
    for (const scan of scans) this.scans.set(scan.scanId, scan);
  }

  async create(job: ScanJob) {
    this.scans.set(job.scanId, job);
    return job;
  }

  async get(scanId: string) {
    return this.scans.get(scanId) ?? null;
  }

  async delete(scanId: string) {
    this.scans.delete(scanId);
  }

  async extendExpiration(scanId: string, expiresAt: string) {
    const scan = this.scans.get(scanId);
    if (scan) this.scans.set(scanId, { ...scan, expiresAt });
  }

  async pruneExpired() {
    return 0;
  }
}

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
