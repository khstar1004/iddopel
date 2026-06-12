import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMaigretCliArgs,
  maigretRecordToScanResult,
  parseMaigretSimpleReport,
  resolveBoostTagSpecs,
  resolveCriticalSiteNames,
  resolveExcludedSiteNames,
  resolveExcludedTags,
  resolvePrioritySiteNames,
  runMaigretScan
} from "./maigret-adapter";

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
      },
      Twitter: {
        url_user: "https://twitter.com/khstar104",
        url_main: "https://www.twitter.com/",
        tags: ["messaging", "social"],
        rank: 5
      }
    });

    const results = parseMaigretSimpleReport(report, { purpose: "SELF_CHECK" });

    expect(results).toHaveLength(3);
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
    expect(results[2]).toMatchObject({
      platform: "X",
      url: "https://x.com/khstar104",
      platformUrl: "https://x.com",
      platformIconUrl: "https://x.com/favicon.ico",
      category: "SNS",
      rank: 5
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

  it("surfaces Instagram and X mirror hits as the canonical social profiles", () => {
    const report = JSON.stringify({
      ImgInn: {
        username: "im9route",
        url_user: "https://imginn.com/im9route/",
        site: {
          source: "Instagram",
          urlMain: "https://imginn.com",
          tags: ["photo"]
        }
      },
      Instagram: {
        username: "im9route",
        url_user: "https://www.instagram.com/im9route/",
        site: {
          tags: ["photo", "social"]
        }
      },
      NitterMirror: {
        username: "legacyx",
        url_user: "https://nitter.example/legacyx",
        site: {
          source: "Twitter",
          tags: ["social"]
        }
      }
    });

    const results = parseMaigretSimpleReport(report, { purpose: "SELF_CHECK" });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      platform: "Instagram",
      url: "https://www.instagram.com/im9route",
      platformUrl: "https://www.instagram.com",
      platformIconUrl: "https://www.instagram.com/favicon.ico",
      category: "SNS"
    });
    expect(results[1]).toMatchObject({
      platform: "X",
      url: "https://x.com/legacyx",
      platformUrl: "https://x.com",
      platformIconUrl: "https://x.com/favicon.ico",
      category: "SNS"
    });
  });

  it("filters known noisy Maigret sites before exposing results", () => {
    const report = JSON.stringify({
      "Geeksfor Geeks": {
        username: "zzzxqnotreal88271",
        url_user: "https://auth.geeksforgeeks.org/user/zzzxqnotreal88271",
        site: {
          tags: ["coding"]
        }
      },
      GitHub: {
        username: "realdev",
        url_user: "https://github.com/realdev",
        site: {
          tags: ["coding"]
        }
      },
      APClips: {
        username: "randomadult",
        url_user: "https://apclips.com/randomadult",
        site: {
          tags: ["porn", "video"]
        }
      }
    });

    expect(parseMaigretSimpleReport(report, { purpose: "SELF_CHECK" }).map((result) => result.platform)).toEqual([
      "GitHub"
    ]);
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

describe("Maigret CLI quality options", () => {
  const originalPrioritySites = process.env.MAIGRET_PRIORITY_SITES;
  const originalCriticalSites = process.env.MAIGRET_CRITICAL_SITES;
  const originalBoostTags = process.env.MAIGRET_BOOST_TAGS;
  const originalExcludedSites = process.env.MAIGRET_EXCLUDED_SITES;
  const originalExcludedTags = process.env.MAIGRET_EXCLUDED_TAGS;

  afterEach(() => {
    restoreEnv("MAIGRET_PRIORITY_SITES", originalPrioritySites);
    restoreEnv("MAIGRET_CRITICAL_SITES", originalCriticalSites);
    restoreEnv("MAIGRET_BOOST_TAGS", originalBoostTags);
    restoreEnv("MAIGRET_EXCLUDED_SITES", originalExcludedSites);
    restoreEnv("MAIGRET_EXCLUDED_TAGS", originalExcludedTags);
  });

  it("keeps high-demand social platforms in the priority scan scope", () => {
    delete process.env.MAIGRET_PRIORITY_SITES;

    expect(resolvePrioritySiteNames()).toEqual(
      expect.arrayContaining(["Instagram", "Twitter", "Threads", "TikTok", "YouTube", "Naver"])
    );
  });

  it("builds a site-scoped priority scan instead of replacing the top-site scan", () => {
    const args = buildMaigretCliArgs("khstar104", "out", {
      maxConnections: 6,
      retries: 1,
      scope: { siteNames: ["Instagram", "Twitter", "Threads"] },
      timeoutSeconds: 14
    });

    expect(args).toContain("--site");
    expect(args).toEqual(expect.arrayContaining(["Instagram", "Twitter", "Threads"]));
    expect(args).not.toContain("--top-sites");
    expect(args).not.toContain("-a");
  });

  it("adds a slower critical social scan for bot-sensitive platforms", () => {
    delete process.env.MAIGRET_CRITICAL_SITES;
    expect(resolveCriticalSiteNames()).toEqual(["Twitter", "Instagram", "Threads"]);

    const args = buildMaigretCliArgs("im9route", "out", {
      maxConnections: 3,
      retries: 2,
      scope: { siteNames: resolveCriticalSiteNames() },
      timeoutSeconds: 22
    });

    expect(args).toEqual(expect.arrayContaining(["--site", "Twitter", "Instagram", "Threads"]));
    expect(args).toEqual(expect.arrayContaining(["--timeout", "22", "--retries", "2", "--max-connections", "3"]));
  });

  it("adds a tag-scoped boost scan for Korean, social, creator, and developer coverage", () => {
    process.env.MAIGRET_BOOST_TAGS =
      "kr:30,social:35,photo:16,video:16,blog:20,coding:20,music:10,design:10,streaming:8,messaging:8";

    expect(resolveBoostTagSpecs()).toEqual([
      { tag: "kr", limit: 30 },
      { tag: "social", limit: 35 },
      { tag: "photo", limit: 16 },
      { tag: "video", limit: 16 },
      { tag: "blog", limit: 20 },
      { tag: "coding", limit: 20 },
      { tag: "music", limit: 10 },
      { tag: "design", limit: 10 },
      { tag: "streaming", limit: 8 },
      { tag: "messaging", limit: 8 }
    ]);

    const args = buildMaigretCliArgs("im9route", "out", {
      maxConnections: 20,
      retries: 1,
      scope: {
        tags: ["kr", "social", "photo", "video", "blog", "coding", "music", "design", "streaming", "messaging"],
        topSites: 173
      },
      timeoutSeconds: 6
    });

    expect(args).toEqual(
      expect.arrayContaining([
        "--tags",
        "kr,social,photo,video,blog,coding,music,design,streaming,messaging",
        "--top-sites",
        "173",
        "--exclude-tags",
        "porn"
      ])
    );
    expect(args).not.toContain("--site");
    expect(args).not.toContain("-a");
  });

  it("excludes known noisy Maigret sites by default while keeping an escape hatch", () => {
    delete process.env.MAIGRET_EXCLUDED_SITES;
    expect(resolveExcludedSiteNames()).toEqual(["Geeksfor Geeks"]);

    process.env.MAIGRET_EXCLUDED_SITES = "";
    expect(resolveExcludedSiteNames()).toEqual([]);
  });

  it("excludes adult-tagged Maigret sites by default while keeping an escape hatch", () => {
    delete process.env.MAIGRET_EXCLUDED_TAGS;
    expect(resolveExcludedTags()).toEqual(["porn"]);

    process.env.MAIGRET_EXCLUDED_TAGS = "";
    expect(resolveExcludedTags()).toEqual([]);
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
