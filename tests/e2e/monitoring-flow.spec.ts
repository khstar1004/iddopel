import { expect, test } from "@playwright/test";
import { watchBrowserErrors } from "./browser-errors";

test("user can register and cancel monthly monitoring from the landing page", async ({ page }) => {
  const browserMessages = watchBrowserErrors(page);

  await page.goto("/");
  await page.evaluate(() => window.localStorage.removeItem("id-doppelganger-monitoring-owner-token"));

  await page.getByLabel("모니터링할 아이디").fill("monitor_alpha, monitor_beta");
  await page.getByRole("button", { name: "월간 재점검 등록" }).click();

  await expect(page.locator("body")).toContainText("월간 자동 재점검이 등록됐어요.");
  await expect(page.locator("body")).toContainText("monitor_alpha");
  await expect(page.locator("body")).toContainText("monitor_beta");
  await expect(page.locator("body")).toContainText("다음 자동 재점검");

  const ownerToken = await page.evaluate(() => window.localStorage.getItem("id-doppelganger-monitoring-owner-token"));
  expect(ownerToken?.length).toBeGreaterThan(30);

  await page.getByRole("button", { name: "모니터링 해지" }).click();
  await expect(page.locator("body")).toContainText("월간 모니터링을 해지했어요.");

  expect(browserMessages).toEqual([]);
});
