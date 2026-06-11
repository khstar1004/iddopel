import { describe, expect, it } from "vitest";
import { normalizeUsername, parseCreateScanInput } from "./validation";

describe("normalizeUsername", () => {
  it("trims a leading at sign and accepts username-safe characters", () => {
    expect(normalizeUsername("  @khstar_104  ")).toBe("khstar_104");
  });

  it("rejects email-style searches", () => {
    expect(() => normalizeUsername("me@example.com")).toThrow("이메일 검색은 지원하지 않아요.");
  });

  it("rejects phone-number-style searches", () => {
    expect(() => normalizeUsername("010-1234-5678")).toThrow("전화번호 검색은 지원하지 않아요.");
  });

  it("rejects resident-number-style searches", () => {
    expect(() => normalizeUsername("9901011234567")).toThrow("주민번호처럼 보이는 값은 검색할 수 없어요.");
  });
});

describe("parseCreateScanInput", () => {
  it("normalizes purpose and mode into API enum values", () => {
    expect(
      parseCreateScanInput({
        username: "brand.lab",
        purpose: "brand_check",
        mode: "deep"
      })
    ).toEqual({
      username: "brand.lab",
      purpose: "BRAND_CHECK",
      mode: "DEEP"
    });
  });
});
