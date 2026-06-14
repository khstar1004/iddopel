import { afterEach, describe, expect, it } from "vitest";
import { POST } from "../app/api/dev/admin-session/route";
import { resetRateLimitsForTests } from "./rate-limit";

describe("admin session route", () => {
  const originalEnableDevAdmin = process.env.ENABLE_DEV_ADMIN;
  const originalDevAdminPassword = process.env.DEV_ADMIN_PASSWORD;

  afterEach(() => {
    restoreEnv("ENABLE_DEV_ADMIN", originalEnableDevAdmin);
    restoreEnv("DEV_ADMIN_PASSWORD", originalDevAdminPassword);
    resetRateLimitsForTests();
  });

  it("rate limits repeated admin login attempts", async () => {
    process.env.ENABLE_DEV_ADMIN = "true";
    process.env.DEV_ADMIN_PASSWORD = "secret-password";

    for (let index = 0; index < 8; index += 1) {
      const response = await POST(adminLoginRequest({ password: "wrong-password" }));
      expect(response.status).toBe(401);
    }

    const limited = await POST(adminLoginRequest({ password: "wrong-password" }));
    const body = await limited.json();

    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(body.error?.code).toBe("RATE_LIMITED");
    expect(body.error?.details.retryAfterSeconds).toBeGreaterThan(0);
  });
});

function adminLoginRequest(body: { username?: string; password?: string }) {
  return new Request("https://id.example.com/api/dev/admin-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "user-agent": "AdminSessionRouteTest/1.0",
      "x-forwarded-for": "203.0.113.92"
    },
    body: JSON.stringify({
      username: body.username ?? "admin",
      password: body.password ?? "secret-password"
    })
  });
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
