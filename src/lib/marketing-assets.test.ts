import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
// @ts-ignore - This test exercises the Node release gate script directly.
import { createMarketingAssetReport, expectedMarketingAssets } from "../../scripts/verify-marketing-assets.mjs";

function currentArchiveEntries() {
  const archives = expectedMarketingAssets.archives as Array<{ file: string }>;
  return new Map(
    archives.map((archive) => [
      archive.file,
      readFileSync(archive.file)
    ])
  );
}

describe("marketing asset verification", () => {
  it("rejects launch-kit archives that still contain the old score-first Product Hunt asset", async () => {
    const archives = new Map(currentArchiveEntries());
    const staleArchive = Buffer.from(
      [
        "press-release.md",
        "product-hunt-01-scan-1270x760.png",
        "product-hunt-02-score-1270x760.png",
        "product-hunt-03-report-1270x760.png"
      ].join("\n"),
      "utf-8"
    );
    archives.set("docs/marketing/id-doppelganger-launch-kit-v2.zip", staleArchive);

    const report = await createMarketingAssetReport({ archives, checkPngDimensions: false });

    expect(report.ok).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({
        name: "Archive has stale score-first asset"
      })
    );
  });
});
