import { afterEach, describe, expect, it } from "vitest";
import { POST } from "../app/api/scans/[scanId]/free-report/route";
import { resetCommerceRepositoryForTests, type CommerceRepository } from "./commerce-repository";
import { canAccessFullReport } from "./entitlements";
import { resetScanRepositoryForTests, type ScanRepository } from "./repository";
import { createScanJob } from "./scanner";
import type { ReportOrder, ScanJob } from "./types";

describe("free report route web paywall flag", () => {
  afterEach(() => {
    delete process.env.WEB_DETAILED_REPORT_PAYWALL_ENABLED;
    resetCommerceRepositoryForTests(null);
    resetScanRepositoryForTests(null);
  });

  it("keeps the one-time free detailed report available by default for beta", async () => {
    const scan = createScanJob({ username: "betafree", purpose: "SELF_CHECK", mode: "QUICK" });
    resetScanRepositoryForTests(new MemoryScanRepository([scan]));
    resetCommerceRepositoryForTests(new MemoryCommerceRepository());

    const response = await POST(freeReportRequest(scan.scanId, { soft: true }), routeContext(scan.scanId));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.reportToken).toBeTruthy();
    await expect(canAccessFullReport(scan.scanId, body.reportToken)).resolves.toBe(true);
  });

  it("does not issue a free detailed report token when the web paywall is enabled", async () => {
    process.env.WEB_DETAILED_REPORT_PAYWALL_ENABLED = "true";
    const scan = createScanJob({ username: "paidonly", purpose: "SELF_CHECK", mode: "QUICK" });
    resetScanRepositoryForTests(new MemoryScanRepository([scan]));
    resetCommerceRepositoryForTests(new MemoryCommerceRepository());

    const response = await POST(freeReportRequest(scan.scanId, { soft: true }), routeContext(scan.scanId));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.error?.code).toBe("WEB_PAYWALL_ENABLED");
    expect(body.reportToken).toBeUndefined();
  });

  it("does not issue a free detailed report token when beta free preview is locked", async () => {
    const scan = {
      ...createScanJob({ username: "lockedquota", purpose: "SELF_CHECK", mode: "QUICK" }),
      freePreviewLocked: true,
      freePreviewLockReason: "BETA_FREE_SCAN_LIMITED" as const
    };
    resetScanRepositoryForTests(new MemoryScanRepository([scan]));
    resetCommerceRepositoryForTests(new MemoryCommerceRepository());

    const response = await POST(freeReportRequest(scan.scanId, { soft: true }), routeContext(scan.scanId));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.error?.code).toBe("BETA_FREE_SCAN_LIMITED");
    expect(body.reportToken).toBeUndefined();
  });
});

function freeReportRequest(scanId: string, body: Record<string, unknown>) {
  return new Request(`http://localhost/api/scans/${scanId}/free-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "vitest",
      "Accept-Language": "ko-KR"
    },
    body: JSON.stringify(body)
  });
}

function routeContext(scanId: string) {
  return {
    params: Promise.resolve({ scanId })
  };
}

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
