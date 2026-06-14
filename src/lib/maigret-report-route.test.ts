import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../app/api/scans/[scanId]/maigret-report.html/route";
import { resetScanRepositoryForTests, type ScanRepository } from "./repository";
import { createDevAdminToken } from "./dev-admin";
import { createScanJob } from "./scanner";
import type { ScanJob } from "./types";

describe("maigret report route", () => {
  const originalEnableDevAdmin = process.env.ENABLE_DEV_ADMIN;
  const originalDevAdminPassword = process.env.DEV_ADMIN_PASSWORD;

  afterEach(() => {
    restoreEnv("ENABLE_DEV_ADMIN", originalEnableDevAdmin);
    restoreEnv("DEV_ADMIN_PASSWORD", originalDevAdminPassword);
    resetScanRepositoryForTests(null);
  });

  it("serves sanitized HTML with defensive browser headers", async () => {
    process.env.ENABLE_DEV_ADMIN = "true";
    process.env.DEV_ADMIN_PASSWORD = "secret-password";
    const scan = {
      ...createScanJob({ username: "sourcehtml", purpose: "SELF_CHECK", mode: "QUICK" }),
      maigretReport: {
        html: "<html><body><script>alert(1)</script><h1>sourcehtml</h1></body></html>",
        htmlFilename: "sourcehtml\"\r\nbad.html"
      }
    };
    resetScanRepositoryForTests(new MemoryScanRepository([scan]));
    const adminToken = createDevAdminToken(new Request("https://id.example.com/admin"), "admin") ?? "";

    const response = await GET(
      new Request(`https://id.example.com/api/scans/${scan.scanId}/maigret-report.html?adminToken=${encodeURIComponent(adminToken)}`),
      routeContext(scan.scanId)
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
    expect(response.headers.get("Content-Disposition")).toBe('inline; filename="sourcehtml___bad.html"');
    expect(body).toContain("sourcehtml");
    expect(body).not.toContain("<script");
  });
});

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

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
