import { afterEach, describe, expect, it } from "vitest";
import { runScan } from "./scan-runner";

describe("runScan provider resolution", () => {
  const originalScanProvider = process.env.SCAN_PROVIDER;
  const originalMaigretBin = process.env.MAIGRET_BIN;

  afterEach(() => {
    restoreEnv("SCAN_PROVIDER", originalScanProvider);
    restoreEnv("MAIGRET_BIN", originalMaigretBin);
  });

  it("requires Maigret by default instead of returning fallback data", async () => {
    delete process.env.SCAN_PROVIDER;
    process.env.MAIGRET_BIN = "definitely-not-a-maigret-command";

    await expect(runScan({ username: "vercelbeta", purpose: "SELF_CHECK", mode: "QUICK" })).rejects.toThrow();
  });

  it("requires Maigret when SCAN_PROVIDER is maigret", async () => {
    process.env.SCAN_PROVIDER = "maigret";
    process.env.MAIGRET_BIN = "definitely-not-a-maigret-command";

    await expect(runScan({ username: "vercelprod", purpose: "SELF_CHECK", mode: "QUICK" })).rejects.toThrow();
  });

  it("does not keep legacy auto fallback behavior", async () => {
    process.env.SCAN_PROVIDER = "auto";
    process.env.MAIGRET_BIN = "definitely-not-a-maigret-command";

    await expect(runScan({ username: "legacyauto", purpose: "SELF_CHECK", mode: "QUICK" })).rejects.toThrow();
  });

  it("uses local deterministic results only when mock mode is explicit", async () => {
    process.env.SCAN_PROVIDER = "mock";
    process.env.MAIGRET_BIN = "definitely-not-a-maigret-command";

    const job = await runScan({ username: "mockonly", purpose: "SELF_CHECK", mode: "QUICK" });

    expect(job.status).toBe("COMPLETED");
    expect(job.scanSource).toBe("LOCAL_FALLBACK");
    expect(job.checkedCount).toBeGreaterThan(0);
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
