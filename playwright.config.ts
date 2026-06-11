import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3020";
const serverUrl = new URL(baseURL);
const serverHost = serverUrl.hostname || "127.0.0.1";
const serverPort = serverUrl.port || (serverUrl.protocol === "https:" ? "443" : "80");
const e2eRunId = process.env.E2E_RUN_ID ?? `${Date.now()}-${process.pid}`;
const reuseExistingServer = process.env.E2E_REUSE_EXISTING_SERVER
  ? process.env.E2E_REUSE_EXISTING_SERVER === "true"
  : !process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium-320",
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 320, height: 720 } }
    },
    {
      name: "chromium-768",
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } }
    },
    {
      name: "chromium-1024",
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } }
    },
    {
      name: "chromium-1440",
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }
    },
    {
      name: "chromium-report-flow",
      testMatch: /report-flow\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } }
    },
    {
      name: "chromium-scan-flow",
      testMatch: /scan-flow\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } }
    },
    {
      name: "chromium-native-shell",
      testMatch: /native-shell\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } }
    },
    {
      name: "chromium-seo-guides",
      testMatch: /seo-guides\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } }
    },
    {
      name: "chromium-monitoring-flow",
      testMatch: /monitoring-flow\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } }
    },
    {
      name: "chromium-launch-console",
      testMatch: /launch-console\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } }
    },
    {
      name: "chromium-toss-flow",
      testMatch: /toss-flow\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        extraHTTPHeaders: { "x-forwarded-for": "198.51.100.80" }
      }
    }
  ],
  webServer: {
    command: `npm run start -- -H ${serverHost} -p ${serverPort}`,
    env: {
      ENABLE_MOCK_PAYMENTS: "true",
      ORDER_STORE_PATH: `.data/e2e-orders-${serverPort}-${e2eRunId}.json`,
      PAYMENT_PROVIDER: "mock",
      SCAN_PROVIDER: "mock",
      SCAN_STORE_PATH: `.data/e2e-scans-${serverPort}-${e2eRunId}.json`
    },
    url: baseURL,
    reuseExistingServer,
    timeout: 120_000
  }
});
