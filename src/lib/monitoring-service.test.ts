import { describe, expect, it, beforeEach } from "vitest";
import type { MonitoringRepository } from "./monitoring-repository";
import { resetMonitoringRepositoryForTests } from "./monitoring-repository";
import { createMonitoringSubscription } from "./monitoring";
import { deleteMonitoringForOwner, getMonitoringForOwner, registerMonitoring, runDueMonitoringSubscriptions } from "./monitoring-service";
import type { MonitoringSubscription, ScanJob } from "./types";

class FakeMonitoringRepository implements MonitoringRepository {
  subscriptions = new Map<string, MonitoringSubscription>();

  async upsert(subscription: MonitoringSubscription) {
    const existing = Array.from(this.subscriptions.values()).find(
      (item) => item.ownerTokenHash === subscription.ownerTokenHash && item.status !== "DELETED"
    );
    const next = existing ? { ...subscription, monitoringId: existing.monitoringId, createdAt: existing.createdAt } : subscription;
    this.subscriptions.set(next.monitoringId, next);
    return next;
  }

  async getByOwnerTokenHash(ownerTokenHash: string) {
    return Array.from(this.subscriptions.values()).find((item) => item.ownerTokenHash === ownerTokenHash && item.status !== "DELETED") ?? null;
  }

  async getById(monitoringId: string) {
    const subscription = this.subscriptions.get(monitoringId) ?? null;
    return subscription?.status === "DELETED" ? null : subscription;
  }

  async markDeleted(monitoringId: string, ownerTokenHash: string, now = new Date()) {
    const subscription = this.subscriptions.get(monitoringId);
    if (!subscription || subscription.ownerTokenHash !== ownerTokenHash || subscription.status === "DELETED") return null;
    const next: MonitoringSubscription = { ...subscription, status: "DELETED", updatedAt: now.toISOString() };
    this.subscriptions.set(monitoringId, next);
    return next;
  }

  async listDue(now = new Date(), limit = 10) {
    return Array.from(this.subscriptions.values())
      .filter((item) => item.status === "ACTIVE" && new Date(item.nextRunAt).getTime() <= now.getTime())
      .slice(0, limit);
  }
}

describe("monitoring-service", () => {
  let repository: FakeMonitoringRepository;

  beforeEach(() => {
    repository = new FakeMonitoringRepository();
    resetMonitoringRepositoryForTests(repository);
  });

  it("registers, updates, reads, and deletes owner-token scoped monitoring", async () => {
    const created = await registerMonitoring({ usernames: ["khstar104"], purpose: "SELF_CHECK" });
    expect(created.ownerToken).toBeTruthy();
    expect(created.monitoring.usernames).toEqual(["khstar104"]);
    expect(created.monitoring).not.toHaveProperty("ownerTokenHash");

    const updated = await registerMonitoring({
      ownerToken: created.ownerToken,
      usernames: ["brand.name", "creator_kr"],
      purpose: "BRAND_CHECK"
    });
    expect(updated.monitoring.monitoringId).toBe(created.monitoring.monitoringId);
    expect(updated.monitoring.usernames).toEqual(["brand.name", "creator_kr"]);

    const read = await getMonitoringForOwner(created.ownerToken);
    expect(read?.purpose).toBe("BRAND_CHECK");

    const deleted = await deleteMonitoringForOwner(created.monitoring.monitoringId, created.ownerToken);
    expect(deleted?.status).toBe("DELETED");
    await expect(getMonitoringForOwner(created.ownerToken)).resolves.toBeNull();
  });

  it("runs due monthly monitoring and stores latest scan ids", async () => {
    const subscription = createMonitoringSubscription({
      ownerTokenHash: "b".repeat(64),
      usernames: ["alpha", "beta"],
      purpose: "SELF_CHECK",
      now: new Date("2026-05-01T00:00:00Z")
    });
    repository.subscriptions.set(subscription.monitoringId, {
      ...subscription,
      nextRunAt: "2026-06-01T00:00:00.000Z"
    });

    const result = await runDueMonitoringSubscriptions({
      now: new Date("2026-06-11T00:00:00Z"),
      extendScanExpiration: async () => undefined,
      scan: async (input): Promise<ScanJob> =>
        ({
          scanId: `scan_${input.username}`,
          username: input.username,
          purpose: input.purpose,
          mode: "QUICK",
          status: "COMPLETED",
          progress: 100,
          foundCount: 0,
          checkedCount: 0,
          failedRate: 0,
          doppelgangerScore: 100,
          rarityScore: 100,
          exposureScore: 0,
          impersonationScore: 0,
          cleanupScore: 0,
          countryDistribution: {},
          categoryDistribution: {},
          previewResults: [],
          results: [],
          createdAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          expiresAt: new Date().toISOString()
        }) as ScanJob
    });

    expect(result.ok).toBe(true);
    expect(result.scanCount).toBe(2);
    expect(result.monitoring[0].latestScanIds).toEqual({ alpha: "scan_alpha", beta: "scan_beta" });
    expect(result.monitoring[0].nextRunAt).toBe("2026-07-11T00:00:00.000Z");
  });
});
