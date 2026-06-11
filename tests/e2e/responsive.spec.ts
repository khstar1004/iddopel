import { expect, test } from "@playwright/test";
import { watchBrowserErrors } from "./browser-errors";

test("landing page is responsive across release smoke widths", async ({ page, request }) => {
  const browserMessages = watchBrowserErrors(page);

  await page.goto("/");
  await expect(page.locator("body")).toContainText("ID 도플갱어");

  const usernameInput = page.getByLabel("아이디 입력");
  await expect(usernameInput).toBeVisible();
  await usernameInput.fill("brand_lab");
  await expect(usernameInput).toHaveValue("brand_lab");

  const purposeAck = page.getByLabel(/정당한 목적으로/);
  await purposeAck.check();
  await expect(purposeAck).toBeChecked();
  const submitButton = page.getByRole("button", { name: "내 아이디 흔적 찾기" });
  await expect(submitButton).toBeVisible();
  await expect(submitButton).toBeEnabled();

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  const manifestBody = (await manifest.json()) as { name?: string; icons?: unknown[] };
  expect(manifestBody.name).toContain("ID 도플갱어");
  expect(manifestBody.icons?.length).toBeGreaterThanOrEqual(4);

  expect(browserMessages).toEqual([]);
});

test("language switch exposes a shareable English version", async ({ page }) => {
  const browserMessages = watchBrowserErrors(page);

  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Where is your username still public?" })).toBeVisible();
  await expect(page.getByLabel("Username input")).toBeVisible();
  await expect(page.getByRole("button", { name: "Find my username traces" })).toBeDisabled();

  await page.getByRole("link", { name: "한국어" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.getByRole("heading", { name: "내 아이디, 어디에 남아 있을까?" })).toBeVisible();

  expect(browserMessages).toEqual([]);
});

test("result cards stay dense enough on narrow screens", async ({ page }) => {
  const browserMessages = watchBrowserErrors(page);
  const viewport = page.viewportSize();
  const now = new Date().toISOString();

  await page.route("**/api/scans", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        scanId: `scan_result_density_${viewport?.width ?? 0}`,
        username: "densitycheck",
        purpose: "SELF_CHECK",
        mode: "QUICK",
        status: "COMPLETED",
        progress: 100,
        foundCount: 5,
        checkedCount: 109,
        failedRate: 7,
        doppelgangerScore: 68,
        rarityScore: 74,
        exposureScore: 42,
        impersonationScore: 31,
        cleanupScore: 58,
        countryDistribution: { KR: 1, GLOBAL: 4 },
        categoryDistribution: { BLOG: 1, SNS: 2, DEVELOPER: 1, CREATOR: 1 },
        scanSource: "PUBLIC_SCAN",
        maigretReportAvailable: true,
        maigretReportFilename: "report_densitycheck_plain.html",
        createdAt: now,
        finishedAt: now,
        expiresAt: now,
        previewResults: [
          {
            id: "naver-density",
            platform: "Naver Blog",
            url: "https://blog.naver.com/densitycheck",
            platformUrl: "https://blog.naver.com",
            category: "BLOG",
            country: "KR",
            status: "FOUND",
            riskLevel: "MEDIUM",
            cleanupHint: "오래된 글과 소개 문구의 공개 범위를 확인하세요.",
            tags: ["kr", "blog"],
            httpStatus: 200
          },
          {
            id: "github-density",
            platform: "GitHub",
            url: "https://github.com/densitycheck",
            platformUrl: "https://github.com",
            category: "DEVELOPER",
            country: "GLOBAL",
            status: "FOUND",
            riskLevel: "MEDIUM",
            cleanupHint: "README와 저장소 공개 설정을 확인하세요.",
            tags: ["code", "global"],
            rank: 12
          },
          {
            id: "instagram-density",
            platform: "Instagram",
            url: "https://instagram.com/densitycheck",
            platformUrl: "https://instagram.com",
            category: "SNS",
            country: "GLOBAL",
            status: "FOUND",
            riskLevel: "HIGH",
            cleanupHint: "프로필 소개와 오래된 공개 게시물 노출을 점검하세요.",
            tags: ["social"]
          }
        ]
      })
    });
  });
  await page.route("**/api/scans/*/free-report", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reportToken: "density-token" })
    });
  });
  await page.route("**/api/scans/*/results?access=full**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access: "FULL",
        label: "1회 무료 상세 결과",
        description: "첫 상세 리포트가 무료로 열렸어요.",
        lockedCount: 0,
        reportToken: "density-token",
        scanId: `scan_result_density_${viewport?.width ?? 0}`,
        maigretReportAvailable: true,
        maigretReportFilename: "report_densitycheck_plain.html",
        results: [
          {
            id: "naver-density",
            platform: "Naver Blog",
            url: "https://blog.naver.com/densitycheck",
            platformUrl: "https://blog.naver.com",
            category: "BLOG",
            country: "KR",
            status: "FOUND",
            riskLevel: "MEDIUM",
            cleanupHint: "오래된 글과 소개 문구의 공개 범위를 확인하세요.",
            tags: ["kr", "blog"],
            httpStatus: 200
          },
          {
            id: "github-density",
            platform: "GitHub",
            url: "https://github.com/densitycheck",
            platformUrl: "https://github.com",
            category: "DEVELOPER",
            country: "GLOBAL",
            status: "FOUND",
            riskLevel: "MEDIUM",
            cleanupHint: "README와 저장소 공개 설정을 확인하세요.",
            tags: ["code", "global"],
            rank: 12
          },
          {
            id: "instagram-density",
            platform: "Instagram",
            url: "https://instagram.com/densitycheck",
            platformUrl: "https://instagram.com",
            category: "SNS",
            country: "GLOBAL",
            status: "FOUND",
            riskLevel: "HIGH",
            cleanupHint: "프로필 소개와 오래된 공개 게시물 노출을 점검하세요.",
            tags: ["social"]
          }
        ]
      })
    });
  });
  await page.route("**/api/scans/*/source-report.html**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><body><h1>HTML report</h1></body></html>"
    });
  });

  await page.goto("/");
  await page.getByLabel("아이디 입력").fill("densitycheck");
  await page.getByLabel(/정당한 목적으로/).check();
  const scanResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/scans") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "내 아이디 흔적 찾기" }).click();
  await scanResponsePromise;
  await expect(page.getByRole("heading", { name: "densitycheck가 남아 있는 곳" })).toBeVisible();

  const cards = page.locator(".result-first-panel .rich-result-card");
  await expect(cards.first()).toBeInViewport();

  if ((viewport?.width ?? 0) <= 520) {
    const firstCardBox = await cards.first().boundingBox();
    const secondCardBox = await cards.nth(1).boundingBox();
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(firstCardBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(280);
    expect(secondCardBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(viewport?.height ?? 0);
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  }

  expect(browserMessages).toEqual([]);
});
