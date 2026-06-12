import { publicSummary } from "./scanner";
import type { ScanJob, ScanSummary } from "./types";

export function publicScanResponse(job: ScanJob): ScanSummary {
  return publicSummary(job);
}
