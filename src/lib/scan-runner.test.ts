import { afterEach, describe, expect, it } from "vitest";
import { runScan } from "./scan-runner";

describe("runScan provider resolution", () => {
  const originalScanProvider = process.env.SCAN_PROVIDER;
  const originalMaigretBin = process.env.MAIGRET_BIN;

  afterEach(() => {
    restoreEnv("SCAN_PROVIDER", originalScanProvider);
    restoreEnv("MAIGRET_BIN", originalMaigretBin);
  });

  it("defaults to auto mode so Vercel beta deployments do not 500 when the Maigret CLI is unavailable", async () => {
    delete process.env.SCAN_PROVIDER;
    process.env.MAIGRET_BIN = "definitely-not-a-maigret-command";

    const job = await runScan({ username: "vercelbeta", purpose: "SELF_CHECK", mode: "QUICK" });

    expect(job.status).toBe("COMPLETED");
    expect(job.scanSource).toBe("LOCAL_FALLBACK");
    expect(job.checkedCount).toBeGreaterThan(0);
  });

  it("still fails when production explicitly requires the Maigret CLI", async () => {
    process.env.SCAN_PROVIDER = "maigret";
    process.env.MAIGRET_BIN = "definitely-not-a-maigret-command";

    await expect(runScan({ username: "strictmaigret", purpose: "SELF_CHECK", mode: "QUICK" })).rejects.toThrow();
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
