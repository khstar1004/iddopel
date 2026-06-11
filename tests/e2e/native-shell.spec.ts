import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { watchBrowserErrors } from "./browser-errors";

declare global {
  interface Window {
    IDD_NATIVE_BILLING?: {
      purchaseDetailedReport: () => Promise<{ provider: "APP_STORE"; transactionId: string } | { provider: "GOOGLE_PLAY"; productId: string; purchaseToken: string }>;
      restoreDetailedReport: () => Promise<{ provider: "APP_STORE"; transactionId: string } | { provider: "GOOGLE_PLAY"; productId: string; purchaseToken: string }>;
      completeDetailedReportPurchase?: (options: unknown) => Promise<unknown>;
    };
    Capacitor?: {
      Plugins?: {
        NativeBilling?: {
          purchaseDetailedReport: () => Promise<{ provider: "GOOGLE_PLAY"; productId: string; purchaseToken: string }>;
          restoreDetailedReport: () => Promise<{ provider: "GOOGLE_PLAY"; productId: string; purchaseToken: string }>;
          completeDetailedReportPurchase?: (options: unknown) => Promise<unknown>;
        };
      };
    };
    __completedNativePurchases?: unknown[];
  }
}

test("native shell enforces responsible-use guardrails before scanning", async ({ page }) => {
  const browserMessages = watchBrowserErrors(page);

  await page.route("http://native-shell.local/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const fileName = pathname === "/" ? "index.html" : pathname.slice(1);
    const filePath = path.join(process.cwd(), "native-web", fileName);
    const contentType = fileName.endsWith(".css") ? "text/css" : fileName.endsWith(".js") ? "application/javascript" : "text/html";

    await route.fulfill({
      status: 200,
      contentType,
      body: await readFile(filePath)
    });
  });

  await page.goto("http://native-shell.local/index.html");
  await expect(page.locator("body")).toContainText("ID 도플갱어");
  await expect(page.getByRole("heading", { name: "사람 찾기나 동일인 판정 앱이 아니에요" })).toBeVisible();

  const username = page.getByRole("textbox", { name: "아이디" });
  const submit = page.getByRole("button", { name: "공개 후보 확인" });
  await expect(submit).toBeDisabled();

  await username.fill("me@example.com");
  await page.getByLabel(/정당한 목적으로만/).check();
  await expect(submit).toBeDisabled();

  await username.fill("native_review_id");
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator("#toast")).toContainText("앱 API 도메인을 먼저 설정해야 해요.");

  expect(browserMessages).toEqual([]);
});

test("native shell keeps paid reports disabled when the native billing bridge is unavailable", async ({ page }) => {
  const browserMessages = watchBrowserErrors(page);

  await page.route("http://native-shell.local/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const fileName = pathname === "/" ? "index.html" : pathname.slice(1);

    if (fileName === "app-config.js") {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: `
          window.IDD_APP_CONFIG = {
            apiBaseUrl: "https://api.native-e2e.test",
            paymentsEnabled: true,
            appleDetailedReportProductId: "detailed_report",
            googlePlayDetailedReportProductId: "detailed_report",
            supportUrl: "https://api.native-e2e.test/responsible-use",
            privacyUrl: "https://api.native-e2e.test/privacy",
            termsUrl: "https://api.native-e2e.test/terms"
          };
        `
      });
      return;
    }

    const filePath = path.join(process.cwd(), "native-web", fileName);
    const contentType = fileName.endsWith(".css") ? "text/css" : fileName.endsWith(".js") ? "application/javascript" : "text/html";
    await route.fulfill({
      status: 200,
      contentType,
      body: await readFile(filePath)
    });
  });

  await page.route("https://api.native-e2e.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/scans") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          scanId: "scan_native_bridge_missing",
          username: "native_bridge_missing",
          foundCount: 0,
          rarityScore: 99,
          exposureScore: 0,
          impersonationScore: 0,
          previewResults: []
        })
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  await page.goto("http://native-shell.local/index.html");
  await page.getByRole("textbox", { name: "아이디" }).fill("native_bridge_missing");
  await page.getByLabel(/정당한 목적으로만/).check();
  await page.getByRole("button", { name: "공개 후보 확인" }).click();

  await expect(page.locator("#payment-copy")).toContainText("스토어 결제 브리지를 연결");
  await expect(page.getByRole("button", { name: "스토어 상품 연결 필요" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "구매 복원" })).toBeDisabled();
  expect(browserMessages).toEqual([]);
});

test("native shell can redeem a StoreKit purchase through the server entitlement API", async ({ page }) => {
  const browserMessages = watchBrowserErrors(page);
  const requests: Array<{ url: string; postData: unknown }> = [];

  await page.addInitScript(() => {
    window.IDD_NATIVE_BILLING = {
      purchaseDetailedReport: async () => ({
        provider: "APP_STORE",
        transactionId: "tx_native_e2e"
      }),
      restoreDetailedReport: async () => ({
        provider: "APP_STORE",
        transactionId: "tx_native_restore_e2e"
      })
    };
  });

  await page.route("http://native-shell.local/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const fileName = pathname === "/" ? "index.html" : pathname.slice(1);

    if (fileName === "app-config.js") {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: `
          window.IDD_APP_CONFIG = {
            apiBaseUrl: "https://api.native-e2e.test",
            paymentsEnabled: true,
            appleDetailedReportProductId: "detailed_report",
            googlePlayDetailedReportProductId: "detailed_report",
            supportUrl: "https://api.native-e2e.test/responsible-use",
            privacyUrl: "https://api.native-e2e.test/privacy",
            termsUrl: "https://api.native-e2e.test/terms"
          };
        `
      });
      return;
    }

    const filePath = path.join(process.cwd(), "native-web", fileName);
    const contentType = fileName.endsWith(".css") ? "text/css" : fileName.endsWith(".js") ? "application/javascript" : "text/html";
    await route.fulfill({
      status: 200,
      contentType,
      body: await readFile(filePath)
    });
  });

  await page.route("https://api.native-e2e.test/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push({ url: url.pathname, postData: request.postDataJSON() });

    if (url.pathname === "/api/scans") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          scanId: "scan_native_e2e",
          username: "native_paid_id",
          foundCount: 1,
          rarityScore: 91,
          exposureScore: 12,
          impersonationScore: 4,
          previewResults: [
            {
              platform: "GitHub",
              url: "https://github.com/native_paid_id",
              riskLevel: "LOW"
            }
          ]
        })
      });
      return;
    }

    if (url.pathname === "/api/mobile/entitlements/apple") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          reportUrl: "/reports/scan_native_e2e?token=report_token"
        })
      });
      return;
    }

    if (url.pathname === "/reports/scan_native_e2e") {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>정밀 리포트</title><main>정밀 리포트</main>"
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  await page.goto("http://native-shell.local/index.html");
  await page.getByRole("textbox", { name: "아이디" }).fill("native_paid_id");
  await page.getByLabel(/정당한 목적으로만/).check();
  await page.getByRole("button", { name: "공개 후보 확인" }).click();

  await expect(page.getByRole("button", { name: "정밀 리포트 구매" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "구매 복원" })).toBeEnabled();
  await page.getByRole("button", { name: "정밀 리포트 구매" }).click();

  await expect(page.locator("#toast")).toContainText("정밀 리포트를 열고 있어요.");
  expect(requests).toContainEqual({
    url: "/api/mobile/entitlements/apple",
    postData: {
      scanId: "scan_native_e2e",
      transactionId: "tx_native_e2e"
    }
  });
  await page.waitForURL("https://api.native-e2e.test/reports/scan_native_e2e?token=report_token");
  expect(page.url()).toBe("https://api.native-e2e.test/reports/scan_native_e2e?token=report_token");
  expect(browserMessages).toEqual([]);
});

test("native shell completes a Google Play consumable after entitlement succeeds", async ({ page }) => {
  const browserMessages = watchBrowserErrors(page);
  const requests: Array<{ url: string; postData: unknown }> = [];

  await page.addInitScript(() => {
    window.__completedNativePurchases = [];
    window.Capacitor = {
      Plugins: {
        NativeBilling: {
          purchaseDetailedReport: async () => ({
            provider: "GOOGLE_PLAY",
            productId: "detailed_report",
            purchaseToken: "play_purchase_token"
          }),
          restoreDetailedReport: async () => ({
            provider: "GOOGLE_PLAY",
            productId: "detailed_report",
            purchaseToken: "play_restore_token"
          }),
          completeDetailedReportPurchase: async (options) => {
            window.__completedNativePurchases?.push(options);
            return { ok: true };
          }
        }
      }
    };
  });

  await page.route("http://native-shell.local/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const fileName = pathname === "/" ? "index.html" : pathname.slice(1);

    if (fileName === "app-config.js") {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: `
          window.IDD_APP_CONFIG = {
            apiBaseUrl: "https://api.native-e2e.test",
            paymentsEnabled: true,
            appleDetailedReportProductId: "detailed_report",
            googlePlayDetailedReportProductId: "detailed_report",
            supportUrl: "https://api.native-e2e.test/responsible-use",
            privacyUrl: "https://api.native-e2e.test/privacy",
            termsUrl: "https://api.native-e2e.test/terms"
          };
        `
      });
      return;
    }

    const filePath = path.join(process.cwd(), "native-web", fileName);
    const contentType = fileName.endsWith(".css") ? "text/css" : fileName.endsWith(".js") ? "application/javascript" : "text/html";
    await route.fulfill({
      status: 200,
      contentType,
      body: await readFile(filePath)
    });
  });

  await page.route("https://api.native-e2e.test/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push({ url: url.pathname, postData: request.postDataJSON() });

    if (url.pathname === "/api/scans") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          scanId: "scan_native_play_e2e",
          username: "native_play_id",
          foundCount: 1,
          rarityScore: 90,
          exposureScore: 14,
          impersonationScore: 5,
          previewResults: []
        })
      });
      return;
    }

    if (url.pathname === "/api/mobile/entitlements/google") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          reportUrl: "/reports/scan_native_play_e2e?token=report_token"
        })
      });
      return;
    }

    if (url.pathname === "/reports/scan_native_play_e2e") {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>정밀 리포트</title><main>정밀 리포트</main>"
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  await page.goto("http://native-shell.local/index.html");
  await page.getByRole("textbox", { name: "아이디" }).fill("native_play_id");
  await page.getByLabel(/정당한 목적으로만/).check();
  await page.getByRole("button", { name: "공개 후보 확인" }).click();
  await page.getByRole("button", { name: "정밀 리포트 구매" }).click();

  await expect(page.locator("#toast")).toContainText("정밀 리포트를 열고 있어요.");
  expect(requests).toContainEqual({
    url: "/api/mobile/entitlements/google",
    postData: {
      scanId: "scan_native_play_e2e",
      productId: "detailed_report",
      purchaseToken: "play_purchase_token"
    }
  });
  await expect
    .poll(() => page.evaluate(() => window.__completedNativePurchases))
    .toEqual([
      {
        provider: "GOOGLE_PLAY",
        productId: "detailed_report",
        purchaseToken: "play_purchase_token"
      }
    ]);
  await page.waitForURL("https://api.native-e2e.test/reports/scan_native_play_e2e?token=report_token");
  expect(browserMessages).toEqual([]);
});
