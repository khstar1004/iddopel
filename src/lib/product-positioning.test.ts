import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
// @ts-ignore - This test exercises the Node release gate script directly.
import { createProductPositioningReport, requiredPositioningFiles } from "../../scripts/verify-product-positioning.mjs";

const staleCopyFiles = [
  "plan.md",
  "docs/marketing/launch-kit.md",
  "docs/marketing/launch-campaign-v2.md",
  "docs/marketing/gtm-plan.md",
  "docs/toss-submission.md",
  "README.md",
  "src/components/ScanExperience.tsx",
  "src/components/TossMiniApp.tsx",
  "native-web/index.html"
];

const completeFiles = new Map(
  [...new Set([...requiredPositioningFiles, ...staleCopyFiles])].map((file) => [file, readFileSync(file, "utf-8")])
);

describe("product positioning verification", () => {
  it("passes when product surfaces and launch docs keep result-first positioning", () => {
    const report = createProductPositioningReport({ files: completeFiles });

    expect(report.ok).toBe(true);
    expect(report.failures).toEqual([]);
  });

  it("fails if score-first CTA copy returns to a launch surface", () => {
    const files = new Map(completeFiles);
    files.set("docs/marketing/launch-kit.md", `${files.get("docs/marketing/launch-kit.md")}\nCTA: 아이디 점수 보기`);

    const report = createProductPositioningReport({ files });

    expect(report.ok).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({
        name: "Stale score-first copy",
        file: "docs/marketing/launch-kit.md"
      })
    );
  });
});
