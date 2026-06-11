import { describe, expect, it } from "vitest";
import { createTossPreflightResponse, evaluateTossCors, getTossAllowedOrigins } from "./toss-cors";

describe("toss-cors", () => {
  it("derives Toss live and private origins from the mini app name", () => {
    expect(getTossAllowedOrigins({ TOSS_MINI_APP_NAME: "id-doppelganger" })).toEqual([
      "https://id-doppelganger.apps.tossmini.com",
      "https://id-doppelganger.private-apps.tossmini.com"
    ]);
  });

  it("normalizes explicitly allowed Toss origins", () => {
    expect(
      getTossAllowedOrigins({
        TOSS_ALLOWED_ORIGINS: "https://custom.apps.tossmini.com/, https://custom.private-apps.tossmini.com/path"
      })
    ).toEqual(["https://custom.apps.tossmini.com", "https://custom.private-apps.tossmini.com"]);
  });

  it("allows same-origin requests without adding cross-origin headers", () => {
    const request = new Request("https://id-doppelganger.kr/api/scans", {
      headers: { Origin: "https://id-doppelganger.kr" }
    });

    expect(evaluateTossCors(request, { TOSS_MINI_APP_NAME: "id-doppelganger" })).toEqual({
      allowed: true,
      origin: null
    });
  });

  it("treats localhost and 127.0.0.1 as equivalent loopback origins on the same port", () => {
    const request = new Request("http://localhost:3020/api/scans", {
      headers: { Origin: "http://127.0.0.1:3020" }
    });

    expect(evaluateTossCors(request, {})).toEqual({
      allowed: true,
      origin: null
    });
  });

  it("allows configured Toss mini app origins", () => {
    const request = new Request("https://id-doppelganger.kr/api/scans", {
      headers: { Origin: "https://id-doppelganger.private-apps.tossmini.com" }
    });

    expect(evaluateTossCors(request, { TOSS_MINI_APP_NAME: "id-doppelganger" })).toEqual({
      allowed: true,
      origin: "https://id-doppelganger.private-apps.tossmini.com"
    });
  });

  it("rejects unconfigured cross-origin requests", () => {
    const request = new Request("https://id-doppelganger.kr/api/scans", {
      headers: { Origin: "https://attacker.example" }
    });

    expect(evaluateTossCors(request, { TOSS_MINI_APP_NAME: "id-doppelganger" })).toEqual({
      allowed: false,
      origin: "https://attacker.example"
    });
  });

  it("returns CORS headers for an allowed preflight", () => {
    const request = new Request("https://id-doppelganger.kr/api/scans", {
      method: "OPTIONS",
      headers: { Origin: "https://id-doppelganger.apps.tossmini.com" }
    });
    const response = createTossPreflightResponse(request, ["POST"], { TOSS_MINI_APP_NAME: "id-doppelganger" });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://id-doppelganger.apps.tossmini.com");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
  });
});
