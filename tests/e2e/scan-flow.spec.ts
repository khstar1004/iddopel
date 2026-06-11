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
  await expect(page.locator(".masked-url-teaser").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "전체 리포트 보기" })).toBeVisible();

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

test("landing form blocks disallowed identifiers before submit", async ({ page }) => {
  const browserMessages = watchBrowserErrors(page);

  await page.goto("/");
  await page.getByLabel("아이디 입력").fill("me@example.com");
  await page.getByLabel(/정당한 목적으로/).check();

  await expect(page.locator('[role="alert"]').filter({ hasText: "이메일 검색은 지원하지 않아요." })).toBeVisible();
  await expect(page.getByRole("button", { name: "내 아이디 흔적 찾기" })).toBeDisabled();

  expect(browserMessages).toEqual([]);
});

test("developer admin login stays hidden until the logo easter egg is unlocked", async ({ page }) => {
  const browserMessages = watchBrowserErrors(page);
  let devAdminSessionChecks = 0;

  await page.route("**/api/dev/admin-session", async (route) => {
    if (route.request().method() === "GET") {
      devAdminSessionChecks += 1;
    }
    await route.continue();
  });

  await page.goto("/");
  expect(devAdminSessionChecks).toBe(0);
  await expect(page.getByLabel("개발자 비밀번호")).toHaveCount(0);
  await expect(page.getByText("개발자 테스트 로그인")).toHaveCount(0);

  const logo = page.getByLabel("ID 도플갱어 홈");
  const unlockResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/dev/admin-session") && response.request().method() === "GET"
  );
  for (let clickIndex = 0; clickIndex < 5; clickIndex += 1) {
    await logo.click();
  }
  await unlockResponsePromise;
  expect(devAdminSessionChecks).toBe(1);

  await page.getByLabel("개발자 비밀번호").fill("admin");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByText("개발자 테스트 모드가 켜졌어요.")).toBeVisible();

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
