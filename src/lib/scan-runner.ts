import { runMaigretScan } from "./maigret-adapter";
import { createScanJob, createScanJobFromResults } from "./scanner";
import type { CreateScanInput, ScanJob } from "./types";

export async function runScan(input: CreateScanInput): Promise<ScanJob> {
  const provider = process.env.SCAN_PROVIDER ?? "auto";

  if (provider !== "mock") {
    try {
      const maigret = await runMaigretScan(input);
      return createScanJobFromResults(input, maigret.results, {
        checkedCount: maigret.checkedCount,
        failedRate: maigret.failedRate,
        maigretReport: maigret.report,
        scanSource: "PUBLIC_SCAN"
      });
    } catch (error) {
      if (provider === "maigret") {
        throw error;
      }
    }
  }

  return createScanJob(input);
}
