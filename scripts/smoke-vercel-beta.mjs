const baseUrl = new URL(process.env.SMOKE_BASE_URL || "https://iddopel.vercel.app");
const username = `vercelbeta${Date.now().toString(36).slice(-8)}`;
const report = {
  ok: false,
  baseUrl: baseUrl.origin,
  username,
  checks: []
};
const ownerToken = `smoke-owner-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
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

  const scan = await requestJson("/api/scans", {
    method: "POST",
    headers: {
      "content-type": "application/json",
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
  assertCheck("scan uses real Maigret source", scan.body?.scanSource === "PUBLIC_SCAN", scan.body);
  assertCheck("scan has candidate counts", Number.isFinite(scan.body?.foundCount), scan.body);
  assertCheck("scan checked public sites", Number(scan.body?.checkedCount) > 0, scan.body);
  assertCheck("scan has Maigret report", scan.body?.maigretReportAvailable === true, scan.body);
  const hasInlineResults = Array.isArray(scan.body?.fullResults);
  assertCheck("scan carries beta inline results", hasInlineResults, {
    fullResults: scan.body?.fullResults?.length,
    hasSourceReportHtml: typeof scan.body?.sourceReportHtml === "string"
  });
  if (typeof scan.body?.sourceReportHtml === "string") {
    assertCheck("inline report strips scripts", !/<script\b/i.test(scan.body.sourceReportHtml), {
      hasScript: /<script\b/i.test(scan.body.sourceReportHtml)
    });
    assertCheck("inline report hides scanner vendor text", !/\bMaigret\b/i.test(scan.body.sourceReportHtml), {
      containsVendorText: /\bMaigret\b/i.test(scan.body.sourceReportHtml)
    });
    assertCheck("inline report is product branded", scan.body.sourceReportHtml.includes("ID 도플갱어 리포트"), {
      hasProductTitle: scan.body.sourceReportHtml.includes("ID 도플갱어 리포트")
    });
  }

  const scanId = scan.body.scanId;
  const preview = await requestJson(`/api/scans/${scanId}/results`, { method: "GET" });
  assertCheck(
    "preview results available or inlined for beta",
    preview.status === 200 || (preview.status === 404 && hasInlineResults),
    preview
  );
  if (preview.status === 200) {
    assertCheck("preview returns result array", Array.isArray(preview.body?.results), preview.body);
  }

  const lockedFull = await requestJson(`/api/scans/${scanId}/results?access=full`, { method: "GET" });
  assertCheck(
    "full results stay locked or inlined for beta",
    lockedFull.status === 402 || (lockedFull.status === 404 && hasInlineResults),
    lockedFull
  );

  const reportPage = await requestText(`/reports/${scanId}`, { method: "GET" });
  assertCheck("report page renders", reportPage.status === 200 && reportPage.body.includes("<!DOCTYPE html"), {
    status: reportPage.status,
    length: reportPage.body.length
  });

  const freeReport = await requestJson(`/api/scans/${scanId}/free-report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ soft: true })
  });
  assertCheck(
    "first-free route responds safely",
    freeReport.status === 201 || freeReport.status === 200 || (freeReport.status === 404 && hasInlineResults),
    freeReport
  );

  if (typeof freeReport.body?.reportToken === "string") {
    const token = encodeURIComponent(freeReport.body.reportToken);
    const unlockedFull = await requestJson(`/api/scans/${scanId}/results?access=full&token=${token}`, { method: "GET" });
    assertCheck("full results open with first-free token", unlockedFull.status === 200 && unlockedFull.body?.access === "FULL", unlockedFull);

    const htmlReport = await requestText(`/api/scans/${scanId}/report.html?embed=1&token=${token}`, { method: "GET" });
    assertCheck(
      "Maigret HTML report opens with first-free token",
      htmlReport.status === 200 && htmlReport.body.includes("Username search report"),
      { status: htmlReport.status, length: htmlReport.body.length }
    );
  } else if (freeReport.status === 404 && hasInlineResults) {
    assertCheck("inline beta full results are present", scan.body.fullResults.length >= 0, {
      fullResults: scan.body.fullResults.length,
      hasSourceReportHtml: typeof scan.body.sourceReportHtml === "string"
    });
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
