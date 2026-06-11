const baseUrl = new URL(process.env.SMOKE_BASE_URL || "https://iddopel.vercel.app");
const username = `vercelbeta${Date.now().toString(36).slice(-8)}`;
const report = {
  ok: false,
  baseUrl: baseUrl.origin,
  username,
  checks: []
};

try {
  const health = await requestJson("/api/health", { method: "GET" });
  assertCheck("health ok", health.status === 200 && health.body?.ok === true, health);
  assertCheck("beta scan provider", health.body?.scanProvider === "maigret", health.body);
  assertCheck("beta payment provider", health.body?.paymentProvider === "mock", health.body);

  const scan = await requestJson("/api/scans", {
    method: "POST",
    headers: { "content-type": "application/json" },
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

function assertCheck(name, ok, detail) {
  report.checks.push({ name, ok, detail });
  if (!ok) {
    throw new Error(`${name} failed`);
  }
}
