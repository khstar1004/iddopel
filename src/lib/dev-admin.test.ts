import { afterEach, describe, expect, it } from "vitest";
import { isDevAdminEnabled } from "./dev-admin";

describe("dev admin availability", () => {
  const originalEnableDevAdmin = process.env.ENABLE_DEV_ADMIN;
  const originalDevAdminPassword = process.env.DEV_ADMIN_PASSWORD;

  afterEach(() => {
    restoreEnv("ENABLE_DEV_ADMIN", originalEnableDevAdmin);
    restoreEnv("DEV_ADMIN_PASSWORD", originalDevAdminPassword);
  });

  it("keeps local admin enabled by default", () => {
    delete process.env.ENABLE_DEV_ADMIN;
    delete process.env.DEV_ADMIN_PASSWORD;

    expect(isDevAdminEnabled(new Request("http://localhost:3000/admin"))).toBe(true);
  });

  it("does not enable public admin without an explicit password", () => {
    process.env.ENABLE_DEV_ADMIN = "true";
    delete process.env.DEV_ADMIN_PASSWORD;

    expect(isDevAdminEnabled(new Request("https://id.example.com/admin"))).toBe(false);
  });

  it("enables public admin when the deployment has a password", () => {
    process.env.ENABLE_DEV_ADMIN = "true";
    process.env.DEV_ADMIN_PASSWORD = "secret-password";

    expect(isDevAdminEnabled(new Request("https://id.example.com/admin"))).toBe(true);
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
