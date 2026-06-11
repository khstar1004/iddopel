import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const releaseCandidateScripts = [
  { script: "verify", env: {} },
  { script: "scan:maigret", env: {} },
  { script: "code:hygiene", env: {} },
  { script: "product:verify", env: {} },
  { script: "security:audit", env: {} },
  { script: "security:secrets", env: {} },
  {
    script: "e2e",
    env: {
      E2E_BASE_URL: "http://127.0.0.1:3130",
      E2E_REUSE_EXISTING_SERVER: "false"
    }
  },
  { script: "assets:all", env: {} },
  { script: "store:verify", env: {} },
  { script: "toss:verify", env: {} },
  { script: "mobile:verify", env: {} },
  { script: "android:debug", env: {} },
  { script: "android:bundle", env: {} },
  { script: "deploy:verify", env: {} },
  { script: "launch:readiness", env: {} }
];

export function buildReleaseCommandPlan() {
  return releaseCandidateScripts.map((step) => ({
    script: step.script,
    command: buildCommand(step.script, step.env),
    env: step.env
  }));
}

export function runReleaseCommandPlan(plan, { cwd = process.cwd(), env = process.env } = {}) {
  const results = [];

  for (const step of plan) {
    const startedAt = performance.now();
    console.log(`\n[release:local] ${step.command}`);
    const result = spawnNpmScript(step.script, { cwd, env: { ...env, ...step.env } });
    const ok = result.status === 0;
    results.push({
      script: step.script,
      command: step.command,
      ok,
      status: result.status,
      durationMs: Math.round(performance.now() - startedAt)
    });

    if (!ok) {
      return { ok: false, failedScript: step.script, results };
    }
  }

  return { ok: true, failedScript: null, results };
}

function buildCommand(script, env) {
  const envPrefix = Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  return `${envPrefix ? `${envPrefix} ` : ""}npm run ${script}`;
}

function spawnNpmScript(script, { cwd, env }) {
  if (process.platform === "win32") {
    return spawnSync("cmd.exe", ["/d", "/c", `npm run ${script}`], {
      cwd,
      env,
      stdio: "inherit",
      shell: false
    });
  }

  return spawnSync("npm", ["run", script], {
    cwd,
    env,
    stdio: "inherit",
    shell: false
  });
}

function isMainModule() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const plan = buildReleaseCommandPlan();

  if (process.argv.includes("--list")) {
    console.log(JSON.stringify({ ok: true, commands: plan }, null, 2));
    process.exit(0);
  }

  const report = runReleaseCommandPlan(plan);
  console.log(`\n${JSON.stringify(report, null, 2)}`);
  if (!report.ok) process.exit(1);
}
