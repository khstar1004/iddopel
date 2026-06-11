import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dotenvFiles = [".env", ".env.local"];

export function parseDotEnv(contents) {
  const values = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const normalized = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const equals = normalized.indexOf("=");
    if (equals <= 0) continue;

    const key = normalized.slice(0, equals).trim();
    const rawValue = normalized.slice(equals + 1).trim();
    values[key] = stripEnvQuotes(rawValue);
  }

  return values;
}

export function loadRuntimeEnv({ cwd = process.cwd(), env = process.env, files = dotenvFiles } = {}) {
  const fileEnv = {};

  for (const file of files) {
    const candidate = path.resolve(cwd, file);
    if (!existsSync(candidate)) continue;
    Object.assign(fileEnv, parseDotEnv(readFileSync(candidate, "utf-8")));
  }

  return { ...fileEnv, ...env };
}

export function createMaigretRuntimeReport({
  cwd = process.cwd(),
  env = process.env,
  platform = process.platform,
  live = false,
  spawnSyncImpl = spawnSync
} = {}) {
  const runtimeEnv = loadRuntimeEnv({ cwd, env });
  const provider = normalize(runtimeEnv.SCAN_PROVIDER) || "maigret";
  const command = normalize(runtimeEnv.MAIGRET_BIN) || defaultMaigretCommand(cwd, platform);
  const checks = [];

  addCheck(checks, "SCAN_PROVIDER is maigret", provider === "maigret", "Set SCAN_PROVIDER=maigret for real public username scans.");

  const version = runMaigretVersion(command, { cwd, env: runtimeEnv, spawnSyncImpl });
  addCheck(checks, "Maigret CLI responds", version.ok, version.detail);

  let liveCheck = { enabled: false };
  if (live) {
    liveCheck = runMaigretLiveCheck(command, { cwd, env: runtimeEnv, spawnSyncImpl });
    addCheck(checks, "Maigret live JSON report", liveCheck.ok, liveCheck.detail);
  }

  const ok = checks.every((check) => check.ok);

  return {
    ok,
    provider,
    command,
    version: version.version,
    liveCheck,
    checks
  };
}

export function runMaigretVersion(command, { cwd = process.cwd(), env = process.env, spawnSyncImpl = spawnSync } = {}) {
  const result = spawnSyncImpl(command, ["--version"], {
    cwd,
    env: { ...env, PYTHONIOENCODING: "utf-8" },
    encoding: "utf-8",
    shell: false,
    timeout: Number(env.MAIGRET_VERSION_TIMEOUT_MS || "15000"),
    windowsHide: true
  });

  const stdout = String(result.stdout || "").trim();
  const stderr = String(result.stderr || "").trim();
  const output = stdout || stderr;

  if (result.error) {
    return {
      ok: false,
      version: null,
      detail: result.error.message
    };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      version: null,
      detail: output || `Maigret exited with status ${result.status}.`
    };
  }

  return {
    ok: true,
    version: output,
    detail: output || "Maigret CLI returned a zero exit status."
  };
}

export function runMaigretLiveCheck(command, { cwd = process.cwd(), env = process.env, spawnSyncImpl = spawnSync } = {}) {
  const username = normalize(env.MAIGRET_VERIFY_USERNAME) || "khstar104";
  const topSites = normalizePositiveInteger(env.MAIGRET_VERIFY_TOP_SITES, 5);
  const siteTimeoutSeconds = normalizePositiveInteger(env.MAIGRET_VERIFY_SITE_TIMEOUT_SECONDS, 8);
  const processTimeoutMs = normalizePositiveInteger(env.MAIGRET_VERIFY_PROCESS_TIMEOUT_MS, 60000);
  const tempDir = mkdtempSync(path.join(tmpdir(), "id-doppelganger-maigret-verify-"));
  const args = buildLiveCheckArgs({
    username,
    outputDir: tempDir,
    topSites,
    siteTimeoutSeconds
  });

  try {
    const result = spawnSyncImpl(command, args, {
      cwd,
      env: { ...env, PYTHONIOENCODING: "utf-8" },
      encoding: "utf-8",
      shell: false,
      timeout: processTimeoutMs,
      windowsHide: true
    });

    const stdout = String(result.stdout || "").trim();
    const stderr = String(result.stderr || "").trim();
    const output = stderr || stdout;

    if (result.error) {
      return {
        enabled: true,
        ok: false,
        username,
        topSites,
        detail: result.error.message
      };
    }

    if (result.status !== 0) {
      return {
        enabled: true,
        ok: false,
        username,
        topSites,
        detail: output || `Maigret exited with status ${result.status}.`
      };
    }

    const reportFile = readdirSync(tempDir).find((entry) => entry.endsWith("_simple.json"));
    if (!reportFile) {
      return {
        enabled: true,
        ok: false,
        username,
        topSites,
        detail: "Maigret did not generate a simple JSON report."
      };
    }

    const report = JSON.parse(readFileSync(path.join(tempDir, reportFile), "utf-8"));
    const candidateCount = Object.keys(report).length;

    return {
      enabled: true,
      ok: report && typeof report === "object" && !Array.isArray(report),
      username,
      topSites,
      reportFile,
      candidateCount,
      detail:
        candidateCount > 0
          ? `Maigret generated ${reportFile} with ${candidateCount} found records.`
          : `Maigret generated ${reportFile} with no found records in the sampled site set.`
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export function buildLiveCheckArgs({ username, outputDir, topSites, siteTimeoutSeconds }) {
  return [
    username,
    "--json",
    "simple",
    "--folderoutput",
    outputDir,
    "--no-color",
    "--no-progressbar",
    "--no-autoupdate",
    "--no-recursion",
    "--no-extracting",
    "--timeout",
    String(siteTimeoutSeconds),
    "--retries",
    "0",
    "--top-sites",
    String(topSites)
  ];
}

function defaultMaigretCommand(cwd, platform) {
  const localCommand =
    platform === "win32"
      ? path.join(cwd, ".maigret-venv", "Scripts", "maigret.exe")
      : path.join(cwd, ".maigret-venv", "bin", "maigret");

  return existsSync(localCommand) ? localCommand : "maigret";
}

function stripEnvQuotes(value) {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === `"` && last === `"`) || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }
  return value;
}

function normalize(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function addCheck(checks, name, ok, detail) {
  checks.push({ name, ok, detail });
}

function isMainModule() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const report = createMaigretRuntimeReport({
    live: process.argv.includes("--live") || process.env.MAIGRET_VERIFY_LIVE === "true"
  });

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}
