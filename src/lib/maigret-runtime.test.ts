import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-ignore - This test exercises the Node runtime verifier script directly.
import { buildLiveCheckArgs, createMaigretRuntimeReport, parseDotEnv } from "../../scripts/verify-maigret-runtime.mjs";

describe("maigret runtime verifier", () => {
  it("parses dotenv values and lets process env override file env", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "id-doppelganger-env-"));
    writeFileSync(
      path.join(cwd, ".env.local"),
      ["SCAN_PROVIDER=mock", "MAIGRET_BIN=\"file-maigret\"", "IGNORED_COMMENT=value"].join("\n")
    );

    const report = createMaigretRuntimeReport({
      cwd,
      env: { SCAN_PROVIDER: "maigret", MAIGRET_BIN: "env-maigret" },
      spawnSyncImpl: () => ({ status: 0, stdout: "maigret 0.6.1" })
    });

    expect(parseDotEnv("export SCAN_PROVIDER=maigret\nMAIGRET_BIN='maigret'")).toEqual({
      SCAN_PROVIDER: "maigret",
      MAIGRET_BIN: "maigret"
    });
    expect(report.ok).toBe(true);
    expect(report.provider).toBe("maigret");
    expect(report.command).toBe("env-maigret");
  });

  it("fails when the effective scan provider is not real Maigret", () => {
    const report = createMaigretRuntimeReport({
      env: { SCAN_PROVIDER: "mock", MAIGRET_BIN: "maigret" },
      spawnSyncImpl: () => ({ status: 0, stdout: "maigret 0.6.1" })
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        name: "SCAN_PROVIDER is maigret",
        ok: false
      })
    );
  });

  it("runs the Maigret version command without a shell", () => {
    const calls: Array<{ command: string; args: string[]; options: Record<string, unknown> }> = [];
    const report = createMaigretRuntimeReport({
      env: { SCAN_PROVIDER: "maigret", MAIGRET_BIN: "maigret" },
      spawnSyncImpl: (command: string, args: string[], options: Record<string, unknown>) => {
        calls.push({ command, args, options });
        return { status: 0, stdout: "maigret 0.6.1" };
      }
    });

    expect(report.ok).toBe(true);
    expect(report.version).toBe("maigret 0.6.1");
    expect(calls[0]).toMatchObject({
      command: "maigret",
      args: ["--version"],
      options: { shell: false, windowsHide: true }
    });
  });

  it("live mode requires a generated simple JSON report", () => {
    const report = createMaigretRuntimeReport({
      live: true,
      env: { SCAN_PROVIDER: "maigret", MAIGRET_BIN: "maigret", MAIGRET_VERIFY_TOP_SITES: "3" },
      spawnSyncImpl: (_command: string, args: string[]) => {
        if (args.includes("--version")) {
          return { status: 0, stdout: "maigret 0.6.1" };
        }
        const outputDir = args[args.indexOf("--folderoutput") + 1];
        writeFileSync(path.join(outputDir, "khstar104_simple.json"), JSON.stringify({ GitHub: { url_user: "https://github.com/khstar104" } }));
        return { status: 0, stdout: "done" };
      }
    });

    expect(report.ok).toBe(true);
    expect(report.liveCheck).toMatchObject({
      enabled: true,
      ok: true,
      username: "khstar104",
      topSites: 3,
      candidateCount: 1
    });
  });

  it("accepts an empty live JSON report because no public match is still a real scan result", () => {
    const report = createMaigretRuntimeReport({
      live: true,
      env: { SCAN_PROVIDER: "maigret", MAIGRET_BIN: "maigret" },
      spawnSyncImpl: (_command: string, args: string[]) => {
        if (args.includes("--version")) {
          return { status: 0, stdout: "maigret 0.6.1" };
        }
        const outputDir = args[args.indexOf("--folderoutput") + 1];
        writeFileSync(path.join(outputDir, "khstar104_simple.json"), JSON.stringify({}));
        return { status: 0, stdout: "done" };
      }
    });

    expect(report.ok).toBe(true);
    expect(report.liveCheck).toMatchObject({
      enabled: true,
      ok: true,
      candidateCount: 0
    });
  });

  it("builds live check arguments that ask Maigret for a simple JSON report", () => {
    expect(
      buildLiveCheckArgs({
        username: "khstar104",
        outputDir: "out",
        topSites: 5,
        siteTimeoutSeconds: 8
      })
    ).toEqual([
      "khstar104",
      "--json",
      "simple",
      "--folderoutput",
      "out",
      "--no-color",
      "--no-progressbar",
      "--no-autoupdate",
      "--no-recursion",
      "--no-extracting",
      "--timeout",
      "8",
      "--retries",
      "0",
      "--top-sites",
      "5"
    ]);
  });
});
