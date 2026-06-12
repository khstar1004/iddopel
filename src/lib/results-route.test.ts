import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../app/api/scans/[scanId]/results/route";
import { resetScanRepositoryForTests, type ScanRepository } from "./repository";
import { createScanJobFromResults } from "./scanner";
import type { ScanJob } from "./types";

describe("scan results route free preview policy", () => {
  afterEach(() => {
    resetScanRepositoryForTests(null);
  });

  it("recomputes preview results instead of trusting stored previewResults", async () => {
    const scan = staleScanWithLeakedPreview();
    resetScanRepositoryForTests(new MemoryScanRepository([scan]));

    const response = await GET(resultsRequest(scan.scanId), routeContext(scan.scanId));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.access).toBe("PREVIEW");
    expect(body.lockedCount).toBe(1);
    expect(body.results.map((result: { platform: string }) => result.platform)).toEqual(["GitHub"]);
    expect(body.results[0].url).toBe("https://github.com/routepolicy");
    expect(body.results[0].cleanupHint).toBe("Check profile.");
    expect(body.lockedResults).toEqual([
      expect.objectContaining({
        platform: "LinkedIn",
        maskedUrl: "linkedin.com/in/rout••••••••",
        category: "GLOBAL",
        country: "GLOBAL"
      })
    ]);
    expect(JSON.stringify(body.lockedResults)).not.toContain("https://");
  });

  it("keeps locked full-access responses on the same preview policy", async () => {
    const scan = staleScanWithLeakedPreview();
    resetScanRepositoryForTests(new MemoryScanRepository([scan]));

    const response = await GET(resultsRequest(scan.scanId, "access=full"), routeContext(scan.scanId));
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body.access).toBe("LOCKED");
    expect(body.lockedCount).toBe(1);
    expect(body.results.map((result: { platform: string }) => result.platform)).toEqual(["GitHub"]);
    expect(body.lockedResults.map((result: { platform: string }) => result.platform)).toEqual(["LinkedIn"]);
  });

  it("returns only locked mosaics when the scan used the beta free preview quota", async () => {
    const scan = { ...staleScanWithLeakedPreview(), freePreviewLocked: true, freePreviewLockReason: "BETA_FREE_SCAN_LIMITED" as const };
    resetScanRepositoryForTests(new MemoryScanRepository([scan]));

    const response = await GET(resultsRequest(scan.scanId), routeContext(scan.scanId));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.access).toBe("PREVIEW");
    expect(body.freePreviewLocked).toBe(true);
    expect(body.lockedCount).toBe(2);
    expect(body.results).toEqual([]);
    expect(body.lockedResults.map((result: { platform: string }) => result.platform)).toEqual(["GitHub", "LinkedIn"]);
    expect(JSON.stringify(body.lockedResults)).not.toContain("https://");
  });
});

function staleScanWithLeakedPreview() {
  const scan = createScanJobFromResults(
    {
      username: "routepolicy",
      purpose: "SELF_CHECK",
      mode: "QUICK"
    },
    [
      {
        id: "github-route",
        platform: "GitHub",
        url: "https://github.com/routepolicy",
        category: "DEVELOPER",
        country: "GLOBAL",
        status: "FOUND",
        riskLevel: "LOW",
        cleanupHint: "Check profile."
      },
      {
        id: "linkedin-route",
        platform: "LinkedIn",
        url: "https://www.linkedin.com/in/routepolicy",
        category: "GLOBAL",
        country: "GLOBAL",
        status: "FOUND",
        riskLevel: "LOW",
        cleanupHint: "Check profile."
      }
    ],
    {
      checkedCount: 100,
      now: new Date("2026-06-11T00:00:00.000Z")
    }
  );

  return {
    ...scan,
    previewResults: scan.results.filter((result) => result.status === "FOUND")
  };
}

function resultsRequest(scanId: string, query = "") {
  const suffix = query ? `?${query}` : "";
  return new Request(`http://localhost/api/scans/${scanId}/results${suffix}`);
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
