import { expect, test } from "@playwright/test";
import { watchBrowserErrors } from "./browser-errors";

test("SEO guide page renders safely and links back to the scanner", async ({ page }) => {
  const browserMessages = watchBrowserErrors(page);

  await page.goto("/guides/id-rarity-test");

  await expect(page).toHaveTitle(/아이디 희소성 테스트/);
  await expect(page.getByRole("heading", { name: "내 아이디 희소성 테스트" })).toBeVisible();
  await expect(page.locator("body")).toContainText("사람 찾기 기능인가요?");
  await expect(page.locator("body")).toContainText("동일인 여부를 판정하지 않습니다");

  const cta = page.getByRole("link", { name: /공개 후보 확인/ });
  await expect(cta).toHaveAttribute("href", "/#scan");

  const jsonLdBlocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const faqJsonLd = jsonLdBlocks.find((block) => block.includes("FAQPage"));
  expect(faqJsonLd).toContain("FAQPage");
  expect(faqJsonLd).toContain("동일인 여부를 판정하지 않습니다");

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  expect(browserMessages).toEqual([]);
});

test("competitor alternative guide gives comparison context without unsafe positioning", async ({ page }) => {
  const browserMessages = watchBrowserErrors(page);

  await page.goto("/guides/namechk-alternative");

  await expect(page).toHaveTitle(/Namechk 대안/);
  await expect(page.getByRole("heading", { level: 1, name: /Namechk 대안/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "비교 요약" })).toBeVisible();
  await expect(page.locator("body")).toContainText("Namechk가 잘 맞는 경우");
  await expect(page.locator("body")).toContainText("ID 도플갱어가 더 잘 맞는 경우");
  await expect(page.locator("body")).toContainText("동일인 여부를 판정하지 않습니다");
  await expect(page.getByRole("link", { name: /공식 자료/ })).toHaveAttribute("href", /namechk\.com/);
  await expect(page.getByRole("link", { name: "공개 후보 확인" })).toHaveAttribute("href", "/#scan");

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  expect(browserMessages).toEqual([]);
});

test("sitemap and robots expose public launch routes only", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBeTruthy();
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain("/guides/id-rarity-test");
  expect(sitemapText).toContain("/guides/brand-username-check");
  expect(sitemapText).toContain("/guides/namechk-alternative");
  expect(sitemapText).toContain("/guides/footprintiq-alternative");
  expect(sitemapText).toContain("/toss");
  expect(sitemapText).not.toContain("/checkout/");
  expect(sitemapText).not.toContain("/reports/");

  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBeTruthy();
  const robotsText = await robots.text();
  expect(robotsText).toContain("Allow: /guides/");
  expect(robotsText).toContain("Disallow: /api/");
  expect(robotsText).toContain("Disallow: /checkout/");
  expect(robotsText).toContain("Disallow: /reports/");
});
