import { describe, expect, it, vi } from "vitest";
import { enrichScanResultsWithMetadata, fetchResultMetadata, metadataFromHtml } from "./result-metadata";
import type { ScanResult } from "./types";

describe("metadataFromHtml", () => {
  it("extracts compact Open Graph metadata", () => {
    const metadata = metadataFromHtml(
      `<!doctype html>
      <html>
        <head>
          <meta property="og:title" content="Profile &amp; portfolio" />
          <meta name="description" content="Public creator page with links" />
          <meta property="og:image" content="/avatar.png" />
        </head>
      </html>`,
      "https://example.com/u/test"
    );

    expect(metadata).toEqual({
      title: "Profile & portfolio",
      description: "Public creator page with links",
      imageUrl: "https://example.com/avatar.png"
    });
  });

  it("extracts a short public page text snippet without executable content", () => {
    const metadata = metadataFromHtml(
      `<!doctype html>
      <html>
        <head>
          <title>evidencegate profile</title>
          <style>.hidden { color: red; }</style>
          <script>alert("ignore")</script>
        </head>
        <body>
          <main>
            <h1>@evidencegate</h1>
            <p>Open source developer building public profile tools.</p>
            <p>Pinned repositories and profile links are visible.</p>
          </main>
        </body>
      </html>`,
      "https://example.com/evidencegate"
    );

    expect(metadata).toMatchObject({
      title: "evidencegate profile",
      snippet: "@evidencegate Open source developer building public profile tools. Pinned repositories and profile links are visible."
    });
    expect(metadata?.snippet).not.toContain("alert");
    expect(metadata?.snippet).not.toContain("hidden");
  });
});

describe("fetchResultMetadata", () => {
  it("rejects private network targets before fetching", async () => {
    const fetchImpl = vi.fn();
    const lookupImpl = vi.fn(async () => [{ address: "127.0.0.1", family: 4 }]);

    await expect(
      fetchResultMetadata("https://internal.example/profile", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        lookupImpl,
        timeoutMs: 100,
        maxBytes: 1024
      })
    ).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reads only safe HTML metadata", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        `<html><head><title>GitHub - im9route</title><meta name="description" content="Developer profile"></head></html>`,
        { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
      )
    );
    const lookupImpl = vi.fn(async () => [{ address: "140.82.112.4", family: 4 }]);

    await expect(
      fetchResultMetadata("https://github.com/im9route", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        lookupImpl,
        timeoutMs: 100,
        maxBytes: 1024
      })
    ).resolves.toEqual({
      title: "GitHub - im9route",
      description: "Developer profile",
      imageUrl: undefined,
      snippet: undefined
    });
  });
});

describe("enrichScanResultsWithMetadata", () => {
  it("enriches only the configured number of found results", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      new Response(`<title>${String(url)}</title>`, {
        status: 200,
        headers: { "content-type": "text/html" }
      })
    );
    const lookupImpl = vi.fn(async () => [{ address: "140.82.112.4", family: 4 }]);
    const results = [scanResult("one"), scanResult("two"), scanResult("three")];

    const enriched = await enrichScanResultsWithMetadata(results, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      lookupImpl,
      limit: 2,
      timeoutMs: 100,
      maxBytes: 1024
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(enriched[0].evidenceTitle).toBe("https://example.com/one");
    expect(enriched[1].evidenceTitle).toBe("https://example.com/two");
    expect(enriched[2].evidenceTitle).toBeUndefined();
  });
});

function scanResult(id: string): ScanResult {
  return {
    id,
    platform: id,
    url: `https://example.com/${id}`,
    category: "GLOBAL",
    country: "GLOBAL",
    status: "FOUND",
    riskLevel: "LOW",
    cleanupHint: "Check profile."
  };
}
