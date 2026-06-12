import { expect, test } from "@playwright/test";
import { watchBrowserErrors } from "./browser-errors";

test("paid report entitlement unlocks browser report and downloads", async ({ page, request }, testInfo) => {
  const browserMessages = watchBrowserErrors(page);
  const username = `e2e_${Date.now().toString(36)}`;
  const scanHeaders = { "x-forwarded-for": `198.51.100.${testInfo.workerIndex + 10}` };
  const scanResponse = await request.post("/api/scans", {
    headers: scanHeaders,
    data: {
      username,
      purpose: "self_check",
      mode: "quick"
    }
  });
  expect(scanResponse.status()).toBe(201);
  const scan = (await scanResponse.json()) as { scanId: string };

  try {
    const lockedResponse = await request.get(`/api/scans/${scan.scanId}/results?access=full`);
    expect(lockedResponse.status()).toBe(402);

    const orderResponse = await request.post("/api/orders", {
      data: { scanId: scan.scanId }
    });
    expect(orderResponse.status()).toBe(201);
    const order = (await orderResponse.json()) as { orderId: string };

    const paymentResponse = await request.post("/api/payments/mock/confirm", {
      data: { orderId: order.orderId }
    });
    expect(paymentResponse.status()).toBe(200);
    const payment = (await paymentResponse.json()) as {
      reportToken: string;
      reportUrl: string;
    };
    expect(payment.reportToken.length).toBeGreaterThan(20);

    const fullResponse = await request.get(`/api/scans/${scan.scanId}/results?access=full&token=${encodeURIComponent(payment.reportToken)}`);
    expect(fullResponse.ok()).toBeTruthy();
    const fullReport = (await fullResponse.json()) as { access: string; results: unknown[] };
    expect(fullReport.access).toBe("FULL");
    expect(fullReport.results.length).toBeGreaterThan(0);

    const pdfResponse = await request.get(`/api/scans/${scan.scanId}/report.pdf?token=${encodeURIComponent(payment.reportToken)}`);
    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
    const pdfBody = await pdfResponse.body();
    expect(pdfBody.subarray(0, 5).toString()).toBe("%PDF-");

    await page.goto(payment.reportUrl);
    await expect(page.getByRole("heading", { name: "정밀 리포트" })).toBeVisible();
    const reportSummary = page.getByLabel("정밀 리포트 결과 요약");
    await expect(reportSummary).toContainText("발견 결과");
    await expect(reportSummary).toContainText(`${fullReport.results.length}개`);
    await expect(page.getByRole("heading", { name: "아이디가 남은 플랫폼" })).toBeVisible();
    await expect(page.getByRole("link", { name: /PDF 리포트 다운로드/ })).toBeVisible();
    const reportFrame = page.frameLocator('iframe[title="HTML 리포트 미리보기"]');
    await expect(reportFrame.getByText(new RegExp(username)).first()).toBeVisible();

    expect(browserMessages).toEqual([]);
  } finally {
    await request.delete(`/api/scans/${scan.scanId}`);
  }
});

test("first detailed report is free once per browser owner token", async ({ request }, testInfo) => {
  const firstScanResponse = await request.post("/api/scans", {
    headers: { "x-forwarded-for": `198.51.100.${testInfo.workerIndex + 40}` },
    data: {
      username: `free_${Date.now().toString(36)}`,
      purpose: "self_check",
      mode: "quick"
    }
  });
  expect(firstScanResponse.status()).toBe(201);
  const firstScan = (await firstScanResponse.json()) as { scanId: string };

  const firstFreeResponse = await request.post(`/api/scans/${firstScan.scanId}/free-report`, {
    headers: { "x-forwarded-for": `198.51.100.${testInfo.workerIndex + 40}` },
    data: {}
  });
  expect(firstFreeResponse.status()).toBe(201);
  const firstFree = (await firstFreeResponse.json()) as { ownerToken: string; reportToken: string };

  const fullResponse = await request.get(
    `/api/scans/${firstScan.scanId}/results?access=full&token=${encodeURIComponent(firstFree.reportToken)}`
  );
  expect(fullResponse.ok()).toBeTruthy();
  const fullReport = (await fullResponse.json()) as { access: string; results: unknown[] };
  expect(fullReport.access).toBe("FULL");
  expect(fullReport.results.length).toBeGreaterThan(0);

  const secondScanResponse = await request.post("/api/scans", {
    headers: { "x-forwarded-for": `198.51.100.${testInfo.workerIndex + 41}` },
    data: {
      username: `paid_${Date.now().toString(36)}`,
      purpose: "self_check",
      mode: "quick"
    }
  });
  expect(secondScanResponse.status()).toBe(201);
  const secondScan = (await secondScanResponse.json()) as { scanId: string };

  const secondFreeResponse = await request.post(`/api/scans/${secondScan.scanId}/free-report`, {
    headers: { "x-forwarded-for": `198.51.100.${testInfo.workerIndex + 41}` },
    data: { ownerToken: firstFree.ownerToken }
  });
  expect(secondFreeResponse.status()).toBe(409);

  await request.delete(`/api/scans/${firstScan.scanId}`);
  await request.delete(`/api/scans/${secondScan.scanId}`);
});
