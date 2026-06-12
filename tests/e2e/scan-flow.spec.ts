import { expect, test, type Page } from "@playwright/test";
import { watchBrowserErrors } from "./browser-errors";

test("user can scan from landing page and delete the created record", async ({ page, request }, testInfo) => {
  const browserMessages = watchBrowserErrors(page);
  const username = `manual_${Date.now().toString(36)}`;
  const scanIp = `198.51.100.${testInfo.workerIndex + 100}`;

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as Window & { __copiedShareText?: string }).__copiedShareText = text;
        }
      }
    });
  });

  await page.route("**/api/scans", async (route) => {
    const routeRequest = route.request();
    if (routeRequest.method() !== "POST") {
      await route.continue();
      return;
    }

    await route.continue({
      headers: {
        ...routeRequest.headers(),
        "x-forwarded-for": scanIp
      }
    });
  });
  await page.route("**/api/scans/*/free-report", async (route) => {
    const routeRequest = route.request();
    await route.continue({
      headers: {
        ...routeRequest.headers(),
        "x-forwarded-for": scanIp
      }
    });
  });

  await page.goto("/");
  const usernameInput = page.getByLabel("아이디 입력");
  await usernameInput.fill(username);
  await page.getByLabel(/정당한 목적으로/).check();

  const scanResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/scans") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "내 아이디 흔적 찾기" }).click();

  const scanResponse = await scanResponsePromise;
  expect(scanResponse.status()).toBe(201);
  const scan = (await scanResponse.json()) as { scanId: string };

  const resultHeading = page.getByRole("heading", { name: `${username}로 찾은 공개 흔적` });
  await expect(resultHeading).toBeVisible();
  await expect(page.locator(".result-first-panel .source-badge", { hasText: "공개 흔적" })).toBeVisible();
  await expect(page.locator('[aria-label="결과 규모"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: new RegExp(`${username}가 남아 있는 곳|${username} 공개 흔적 없음`) })).toBeVisible();
  await expect(page.locator(".result-first-panel")).toBeInViewport();
  await expect(page.getByRole("heading", { name: "점수" })).toBeVisible();
  const resultCards = page.locator(".result-first-panel .rich-result-card");
  const resultPanelBox = await page.locator(".result-first-panel").boundingBox();
  const scoreHeadingBox = await page.getByRole("heading", { name: "점수" }).boundingBox();
  expect(resultPanelBox?.y).toBeLessThan(scoreHeadingBox?.y ?? 0);
  if ((await resultCards.count()) > 0) {
    await expect(resultCards.first()).toBeVisible();
    const firstResultBox = await resultCards.first().boundingBox();
    const viewport = page.viewportSize();
    expect(firstResultBox?.y).toBeLessThan(scoreHeadingBox?.y ?? 0);
    expect(firstResultBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(viewport?.height ?? 0);
  } else {
    await expect(page.getByText("무료 점검에서 바로 보이는 공개 흔적이 없어요.")).toBeVisible();
  }
  await expect(page.getByText(/1회 무료 상세 결과/)).toBeVisible();
  await expect(page.getByRole("button", { name: /정밀 리포트 열기|전체 리포트 보기/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "공유 카드 저장" })).toBeVisible();
  const shareCardResponse = await request.get(`/api/scans/${scan.scanId}/share.png`);
  expect(shareCardResponse.status()).toBe(200);
  expect(shareCardResponse.headers()["content-type"]).toContain("image/png");
  const shareCardBytes = await shareCardResponse.body();
  expect(shareCardBytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  expect(shareCardBytes.length).toBeGreaterThan(20_000);
  await page.getByRole("button", { name: "결과 요약 복사" }).click();
  await expect(page.getByRole("status").filter({ hasText: "공유용 요약을 복사했어요." })).toBeVisible();
  const copiedShareText = await page.evaluate(() => {
    return (window as Window & { __copiedShareText?: string }).__copiedShareText;
  });
  expect(copiedShareText).toContain(`${username} 공개 흔적`);
  expect(copiedShareText).toContain("먼저 열린 결과");
  expect(copiedShareText).toContain("발견된 계정들이 동일인이라는 뜻은 아니에요.");
  await page.getByRole("button", { name: "월간 재점검에 넣기" }).click();
  await expect(page.getByLabel("모니터링할 아이디")).toHaveValue(username);
  await page.getByRole("button", { name: "다른 아이디 점검" }).click();
  await expect(page.getByRole("heading", { name: "아이디를 입력하면 결과가 바로 떠요" })).toBeVisible();
  await page.getByRole("button", { name: `${username} 결과 다시 보기` }).click();
  await expect(resultHeading).toBeVisible();
  await expect(page.locator(".result-first-panel")).toBeInViewport();
  await expect(usernameInput).toHaveValue(username);

  const deleteResponsePromise = page.waitForResponse(
    (response) => response.url().includes(`/api/scans/${scan.scanId}`) && response.request().method() === "DELETE"
  );
  await page.locator("#results").getByRole("button", { name: "기록 삭제" }).click();

  const deleteResponse = await deleteResponsePromise;
  expect(deleteResponse.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "아이디를 입력하면 결과가 바로 떠요" })).toBeVisible();

  const deletedScanResponse = await request.get(`/api/scans/${scan.scanId}`);
  expect(deletedScanResponse.status()).toBe(404);
  expect(browserMessages).toEqual([]);
});

test("later scans after the first free report show paid preview without browser error noise", async ({ page, request }, testInfo) => {
  const browserMessages = watchBrowserErrors(page);
  const scanIds: string[] = [];
  const scanIp = `198.51.100.${testInfo.workerIndex + 120}`;

  await page.route("**/api/scans", async (route) => {
    const routeRequest = route.request();
    if (routeRequest.method() !== "POST") {
      await route.continue();
      return;
    }

    await route.continue({
      headers: {
        ...routeRequest.headers(),
        "x-forwarded-for": scanIp
      }
    });
  });
  await page.route("**/api/scans/*/free-report", async (route) => {
    const routeRequest = route.request();
    await route.continue({
      headers: {
        ...routeRequest.headers(),
        "x-forwarded-for": scanIp
      }
    });
  });

  await page.goto("/");

  scanIds.push(await submitLandingScan(page, "firstfree-ui"));
  await expect(page.locator(".action-status").filter({ hasText: /1회 무료 상세 결과|무료 미리보기/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /정밀 리포트 열기|전체 리포트 보기/ })).toBeVisible();

  await page.getByRole("button", { name: "다른 아이디 점검" }).click();
  await expect(page.getByRole("heading", { name: "아이디를 입력하면 결과가 바로 떠요" })).toBeVisible();

  scanIds.push(await submitLandingScan(page, "paidpreview-ui"));
  await expect(page.getByRole("status").filter({ hasText: "무료 미리보기" })).toBeVisible();
  await expect(page.getByText(/상세 URL \d+개 잠김/)).toBeVisible();
  await expect(page.locator(".locked-result-mosaic").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /전체 리포트 보기/ })).toBeVisible();

  expect(browserMessages).toEqual([]);

  for (const scanId of scanIds) {
    await request.delete(`/api/scans/${scanId}`);
  }
});

test("scan result cards appear immediately while detailed access is still loading", async ({ page, request }, testInfo) => {
  const browserMessages = watchBrowserErrors(page);
  const username = "instant_result";
  const scanIp = `198.51.100.${testInfo.workerIndex + 140}`;
  let scanId: string | null = null;
  let releaseFreeReport!: () => void;
  const freeReportGate = new Promise<void>((resolve) => {
    releaseFreeReport = resolve;
  });

  await page.route("**/api/scans", async (route) => {
    const routeRequest = route.request();
    if (routeRequest.method() !== "POST") {
      await route.continue();
      return;
    }

    await route.continue({
      headers: {
        ...routeRequest.headers(),
        "x-forwarded-for": scanIp
      }
    });
  });

  await page.route("**/api/scans/*/free-report", async (route) => {
    const routeRequest = route.request();
    await freeReportGate;
    await route.continue({
      headers: {
        ...routeRequest.headers(),
        "x-forwarded-for": scanIp
      }
    });
  });

  try {
    await page.goto("/");
    await page.getByLabel("아이디 입력").fill(username);
    await page.getByLabel(/정당한 목적으로/).check();

    const scanResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/scans") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "내 아이디 흔적 찾기" }).click();
    const scanResponse = await scanResponsePromise;
    expect(scanResponse.status()).toBe(201);
    scanId = ((await scanResponse.json()) as { scanId: string }).scanId;

    await expect(page.getByRole("heading", { name: `${username}로 찾은 공개 흔적` })).toBeVisible();
    await expect(page.locator(".result-first-panel .rich-result-card").first()).toBeVisible();
    await expect(page.locator(".result-first-panel .rich-result-card").first()).toBeInViewport();
    await expect(page.getByRole("status").filter({ hasText: "상세 결과 확인 중" })).toBeVisible();

    releaseFreeReport();
    await expect(page.getByRole("status").filter({ hasText: /1회 무료 상세 결과|무료 미리보기/ })).toBeVisible();
    expect(browserMessages).toEqual([]);
  } finally {
    releaseFreeReport();
    if (scanId) {
      await request.delete(`/api/scans/${scanId}`);
    }
  }
});

test("empty scans do not push the user into detailed report checkout", async ({ page }) => {
  const browserMessages = watchBrowserErrors(page);
  await installPaywalledPreviewRoutes(page, emptyScanSummary("emptycase-ui"), {
    scanId: "scan_emptycase_ui",
    access: "PREVIEW",
    lockedCount: 0,
    lockedResults: [],
    results: []
  });

  let orderRequests = 0;
  await page.route("**/api/orders", async (route) => {
    orderRequests += 1;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "UNEXPECTED_ORDER" } })
    });
  });

  await page.goto("/");
  await submitLandingScan(page, "emptycase-ui");

  await expect(page.getByText("결제할 상세 결과가 없어요.")).toBeVisible();
  await expect(page.getByRole("button", { name: /전체 리포트 보기/ })).toHaveCount(0);
  expect(orderRequests).toBe(0);
  expect(browserMessages).toEqual([]);
});

test("paywalled previews explain exactly what the detailed report unlocks", async ({ page }) => {
  const browserMessages = watchBrowserErrors(page);
  const summary = paywalledScanSummary("lockedcase-ui");
  await installPaywalledPreviewRoutes(page, summary, {
    scanId: summary.scanId,
    access: "PREVIEW",
    lockedCount: 2,
    lockedResults: summary.lockedResults,
    results: summary.previewResults
  });

  await page.goto("/");
  await submitLandingScan(page, "lockedcase-ui");

  await expect(page.getByText("결제 후 바로 열리는 항목")).toBeVisible();
  await expect(page.getByText("정확한 공개 URL")).toBeVisible();
  await expect(page.getByText("위험도 높은 계정 우선순위")).toBeVisible();
  await expect(page.getByText("정리/삭제 가이드")).toBeVisible();
  await expect(page.getByRole("button", { name: "2,900원 결제하고 전체 리포트 보기" })).toBeVisible();
  expect(browserMessages).toEqual([]);
});

test("landing form blocks disallowed identifiers before submit", async ({ page }) => {
  const browserMessages = watchBrowserErrors(page);

  await page.goto("/");
  await page.getByLabel("아이디 입력").fill("me@example.com");
  await page.getByLabel(/정당한 목적으로/).check();

  await expect(page.locator('[role="alert"]').filter({ hasText: "이메일 검색은 지원하지 않아요." })).toBeVisible();
  await expect(page.getByRole("button", { name: "내 아이디 흔적 찾기" })).toBeDisabled();

  expect(browserMessages).toEqual([]);
});

test("developer admin login stays hidden until the logo easter egg opens admin", async ({ page }) => {
  const browserMessages = watchBrowserErrors(page);

  await page.goto("/");
  await expect(page.getByLabel("개발자 비밀번호")).toHaveCount(0);
  await expect(page.getByText("개발자 테스트 로그인")).toHaveCount(0);

  const logo = page.getByLabel("ID 도플갱어 홈");
  for (let clickIndex = 0; clickIndex < 5; clickIndex += 1) {
    await logo.click();
  }

  await expect(page).toHaveURL(/\/admin$/);
  await page.getByLabel("비밀번호").fill("admin");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("heading", { name: "검색 한도 관리" })).toBeVisible();
  await expect(page.getByText("운영 상태")).toBeVisible();

  expect(browserMessages).toEqual([]);
});

async function submitLandingScan(page: Page, username: string) {
  await page.getByLabel("아이디 입력").fill(username);
  const acknowledgement = page.getByLabel(/정당한 목적으로/);
  if (!(await acknowledgement.isChecked())) {
    await acknowledgement.check();
  }

  const scanResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/scans") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "내 아이디 흔적 찾기" }).click();
  const scanResponse = await scanResponsePromise;
  expect(scanResponse.status()).toBe(201);
  const scan = (await scanResponse.json()) as { scanId: string };
  await expect(page.getByRole("heading", { name: `${username}로 찾은 공개 흔적` })).toBeVisible();
  await expect(page.locator(".result-first-panel")).toBeInViewport();
  return scan.scanId;
}

async function installPaywalledPreviewRoutes(page: Page, scanBody: Record<string, unknown>, resultsBody: Record<string, unknown>) {
  await page.route("**/api/scans", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(scanBody)
    });
  });
  await page.route("**/api/scans/*/free-report", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "WEB_PAYWALL_ENABLED",
          message: "정밀 리포트는 결제 후 열려요."
        }
      })
    });
  });
  await page.route("**/api/scans/*/results", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(resultsBody)
    });
  });
}

function emptyScanSummary(username: string) {
  return {
    ...baseScanSummary(username, "scan_emptycase_ui"),
    foundCount: 0,
    countryDistribution: {},
    categoryDistribution: {},
    previewResults: [],
    lockedResults: []
  };
}

function paywalledScanSummary(username: string) {
  const previewResults = [
    {
      id: "github-0",
      platform: "GitHub",
      url: "https://github.com/",
      category: "DEVELOPER",
      country: "US",
      status: "FOUND",
      riskLevel: "MEDIUM",
      cleanupHint: "정확한 URL과 정리 가이드는 전체 리포트에서 확인하세요."
    }
  ];
  const lockedResults = [
    {
      id: "naver-1",
      platform: "Naver",
      category: "BLOG",
      country: "KR",
      riskLevel: "HIGH"
    },
    {
      id: "instagram-2",
      platform: "Instagram",
      category: "SNS",
      country: "GLOBAL",
      riskLevel: "MEDIUM"
    }
  ];

  return {
    ...baseScanSummary(username, "scan_lockedcase_ui"),
    foundCount: 3,
    countryDistribution: { US: 1, KR: 1, GLOBAL: 1 },
    categoryDistribution: { DEVELOPER: 1, BLOG: 1, SNS: 1 },
    previewResults,
    lockedResults
  };
}

function baseScanSummary(username: string, scanId: string) {
  return {
    scanId,
    username,
    purpose: "SELF_CHECK",
    mode: "QUICK",
    status: "COMPLETED",
    progress: 100,
    checkedCount: 34,
    failedRate: 0,
    scanSource: "PUBLIC_SCAN",
    maigretReportAvailable: false,
    createdAt: new Date("2026-06-12T00:00:00.000Z").toISOString(),
    finishedAt: new Date("2026-06-12T00:00:01.000Z").toISOString(),
    expiresAt: new Date("2026-06-13T00:00:00.000Z").toISOString(),
    doppelgangerScore: 42,
    rarityScore: 88,
    exposureScore: 32,
    impersonationScore: 28,
    cleanupScore: 35
  };
}
