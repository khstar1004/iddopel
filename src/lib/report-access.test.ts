import { describe, expect, it } from "vitest";
import { createReportToken, hashReportToken, verifyReportToken } from "./report-access";

describe("report access tokens", () => {
  it("verifies only the original token against its hash", () => {
    const token = createReportToken();
    const hash = hashReportToken(token);

    expect(verifyReportToken(token, hash)).toBe(true);
    expect(verifyReportToken(`${token}x`, hash)).toBe(false);
    expect(verifyReportToken(token, null)).toBe(false);
  });
});
