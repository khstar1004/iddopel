import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const requiredSecurityHeaders = [
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy"
];

const livePaymentProviders = new Set(["toss", "polar"]);
const protectedCronPaths = ["/api/cron/prune", "/api/cron/monitoring"];

export async function createVercelProductionReport({
  baseUrl = process.env.VERCEL_PRODUCTION_BASE_URL || process.env.PRODUCTION_BASE_URL || process.env.SMOKE_BASE_URL || "https://iddopel.vercel.app",
  username = process.env.SMOKE_USERNAME || `vercelprod${Date.now().toString(36).slice(-8)}`,
  fetchImpl = fetch
} = {}) {
  const report = {
    ok: false,
    baseUrl: "",
    username,
    checks: []
  };

  let parsedBaseUrl;
  try {
    parsedBaseUrl = normalizeBaseUrl(baseUrl);
    report.baseUrl = parsedBaseUrl.origin;
    addCheck(report, "production URL is HTTPS", true, { baseUrl: parsedBaseUrl.origin });
  } catch (error) {
    report.baseUrl = String(baseUrl || "");
    addCheck(report, "production URL is HTTPS", false, { error: error instanceof Error ? error.message : String(error) });
    return report;
  }

  const requestJson = (pathname, init) => request(fetchImpl, parsedBaseUrl, pathname, init, "json");
  const requestText = (pathname, init) => request(fetchImpl, parsedBaseUrl, pathname, init, "text");

  try {
    const home = await requestText("/", { method: "GET" });
    addCheck(report, "home page renders", home.status === 200 && home.body.includes("ID 도플갱어"), {
      status: home.status,
      length: home.body.length
    });
    for (const header of requiredSecurityHeaders) {
      addCheck(report, `security header ${header}`, home.headers.has(header), {
        status: home.status,
        value: home.headers.get(header)
      });
    }
    addCheck(report, "framework header hidden", !home.headers.has("x-powered-by"), {
      value: home.headers.get("x-powered-by")
    });

    for (const pathname of ["/privacy", "/terms", "/responsible-use", "/toss"]) {
      const page = await requestText(pathname, { method: "GET" });
      addCheck(report, `${pathname} renders`, page.status === 200 && page.body.includes("<!DOCTYPE html"), {
        status: page.status,
        length: page.body.length
      });
    }

    const robots = await requestText("/robots.txt", { method: "GET" });
    addCheck(report, "robots.txt renders", robots.status === 200 && /User-agent:/i.test(robots.body), {
      status: robots.status
    });

    const sitemap = await requestText("/sitemap.xml", { method: "GET" });
    addCheck(report, "sitemap.xml renders", sitemap.status === 200 && sitemap.body.includes("<urlset"), {
      status: sitemap.status,
      length: sitemap.body.length
    });

    const health = await requestJson("/api/health", { method: "GET" });
    addCheck(report, "health endpoint ok", health.status === 200 && health.body?.ok === true, health);
    addCheck(report, "production storage is Postgres", health.body?.storage === "postgres", health.body);
    addCheck(report, "production scan provider is Maigret", health.body?.scanProvider === "maigret", health.body);
    addCheck(report, "production payment provider is live", livePaymentProviders.has(health.body?.paymentProvider), health.body);

    for (const pathname of protectedCronPaths) {
      const cron = await requestJson(pathname, { method: "GET" });
      addCheck(
        report,
        `${pathname} rejects public requests`,
        cron.status === 401 && cron.body?.error?.code === "UNAUTHORIZED",
        cron
      );
    }

    const ownerToken = `vercel-prod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const scan = await requestJson("/api/scans", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-scan-owner-token": ownerToken,
        "x-forwarded-for": `198.51.100.${(Date.now() % 200) + 20}`
      },
      body: JSON.stringify({
        username,
        purpose: "SELF_CHECK",
        mode: "QUICK"
      })
    });
    addCheck(report, "scan creates a completed report candidate", scan.status === 201 && typeof scan.body?.scanId === "string", scan);
    addCheck(report, "scan uses real public source", scan.body?.scanSource === "PUBLIC_SCAN", scan.body);
    addCheck(report, "scan checks public sites", Number(scan.body?.checkedCount) > 0, scan.body);
    addCheck(
      report,
      "production scan response does not inline paid artifacts",
      !Array.isArray(scan.body?.fullResults) && typeof scan.body?.sourceReportHtml !== "string",
      {
        hasFullResults: Array.isArray(scan.body?.fullResults),
        hasSourceReportHtml: typeof scan.body?.sourceReportHtml === "string"
      }
    );

    const scanId = scan.body?.scanId;
    if (typeof scanId === "string") {
      const lockedResults = await requestJson(`/api/scans/${encodeURIComponent(scanId)}/results?access=full`, {
        method: "GET"
      });
      addCheck(
        report,
        "full results are paywalled before checkout",
        lockedResults.status === 402 && lockedResults.body?.access === "LOCKED",
        lockedResults
      );

      const freeReport = await requestJson(`/api/scans/${encodeURIComponent(scanId)}/free-report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ soft: true })
      });
      addCheck(
        report,
        "one-time free detailed report is disabled for production",
        freeReport.status === 200 && freeReport.body?.error?.code === "WEB_PAYWALL_ENABLED" && !freeReport.body?.reportToken,
        freeReport
      );

      const order = await requestJson("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scanId })
      });
      addCheck(
        report,
        "live checkout URL is created",
        order.status === 201 && typeof order.body?.checkoutUrl === "string" && /^https:\/\//.test(order.body.checkoutUrl),
        sanitizeOrderDetail(order)
      );
      addCheck(report, "checkout order uses live provider", ["TOSS", "POLAR"].includes(order.body?.provider), {
        provider: order.body?.provider
      });
    }

    const monitoringLocked = await requestJson("/api/monitoring", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ usernames: ["example-user"], purpose: "SELF_CHECK" })
    });
    addCheck(
      report,
      "monitoring registration is paywalled",
      monitoringLocked.status === 402 && monitoringLocked.body?.error?.code === "MONITORING_PAYMENT_REQUIRED",
      monitoringLocked
    );
  } catch (error) {
    addCheck(report, "production verification request completed", false, {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  report.ok = report.checks.every((check) => check.ok);
  return report;
}

function normalizeBaseUrl(value) {
  const parsed = new URL(String(value || "").trim());
  if (parsed.protocol !== "https:") {
    throw new Error("Use an HTTPS production URL.");
  }
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"].includes(parsed.hostname.toLowerCase())) {
    throw new Error("Use a public production URL, not localhost.");
  }
  return new URL(parsed.origin);
}

async function request(fetchImpl, baseUrl, pathname, init = {}, responseType) {
  const response = await fetchImpl(new URL(pathname, baseUrl), init);
  const text = await response.text();
  let body = text;
  if (responseType === "json") {
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
  }
  return {
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    body
  };
}

function addCheck(report, name, ok, detail) {
  report.checks.push({ name, ok: Boolean(ok), detail });
}

function sanitizeOrderDetail(order) {
  if (!order?.body || typeof order.body !== "object") return order;
  return {
    status: order.status,
    ok: order.ok,
    body: {
      orderId: order.body.orderId,
      provider: order.body.provider,
      status: order.body.status,
      checkoutUrlHost: typeof order.body.checkoutUrl === "string" ? safeHost(order.body.checkoutUrl) : null
    }
  };
}

function safeHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

async function main() {
  const report = await createVercelProductionReport();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

function isMainModule() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
