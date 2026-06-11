import { afterEach, describe, expect, it, vi } from "vitest";
import { maigretRecordToScanResult, parseMaigretSimpleReport, runMaigretScan } from "./maigret-adapter";

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

describe("runMaigretScan remote Vercel function", () => {
  const originalFetch = globalThis.fetch;
  const originalVercel = process.env.VERCEL;
  const originalVercelUrl = process.env.VERCEL_URL;
  const originalMaigretApiUrl = process.env.MAIGRET_API_URL;
  const originalMaigretApiSecret = process.env.MAIGRET_API_SECRET;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreEnv("VERCEL", originalVercel);
    restoreEnv("VERCEL_URL", originalVercelUrl);
    restoreEnv("MAIGRET_API_URL", originalMaigretApiUrl);
    restoreEnv("MAIGRET_API_SECRET", originalMaigretApiSecret);
    vi.restoreAllMocks();
  });

  it("uses the Vercel Python Maigret function instead of local fallback data", async () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_URL = "iddopel.vercel.app";
    process.env.MAIGRET_API_SECRET = "internal-secret";
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          checkedCount: 50,
          failedRate: 0,
          reportJson: JSON.stringify({
            GitHub: {
              url_user: "https://github.com/vercelreal",
              url_main: "https://github.com",
              tags: ["dev"]
            }
          }),
          htmlReport: {
            html: "<!doctype html><h1>Maigret</h1>",
            htmlFilename: "vercelreal_plain.html"
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    ) as typeof fetch;

    const result = await runMaigretScan({ username: "vercelreal", purpose: "SELF_CHECK", mode: "QUICK" });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://iddopel.vercel.app/api/maigret_scan",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-maigret-api-secret": "internal-secret" })
      })
    );
    expect(result.checkedCount).toBe(50);
    expect(result.report?.htmlFilename).toBe("vercelreal_plain.html");
    expect(result.results[0]).toMatchObject({
      platform: "GitHub",
      url: "https://github.com/vercelreal",
      status: "FOUND"
    });
  });

  it("throws when the Vercel Python Maigret function fails", async () => {
    process.env.MAIGRET_API_URL = "https://scanner.example.com/api/maigret_scan";
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "Maigret timed out." } }), {
        status: 504,
        headers: { "Content-Type": "application/json" }
      })
    ) as typeof fetch;

    await expect(runMaigretScan({ username: "timeoutcase", purpose: "SELF_CHECK", mode: "QUICK" })).rejects.toThrow(
      "Maigret timed out."
    );
  });

  it("uses the request origin when Vercel system URL variables are unavailable", async () => {
    process.env.VERCEL = "1";
    delete process.env.VERCEL_URL;
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          checkedCount: 50,
          failedRate: 0,
          reportJson: JSON.stringify({
            GitHub: {
              url_user: "https://github.com/fromorigin",
              url_main: "https://github.com",
              tags: ["dev"]
            }
          })
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    ) as typeof fetch;

    await runMaigretScan(
      { username: "fromorigin", purpose: "SELF_CHECK", mode: "QUICK" },
      { origin: "https://preview.example.com" }
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://preview.example.com/api/maigret_scan",
      expect.objectContaining({ method: "POST" })
    );
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
