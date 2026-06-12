import { runMaigretScan } from "./maigret-adapter";
import { enrichScanResultsWithMetadata } from "./result-metadata";
import { createScanJob, createScanJobFromResults } from "./scanner";
import type { CreateScanInput, ScanJob } from "./types";

interface ScanRunOptions {
  origin?: string;
}

export async function runScan(input: CreateScanInput, options: ScanRunOptions = {}): Promise<ScanJob> {
  const provider = process.env.SCAN_PROVIDER ?? "maigret";

  if (provider === "mock") {
    return createScanJob(input);
  }

  const maigret = await runMaigretScan(input, { origin: options.origin });
  const results = await enrichScanResultsWithMetadata(maigret.results);
  return createScanJobFromResults(input, results, {
    checkedCount: maigret.checkedCount,
    failedRate: maigret.failedRate,
    maigretReport: maigret.report,
    scanSource: "PUBLIC_SCAN"
  });
}
