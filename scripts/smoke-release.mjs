const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const username = process.env.SMOKE_USERNAME || `smoke${Date.now().toString().slice(-9)}`;
const confirmPayment = process.env.SMOKE_CONFIRM_PAYMENT || "mock";
const smokeRateLimitIp = process.env.SMOKE_RATE_LIMIT_IP || `203.0.113.${(Date.now() % 200) + 20}`;

const requiredHeaders = [
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy"
];

async function main() {
  const home = await request("/");
  assert(home.status === 200, "home page should return 200", home);
  for (const header of requiredHeaders) {
    assert(home.headers.has(header), `missing security header: ${header}`);
  }

  const health = await requestJson("/api/health");
  assert(health.status === 200 && health.body?.ok === true, "health endpoint should be ok", health);
  assert(health.body.service === "id-doppelganger", "health endpoint should report service name", health.body);

  const telemetry = await requestJson("/api/telemetry", {
    method: "POST",
    body: {
      name: "page_view",
      path: "/release-smoke",
      occurredAt: new Date().toISOString()
    }
  });
  assert(telemetry.status === 202 && telemetry.body?.ok === true, "telemetry endpoint should accept launch probe", telemetry);

  const scan = await requestJson("/api/scans", {
    method: "POST",
    body: {
      username,
      purpose: "SELF_CHECK",
      mode: "QUICK"
    }
  });
  assert(scan.status === 201 && scan.body?.scanId, "scan creation should return a scan id", scan);

  const summary = await requestJson(`/api/scans/${scan.body.scanId}/summary`);
  assert(summary.status === 200 && summary.body?.status === "COMPLETED", "scan summary should be completed", summary);

  const order = await requestJson("/api/orders", {
    method: "POST",
    body: { scanId: scan.body.scanId }
  });
  assert(order.status === 201 && order.body?.orderId && order.body?.checkoutUrl, "order creation should return checkout", order);

  const lockedResults = await requestJson(`/api/scans/${scan.body.scanId}/results?access=full`);
  assert(lockedResults.status === 402 && lockedResults.body?.access === "LOCKED", "full results should be locked before payment", lockedResults);

  const lockedPdf = await request(`/api/scans/${scan.body.scanId}/report.pdf`);
  assert(lockedPdf.status === 402, "PDF report should be locked before payment", lockedPdf);

  const output = {
    baseUrl,
    username,
    scanId: scan.body.scanId,
    orderId: order.body.orderId,
    checkoutUrl: order.body.checkoutUrl,
    paidReport: false,
    deleted: false
  };

  if (confirmPayment !== "skip") {
    const paid = await requestJson("/api/payments/mock/confirm", {
      method: "POST",
      body: { orderId: order.body.orderId }
    });
    assert(paid.status === 200 && paid.body?.reportToken, "mock payment confirmation should return report token", paid);

    const token = encodeURIComponent(paid.body.reportToken);
    const fullResults = await requestJson(`/api/scans/${scan.body.scanId}/results?access=full&token=${token}`);
    assert(fullResults.status === 200 && fullResults.body?.access === "FULL", "full results should unlock after payment", fullResults);

    const html = await request(`/api/scans/${scan.body.scanId}/report.html?token=${token}`);
    assert(html.status === 200 && html.headers.get("content-type")?.includes("text/html"), "HTML report should download", html);

    const pdf = await request(`/api/scans/${scan.body.scanId}/report.pdf?token=${token}`);
    const pdfBytes = new Uint8Array(await pdf.arrayBuffer());
    const pdfHeader = new TextDecoder().decode(pdfBytes.slice(0, 5));
    assert(pdf.status === 200 && pdf.headers.get("content-type")?.includes("application/pdf"), "PDF report should download", pdf);
    assert(pdfHeader === "%PDF-", "PDF report should have a PDF header", { pdfHeader });

    output.paidReport = true;
    output.pdfBytes = pdfBytes.length;
  }

  const deleted = await requestJson(`/api/scans/${scan.body.scanId}`, { method: "DELETE" });
  assert(deleted.status === 200 && deleted.body?.deleted === true, "scan deletion should succeed", deleted);
  output.deleted = true;

  console.log(JSON.stringify({ ok: true, ...output }, null, 2));
}

async function requestJson(path, options = {}) {
  const response = await request(path, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, headers: response.headers, body };
}

async function request(path, options = {}) {
  const body = options.body ? JSON.stringify(options.body) : undefined;
  return fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      "x-forwarded-for": smokeRateLimitIp,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body
  });
}

function assert(condition, message, details) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

main().catch((error) => {
  console.error(error.message);
  if (error.details) {
    console.error(JSON.stringify(error.details, null, 2));
  }
  process.exit(1);
});
