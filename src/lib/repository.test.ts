import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileScanRepository } from "./repository";
import { createScanJob } from "./scanner";
import type { ScanJob } from "./types";

describe("FileScanRepository", () => {
  const originalVercel = process.env.VERCEL;

  afterEach(async () => {
    restoreEnv("VERCEL", originalVercel);
    await rm(path.join(os.tmpdir(), "id-doppelganger", "scans.json"), { force: true }).catch(() => undefined);
  });

  it("backs up a corrupted local scan store and continues writing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "scan-store-"));
    const filePath = path.join(dir, "scans.json");
    const repository = new FileScanRepository(filePath);
    await writeFile(filePath, '{"broken": true} trailing', "utf-8");

    const scan = scanFixture("scan_recovered");
    await expect(repository.create(scan)).resolves.toEqual(scan);

    const persisted = JSON.parse(await readFile(filePath, "utf-8")) as Record<string, ScanJob>;
    expect(persisted.scan_recovered).toMatchObject({ scanId: "scan_recovered" });
    expect((await readdir(dir)).some((name) => name.startsWith("scans.json.corrupt-"))).toBe(true);
  });

  it("serializes concurrent writes to the local scan store", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "scan-store-"));
    const filePath = path.join(dir, "scans.json");
    const repository = new FileScanRepository(filePath);

    await Promise.all([
      repository.create(scanFixture("scan_one")),
      repository.create(scanFixture("scan_two")),
      repository.create(scanFixture("scan_three"))
    ]);

    const persisted = JSON.parse(await readFile(filePath, "utf-8")) as Record<string, ScanJob>;
    expect(Object.keys(persisted).sort()).toEqual(["scan_one", "scan_three", "scan_two"]);
  });

  it("uses writable tmp storage by default on Vercel when no database store is configured", async () => {
    process.env.VERCEL = "1";
    const repository = new FileScanRepository();
    const scan = scanFixture("scan_vercel_tmp");

    await expect(repository.create(scan)).resolves.toEqual(scan);

    const persisted = JSON.parse(
      await readFile(path.join(os.tmpdir(), "id-doppelganger", "scans.json"), "utf-8")
    ) as Record<string, ScanJob>;
    expect(persisted.scan_vercel_tmp).toMatchObject({ scanId: "scan_vercel_tmp" });
  });
});

function scanFixture(scanId: string): ScanJob {
  return {
    ...createScanJob({
      username: scanId,
      purpose: "SELF_CHECK",
      mode: "QUICK"
    }),
    scanId
  };
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
