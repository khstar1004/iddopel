import { describe, expect, it } from "vitest";
// @ts-ignore - This test exercises the Node release gate script directly.
import { createStoreAssetReport, expectedStoreAssets } from "../../scripts/verify-store-assets.mjs";

const resultFirstGenerator = [
  ...expectedStoreAssets.resultFirstCopy,
  ...expectedStoreAssets.secondResultFirstGeneratorSnippets
].join("\n");

describe("store asset verification", () => {
  it("rejects stale score-first store screenshots left beside result-first assets", async () => {
    const report = await createStoreAssetReport({
      assetGenerator: resultFirstGenerator,
      checkPngDimensions: false,
      checkJson: false,
      checkText: false,
      existingFiles: new Set([
        "store-assets/screenshots/android-phone-02-score.png"
      ])
    });

    expect(report.ok).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({
        name: "Stale score-first store screenshot"
      })
    );
  });

  it("requires the second store screenshots to be result-first screens", async () => {
    const scoreFirstGenerator = resultFirstGenerator.replaceAll("02-results", "02-score");

    const report = await createStoreAssetReport({
      assetGenerator: scoreFirstGenerator,
      checkPngDimensions: false,
      checkJson: false,
      checkText: false,
      existingFiles: new Set()
    });

    expect(report.ok).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({
        name: "Generator includes second result-first screenshots"
      })
    );
  });
});
