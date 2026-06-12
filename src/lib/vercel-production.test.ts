import { describe, expect, it } from "vitest";
// @ts-ignore - This test exercises the Node production gate script directly.
import { createVercelProductionReport, requiredSecurityHeaders } from "../../scripts/verify-vercel-production.mjs";

type ProductionReport = {
  checks: Array<{ name: string; ok: boolean }>;
};

const securityHeaders = Object.fromEntries(
  (requiredSecurityHeaders as string[]).map((header: string) => [
    header,
    header === "content-security-policy" ? "default-src 'self'" : "present"
  ])
);

function htmlResponse(body = "<!DOCTYPE html><html><body>ID 도플갱어</body></html>") {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...securityHeaders
    }
  });
}

function textResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function productionFetch({ publicCron = false } = {}): typeof fetch {
  return async (input) => {
    const url = new URL(String(input));

    if (url.pathname === "/") return htmlResponse();
    if (["/privacy", "/terms", "/responsible-use", "/toss"].includes(url.pathname)) return htmlResponse();
    if (url.pathname === "/robots.txt") return textResponse("User-agent: *");
    if (url.pathname === "/sitemap.xml") return textResponse("<urlset></urlset>");
    if (["/api/cron/prune", "/api/cron/monitoring"].includes(url.pathname)) {
      return publicCron ? jsonResponse({ ok: true }) : jsonResponse({ error: { code: "UNAUTHORIZED" } }, 401);
    }
    if (url.pathname === "/api/health") {
      return jsonResponse({
        ok: true,
        storage: "postgres",
        scanProvider: "maigret",
        paymentProvider: "toss"
      });
    }
    if (url.pathname === "/api/scans") {
      return jsonResponse({
        scanId: "scan_prod",
        scanSource: "PUBLIC_SCAN",
        checkedCount: 109,
        previewResults: [{ platform: "GitHub" }]
      }, 201);
    }
    if (url.pathname === "/api/scans/scan_prod/results") {
      return jsonResponse({ access: "LOCKED" }, 402);
    }
    if (url.pathname === "/api/scans/scan_prod/free-report") {
      return jsonResponse({ error: { code: "WEB_PAYWALL_ENABLED" } });
    }
    if (url.pathname === "/api/orders") {
      return jsonResponse({
        orderId: "ord_prod",
        provider: "TOSS",
        status: "READY",
        checkoutUrl: "https://pay.toss.im/checkout"
      }, 201);
    }

    return textResponse("not found", 404);
  };
}

function betaFetch(): typeof fetch {
  return async (input) => {
    const url = new URL(String(input));

    if (url.pathname === "/") return htmlResponse();
    if (["/privacy", "/terms", "/responsible-use", "/toss"].includes(url.pathname)) return htmlResponse();
    if (url.pathname === "/robots.txt") return textResponse("User-agent: *");
    if (url.pathname === "/sitemap.xml") return textResponse("<urlset></urlset>");
    if (url.pathname === "/api/health") {
      return jsonResponse({
        ok: true,
        storage: "file",
        scanProvider: "maigret",
        paymentProvider: "mock"
      });
    }
    if (url.pathname === "/api/scans") {
      return jsonResponse({
        scanId: "scan_beta",
        scanSource: "PUBLIC_SCAN",
        checkedCount: 109,
        fullResults: [{ platform: "GitHub" }],
        sourceReportHtml: "<html>beta report</html>"
      }, 201);
    }
    if (url.pathname === "/api/scans/scan_beta/results") {
      return jsonResponse({ access: "LOCKED" }, 402);
    }
    if (url.pathname === "/api/scans/scan_beta/free-report") {
      return jsonResponse({ reportToken: "free_beta_token" });
    }
    if (url.pathname === "/api/orders") {
      return jsonResponse({
        orderId: "ord_beta",
        provider: "MOCK",
        status: "READY",
        checkoutUrl: "http://localhost:3000/checkout/ord_beta"
      }, 201);
    }

    return textResponse("not found", 404);
  };
}

function failedCheckNames(report: ProductionReport) {
  return report.checks.filter((check) => !check.ok).map((check) => check.name);
}

describe("vercel production verification", () => {
  it("passes when Vercel is configured as paid production", async () => {
    const report = await createVercelProductionReport({
      baseUrl: "https://iddopel.vercel.app",
      username: "vercelprod",
      fetchImpl: productionFetch()
    });

    expect(report.ok).toBe(true);
    expect(report.baseUrl).toBe("https://iddopel.vercel.app");
    expect(failedCheckNames(report)).toEqual([]);
  });

  it("fails when production cron endpoints are publicly executable", async () => {
    const report = await createVercelProductionReport({
      baseUrl: "https://iddopel.vercel.app",
      username: "vercelprod",
      fetchImpl: productionFetch({ publicCron: true })
    });

    expect(report.ok).toBe(false);
    expect(failedCheckNames(report)).toEqual(
      expect.arrayContaining([
        "/api/cron/prune rejects public requests",
        "/api/cron/monitoring rejects public requests"
      ])
    );
  });

  it("fails for the free beta deployment shape", async () => {
    const report = await createVercelProductionReport({
      baseUrl: "https://iddopel.vercel.app",
      username: "vercelbeta",
      fetchImpl: betaFetch()
    });

    expect(report.ok).toBe(false);
    expect(failedCheckNames(report)).toEqual(
      expect.arrayContaining([
        "production storage is Postgres",
        "production payment provider is live",
        "production scan response does not inline paid artifacts",
        "one-time free detailed report is disabled for production",
        "live checkout URL is created",
        "checkout order uses live provider"
      ])
    );
  });

  it("rejects localhost targets for production verification", async () => {
    const report = await createVercelProductionReport({
      baseUrl: "http://localhost:3000",
      username: "local",
      fetchImpl: productionFetch()
    });

    expect(report.ok).toBe(false);
    expect(failedCheckNames(report)).toContain("production URL is HTTPS");
  });
});
