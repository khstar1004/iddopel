const baseUrl = new URL(process.env.SMOKE_BASE_URL || "https://iddopel.vercel.app");
const username = `vercelbeta${Date.now().toString(36).slice(-8)}`;
const report = {
  ok: false,
  baseUrl: baseUrl.origin,
  username,
  checks: []
};
const ownerToken = `smoke-owner-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const smokeHeaders = {
  "user-agent": `id-doppelganger-smoke/${Date.now().toString(36)}`,
  "accept-language": `ko-KR,smoke-${Math.random().toString(36).slice(2)}`
};
const requiredHeaders = [
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy"
];

try {
  const home = await requestText("/", { method: "GET" });
  assertCheck("home page renders", home.status === 200 && home.body.includes("ID 도플갱어"), {
    status: home.status,
    length: home.body.length
  });
  for (const header of requiredHeaders) {
    assertCheck(`home security header ${header}`, home.headers.has(header), {
      status: home.status,
      value: home.headers.get(header)
    });
  }
  assertCheck("home hides framework header", !home.headers.has("x-powered-by"), {
    value: home.headers.get("x-powered-by")
  });

  for (const pathname of ["/privacy", "/terms", "/responsible-use", "/toss"]) {
    const page = await requestText(pathname, { method: "GET" });
    assertCheck(`${pathname} renders`, page.status === 200 && page.body.includes("<!DOCTYPE html"), {
      status: page.status,
      length: page.body.length
    });
  }

  const robots = await requestText("/robots.txt", { method: "GET" });
  assertCheck("robots.txt renders", robots.status === 200 && /User-agent:/i.test(robots.body), {
    status: robots.status,
    body: robots.body.slice(0, 120)
  });

  const sitemap = await requestText("/sitemap.xml", { method: "GET" });
  assertCheck("sitemap.xml renders", sitemap.status === 200 && sitemap.body.includes("<urlset"), {
    status: sitemap.status,
    length: sitemap.body.length
  });

  const manifest = await requestJson("/manifest.webmanifest", { method: "GET" });
  assertCheck("web manifest renders", manifest.status === 200 && manifest.body?.name?.includes("ID 도플갱어"), manifest);

  const health = await requestJson("/api/health", { method: "GET" });
  assertCheck("health ok", health.status === 200 && health.body?.ok === true, health);
  assertCheck("beta scan provider", health.body?.scanProvider === "maigret", health.body);
  assertCheck("beta payment provider", health.body?.paymentProvider === "mock", health.body);

  for (const pathname of ["/api/cron/prune", "/api/cron/monitoring"]) {
    const cron = await requestJson(pathname, { method: "GET" });
    assertCheck(
      `${pathname} is not publicly executable`,
      [401, 500].includes(cron.status) && ["UNAUTHORIZED", "MISCONFIGURED"].includes(cron.body?.error?.code),
      cron
    );
  }

  const scan = await requestJson("/api/scans", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...smokeHeaders,
      "x-scan-owner-token": ownerToken
    },
    body: JSON.stringify({
      username,
      purpose: "SELF_CHECK",
      mode: "QUICK"
    })
  });

  assertCheck("scan created", scan.status === 201, scan);
  assertCheck("scan has id", typeof scan.body?.scanId === "string" && scan.body.scanId.length > 0, scan.body);
  assertCheck("scan uses real public scan source", scan.body?.scanSource === "PUBLIC_SCAN", scan.body);
  assertCheck("scan has candidate counts", Number.isFinite(scan.body?.foundCount), scan.body);
  assertCheck("scan checked public sites", Number(scan.body?.checkedCount) > 0, scan.body);
  assertCheck("scan has source report", scan.body?.maigretReportAvailable === true, scan.body);
  assertCheck("public scan response hides full results", !Array.isArray(scan.body?.fullResults), {
    hasFullResults: Array.isArray(scan.body?.fullResults)
  });
  assertCheck("public scan response hides source HTML", typeof scan.body?.sourceReportHtml !== "string", {
    hasSourceReportHtml: typeof scan.body?.sourceReportHtml === "string"
  });

  const scanId = scan.body.scanId;
  const preview = await requestJson(`/api/scans/${scanId}/results`, { method: "GET" });
  assertCheck("preview results available", preview.status === 200, preview);
  if (preview.status === 200) {
    assertCheck("preview returns result array", Array.isArray(preview.body?.results), preview.body);
    assertCheck("preview includes safe locked cards", Array.isArray(preview.body?.lockedResults), preview.body);
  }

  const lockedFull = await requestJson(`/api/scans/${scanId}/results?access=full`, { method: "GET" });
  assertCheck("full results stay locked", lockedFull.status === 402, lockedFull);

  const reportPage = await requestText(`/reports/${scanId}`, { method: "GET" });
  assertCheck("report page renders", reportPage.status === 200 && reportPage.body.includes("<!DOCTYPE html"), {
    status: reportPage.status,
    length: reportPage.body.length
  });

  const freeReport = await requestJson(`/api/scans/${scanId}/free-report`, {
    method: "POST",
    headers: { "content-type": "application/json", ...smokeHeaders },
    body: JSON.stringify({ soft: true })
  });
  assertCheck(
    "first-free route responds safely",
    freeReport.status === 201 || freeReport.status === 200,
    freeReport
  );

  if (typeof freeReport.body?.reportToken === "string") {
    const token = encodeURIComponent(freeReport.body.reportToken);
    const unlockedFull = await requestJson(`/api/scans/${scanId}/results?access=full&token=${token}`, { method: "GET" });
    assertCheck("full results open with first-free token", unlockedFull.status === 200 && unlockedFull.body?.access === "FULL", unlockedFull);

    const htmlReport = await requestText(`/api/scans/${scanId}/report.html?embed=1&token=${token}`, { method: "GET" });
    assertCheck(
      "HTML report opens with first-free token",
      htmlReport.status === 200 && htmlReport.body.includes("ID 도플갱어 리포트") && !/\bMaigret\b/i.test(htmlReport.body),
      {
        status: htmlReport.status,
        length: htmlReport.body.length,
        hasProductTitle: htmlReport.body.includes("ID 도플갱어 리포트"),
        containsVendorText: /\bMaigret\b/i.test(htmlReport.body)
      }
    );
  } else {
    assertCheck("first-free repeat is explicit", freeReport.body?.error?.code === "FIRST_FREE_USED", freeReport.body);
  }

  report.ok = true;
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

async function requestJson(pathname, init) {
  const response = await fetch(new URL(pathname, baseUrl), init);
  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    status: response.status,
    ok: response.ok,
    body
  };
}

async function requestText(pathname, init) {
  const response = await fetch(new URL(pathname, baseUrl), init);
  return {
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    body: await response.text()
  };
}

function assertCheck(name, ok, detail) {
  report.checks.push({ name, ok, detail });
  if (!ok) {
    throw new Error(`${name} failed`);
  }
}
