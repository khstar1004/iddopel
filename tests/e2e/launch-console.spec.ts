import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { watchBrowserErrors } from "./browser-errors";

test("local launch console shows the dry-run launch plan after developer login", async ({ page }) => {
  const launchEnvPath = path.join(process.cwd(), ".env.launch");
  const previousLaunchEnv = existsSync(launchEnvPath) ? await readFile(launchEnvPath, "utf-8") : null;
  const browserMessages = watchBrowserErrors(page);

  try {
    if (previousLaunchEnv !== null) await unlink(launchEnvPath);

    await page.goto("/launch");
    await page.getByLabel("개발자 비밀번호").fill("admin");
    await page.getByRole("button", { name: "로그인" }).click();

    await expect(page.getByRole("heading", { name: "출시 전 남은 값" })).toBeVisible();
    await expect(page.getByLabel("출시 전 남은 값").getByText("PRODUCTION_DOMAIN")).toBeVisible();
    await expect(page.getByText("npm run release:local")).toBeVisible();
    await expect(page.getByText("ENABLE_LAUNCH_CONSOLE=true 필요")).toBeVisible();
    await expect(page.getByRole("button", { name: "출시 실행" })).toBeDisabled();

    await page.getByLabel("프로덕션 도메인").fill("localhost:3000");
    await page.getByLabel("스토어 지원 이메일").fill("not-an-email");
    await page.getByRole("button", { name: ".env.launch 저장" }).click();
    await expect(page.getByText("출시 환경값 형식을 확인해 주세요.")).toBeVisible();
    await expect(page.getByText(/실제 HTTPS 도메인/)).toBeVisible();
    await expect(page.getByText(/이메일 형식/)).toBeVisible();
    expect(existsSync(launchEnvPath)).toBe(false);

    await page.getByLabel("프로덕션 도메인").fill("id.verified-domain.kr");
    await page.getByLabel("스토어 지원 이메일").fill("support@verified-domain.kr");
    await page.getByLabel("프로덕션 Postgres URL").fill("postgres://launch_user:launch_pass@db.verified-domain.kr:5432/id_doppelganger");
    await page.getByLabel("Cron Secret").fill("launch-cron-secret-value-1234567890");
    await page.getByLabel("Report Token Secret").fill("launch-report-token-secret-value-1234567890");
    await page.getByLabel("1회 무료 판정 Secret").fill("launch-fingerprint-secret-value-1234567890");
    await page.getByLabel("Toss Payments Client Key").fill("test_ck_123456789");
    await page.getByLabel("Toss Payments Secret Key").fill("test_sk_123456789");
    await page.getByLabel("Toss Payments Security Key").fill("a".repeat(64));
    await page.getByLabel("Toss Console API Key").fill("toss-console-api-key-value");
    await page.getByLabel("Toss Console App ID").fill("toss-console-app");
    await page.getByLabel("Toss Mini App Name").fill("id-doppelganger");
    await page.getByLabel("런칭 알림 Webhook").fill("https://hooks.verified-domain.kr/launch");
    await page.getByLabel("장애 대응 Runbook URL").fill("https://docs.verified-domain.kr/runbook");
    await page.getByLabel("네이티브 유료 리포트").fill("true");
    await page.getByLabel("App Store Connect Key ID").fill("ABC123DEFG");
    await page.getByLabel("App Store Connect Issuer ID").fill("00000000-0000-0000-0000-000000000000");
    await expect(page.getByLabel("App Store Connect Private Key")).toHaveJSProperty("tagName", "TEXTAREA");
    await expect(page.getByLabel("Google Play Service Account JSON")).toHaveJSProperty("tagName", "TEXTAREA");
    await page
      .getByLabel("App Store Connect Private Key")
      .fill("not-a-real-app-store-private-key-line-1\nnot-a-real-app-store-private-key-line-2");
    await page.getByLabel("Apple App ID").fill("1234567890");
    await page.getByLabel("Google Play Service Account JSON").fill(JSON.stringify({ type: "service_account", project_id: "id-doppelganger" }, null, 2));
    await page.getByRole("button", { name: ".env.launch 저장" }).click();

    await expect(page.getByText(/\d+개 값을 \.env\.launch에 저장했어요\./)).toBeVisible();
    await expect(page.getByText("필수 값이 채워졌습니다.")).toBeVisible();
    await expect(page.locator(".launch-requirement-card", { hasText: "App Store / Google Play" })).toContainText("완료");
    await expect(page.getByText("test_ck_123456789")).toHaveCount(0);
    await expect(page.getByText("test_sk_123456789")).toHaveCount(0);
    await expect(page.getByText("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toHaveCount(0);
    await expect(page.getByText("launch_pass")).toHaveCount(0);
    await expect(page.getByText("launch-report-token-secret-value-1234567890")).toHaveCount(0);
    await expect(page.getByText("launch-fingerprint-secret-value-1234567890")).toHaveCount(0);
    await expect(page.getByText("not-a-real-app-store-private-key-line-1")).toHaveCount(0);

    const savedEnv = await readFile(launchEnvPath, "utf-8");
    expect(savedEnv).toContain("PRODUCTION_DOMAIN=id.verified-domain.kr");
    expect(savedEnv).toContain("MOBILE_PAYMENTS_ENABLED=true");
    expect(savedEnv).toContain("TOSS_CLIENT_KEY=test_ck_123456789");
    expect(savedEnv).toContain("TOSS_SECRET_KEY=test_sk_123456789");
    expect(savedEnv).toContain(`TOSS_SECURITY_KEY=${"a".repeat(64)}`);
    expect(savedEnv).toContain("TOSS_CONSOLE_API_KEY=toss-console-api-key-value");
    expect(savedEnv).toContain("CRON_SECRET=launch-cron-secret-value-1234567890");
    expect(savedEnv).toContain("REPORT_TOKEN_SECRET=launch-report-token-secret-value-1234567890");
    expect(savedEnv).toContain("FIRST_FREE_FINGERPRINT_SECRET=launch-fingerprint-secret-value-1234567890");
    expect(savedEnv).toContain("APPLE_KEY_ID=ABC123DEFG");
    expect(savedEnv).toContain('APPLE_PRIVATE_KEY="not-a-real-app-store-private-key-line-1\\nnot-a-real-app-store-private-key-line-2"');
    expect(savedEnv).toContain('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON="{\\n  \\"type\\": \\"service_account\\",');

    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
    expect(browserMessages).toEqual([]);
  } finally {
    if (previousLaunchEnv === null) {
      if (existsSync(launchEnvPath)) await unlink(launchEnvPath);
    } else {
      await writeFile(launchEnvPath, previousLaunchEnv, "utf-8");
    }
  }
});
