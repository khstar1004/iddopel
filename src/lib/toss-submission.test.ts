import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
// @ts-ignore - This test exercises the Node release gate script directly.
import { createTossSubmissionReport } from "../../scripts/verify-toss-submission.mjs";

const requiredFiles = [
  "src/app/toss/page.tsx",
  "src/components/TossMiniApp.tsx",
  "src/lib/toss-cors.ts",
  "next.config.ts",
  "docs/toss-submission.md",
  ".cursor/mcp.example.json",
  ".env.example"
];

const completeFiles = new Map(requiredFiles.map((file) => [file, readFileSync(file, "utf-8")]));

const completePackage = {
  scripts: {
    "toss:verify": "node scripts/verify-toss-submission.mjs"
  }
};

describe("verify-toss-submission", () => {
  it("passes locally when Toss route, policy docs, CORS, and payment integration are present", () => {
    const report = createTossSubmissionReport({
      files: completeFiles,
      packageJson: completePackage,
      releaseCheck: false,
      env: {}
    });

    expect(report.ok).toBe(true);
    expect(report.localFailures).toEqual([]);
    expect(report.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Toss release credential check skipped" })])
    );
  });

  it("fails release mode until Toss console fields and production origin are configured", () => {
    const report = createTossSubmissionReport({
      files: completeFiles,
      packageJson: completePackage,
      releaseCheck: true,
      env: {}
    });

    expect(report.ok).toBe(false);
    expect(report.releaseFailures).toContainEqual(expect.objectContaining({ name: "Env TOSS_MINI_APP_NAME" }));
    expect(report.releaseFailures).toContainEqual(expect.objectContaining({ name: "Env SITE_URL" }));
  });

  it("fails locally if unsafe people-search copy appears in the Toss surface", () => {
    const files = new Map(completeFiles);
    files.set("src/components/TossMiniApp.tsx", `${completeFiles.get("src/components/TossMiniApp.tsx")} 사람 찾기`);

    const report = createTossSubmissionReport({
      files,
      packageJson: completePackage,
      releaseCheck: false,
      env: {}
    });

    expect(report.ok).toBe(false);
    expect(report.localFailures).toContainEqual(expect.objectContaining({ name: "Toss surface avoids people-search copy" }));
  });
});
