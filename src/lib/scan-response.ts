import { sanitizeMaigretHtmlReport } from "./maigret-report";
import { publicSummary } from "./scanner";
import type { ScanJob, ScanSummary } from "./types";

export function publicScanResponse(job: ScanJob): ScanSummary {
  const summary = publicSummary(job);

  if (!isInlineScanArtifactsEnabled()) {
    return summary;
  }

  return {
    ...summary,
    fullResults: job.results.filter((result) => result.status === "FOUND"),
    sourceReportHtml: job.maigretReport?.html ? sanitizeMaigretHtmlReport(job.maigretReport.html) : undefined
  };
}

export function isInlineScanArtifactsEnabled() {
  return process.env.INLINE_SCAN_ARTIFACTS === "true";
}
