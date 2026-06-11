import { expect, test } from "@playwright/test";
import { watchBrowserErrors } from "./browser-errors";

test("Toss in-app flow scans a username and opens detailed report checkout", async ({ page, request }, testInfo) => {
  const browserMessages = watchBrowserErrors(page);
  const username = `toss_${Date.now().toString(36)}`;
  let scanId: string | null = null;

  try {
    await page.goto("/toss");

    await expect(page.getByRole("heading", { name: "아이디 공개 후보 확인" })).toBeVisible();
    await page.getByRole("textbox", { name: "아이디" }).fill(username);
    await page.getByLabel(/정당한 목적/).check();

    const scanResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/scans") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "공개 후보 확인" }).click();
    const scanResponse = await scanResponsePromise;
    expect(scanResponse.status()).toBe(201);
    scanId = ((await scanResponse.json()) as { scanId: string }).scanId;

    const resultRegion = page.getByRole("region", { name: "점검 결과" });
    await expect(resultRegion).toContainText("잡힌 공개 후보");
    await expect(page.locator(".toss-result-card").first()).toBeVisible();
    await expect(resultRegion).toContainText("상세 URL 잠김");
    await expect(resultRegion).toContainText("점수");
    const resultComesBeforeScore = await page.evaluate(() => {
      const firstCard = document.querySelector(".toss-result-card");
      const score = document.querySelector(".toss-score-summary");
      return Boolean(firstCard && score && firstCard.compareDocumentPosition(score) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(resultComesBeforeScore).toBe(true);
    await expect(page.getByRole("button", { name: "전체 리포트 보기" })).toBeVisible();

    const orderResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/orders") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "전체 리포트 보기" }).click();
    const orderResponse = await orderResponsePromise;
    expect(orderResponse.status()).toBe(201);

    await page.waitForURL(/\/checkout\//);
    await expect(page.getByRole("heading", { name: "정밀 리포트 결제" })).toBeVisible();
    expect(browserMessages).toEqual([]);
  } finally {
    if (scanId) {
      await request.delete(`/api/scans/${scanId}`, {
        headers: { "x-forwarded-for": `198.51.100.${testInfo.workerIndex + 60}` }
      });
    }
  }
});
