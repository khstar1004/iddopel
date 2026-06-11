import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createMonitoringSubscription } from "./monitoring";
import { FileMonitoringRepository } from "./monitoring-repository";
import type { MonitoringSubscription } from "./types";

describe("FileMonitoringRepository", () => {
  const originalVercel = process.env.VERCEL;

  afterEach(async () => {
    restoreEnv("VERCEL", originalVercel);
    await rm(path.join(os.tmpdir(), "id-doppelganger", "monitoring.json"), { force: true }).catch(() => undefined);
  });

  it("backs up a corrupted local monitoring store and continues writing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "monitoring-store-"));
    const filePath = path.join(dir, "monitoring.json");
    const repository = new FileMonitoringRepository(filePath);
    await writeFile(filePath, '{"broken": true} trailing', "utf-8");

    const subscription = monitoringFixture("mon_recovered", "a".repeat(64));
    await expect(repository.upsert(subscription)).resolves.toEqual(subscription);

    const persisted = JSON.parse(await readFile(filePath, "utf-8")) as Record<string, MonitoringSubscription>;
    expect(persisted.mon_recovered).toMatchObject({ monitoringId: "mon_recovered" });
    expect((await readdir(dir)).some((name) => name.startsWith("monitoring.json.corrupt-"))).toBe(true);
  });

  it("serializes concurrent writes to the local monitoring store", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "monitoring-store-"));
    const filePath = path.join(dir, "monitoring.json");
    const repository = new FileMonitoringRepository(filePath);

    await Promise.all([
      repository.upsert(monitoringFixture("mon_one", "1".repeat(64))),
      repository.upsert(monitoringFixture("mon_two", "2".repeat(64))),
      repository.upsert(monitoringFixture("mon_three", "3".repeat(64)))
    ]);

    const persisted = JSON.parse(await readFile(filePath, "utf-8")) as Record<string, MonitoringSubscription>;
    expect(Object.keys(persisted).sort()).toEqual(["mon_one", "mon_three", "mon_two"]);
  });

  it("uses writable tmp storage by default on Vercel when no database store is configured", async () => {
    process.env.VERCEL = "1";
    const repository = new FileMonitoringRepository();
    const subscription = monitoringFixture("mon_vercel_tmp", "b".repeat(64));

    await expect(repository.upsert(subscription)).resolves.toEqual(subscription);

    const persisted = JSON.parse(
      await readFile(path.join(os.tmpdir(), "id-doppelganger", "monitoring.json"), "utf-8")
    ) as Record<string, MonitoringSubscription>;
    expect(persisted.mon_vercel_tmp).toMatchObject({ monitoringId: "mon_vercel_tmp" });
  });
});

function monitoringFixture(monitoringId: string, ownerTokenHash: string): MonitoringSubscription {
  return {
    ...createMonitoringSubscription({
      ownerTokenHash,
      usernames: [monitoringId],
      purpose: "SELF_CHECK",
      now: new Date("2026-06-11T00:00:00.000Z")
    }),
    monitoringId
  };
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
