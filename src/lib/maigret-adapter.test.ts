import { describe, expect, it } from "vitest";
import { maigretRecordToScanResult, parseMaigretSimpleReport } from "./maigret-adapter";

describe("parseMaigretSimpleReport", () => {
  it("maps Maigret simple JSON claimed accounts into scan results", () => {
    const report = JSON.stringify({
      GitHub: {
        url_user: "https://github.com/khstar104",
        url_main: "https://github.com",
        tags: ["coding", "us"],
        rank: 88,
        http_status: 200,
        ids: {
          image: "https://avatars.githubusercontent.com/u/1?v=4"
        },
        status: {
          tags: ["dev"]
        }
      },
      Instagram: {
        url_user: "https://www.instagram.com/khstar104",
        status: {
          tags: ["social", "global"]
        }
      }
    });

    const results = parseMaigretSimpleReport(report, { purpose: "SELF_CHECK" });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      platform: "GitHub",
      url: "https://github.com/khstar104",
      platformUrl: "https://github.com",
      platformIconUrl: "https://github.com/favicon.ico",
      profileImageUrl: "https://avatars.githubusercontent.com/u/1?v=4",
      category: "DEVELOPER",
      country: "US",
      status: "FOUND",
      rank: 88,
      httpStatus: 200,
      tags: ["coding", "us", "dev"]
    });
    expect(results[1]).toMatchObject({
      platform: "Instagram",
      category: "SNS",
      riskLevel: "HIGH"
    });
  });

  it("ignores records without a profile URL", () => {
    const report = JSON.stringify({
      BrokenSite: {
        status: {
          tags: ["social"]
        }
      }
    });

    expect(parseMaigretSimpleReport(report, { purpose: "SELF_CHECK" })).toEqual([]);
  });
});

describe("maigretRecordToScanResult", () => {
  it("raises SNS risk for brand checks", () => {
    const result = maigretRecordToScanResult(
      "Instagram",
      {
        url_user: "https://www.instagram.com/openbrand",
        tags: ["social"]
      },
      "BRAND_CHECK"
    );

    expect(result?.riskLevel).toBe("HIGH");
  });
});
