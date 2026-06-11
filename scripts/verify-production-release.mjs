import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const productionReleaseSteps = [
  { script: "assets:all", env: {} },
  { script: "scan:maigret", env: { SCAN_PROVIDER: "maigret" } },
  { script: "code:hygiene", env: {} },
  { script: "security:audit", env: {} },
  { script: "security:secrets", env: {} },
  { script: "deploy:verify", env: { DEPLOY_RELEASE_CHECK: "true" } },
  { script: "db:migrate", env: {} },
  { script: "verify:production", env: {} },
  { script: "alerts:test", env: {} },
  { script: "smoke:release", env: { SMOKE_CONFIRM_PAYMENT: "skip" } },
  { script: "toss:verify", env: { TOSS_RELEASE_CHECK: "true" } },
  { script: "store:finalize", env: {} },
  { script: "store:verify", env: { STORE_RELEASE_CHECK: "true" } },
  { script: "mobile:configure", env: {} },
  { script: "mobile:verify", env: { MOBILE_RELEASE_CHECK: "true" } },
  { script: "android:bundle", env: {} },
  { script: "launch:readiness", env: { LAUNCH_RELEASE_CHECK: "true" } }
];

export function buildProductionReleaseCommandPlan() {
  return productionReleaseSteps.map((step) => {
    const prefix = Object.entries(step.env)
      .map(([key, value]) => `${key}=${value}`)
      .join(" ");
    return {
      script: step.script,
      command: `${prefix ? `${prefix} ` : ""}npm run ${step.script}`,
      env: step.env
    };
  });
}

export function runProductionReleaseCommandPlan(plan, { cwd = process.cwd(), env = process.env } = {}) {
  const results = [];

  for (const step of plan) {
    const startedAt = performance.now();
    console.log(`\n[release:production] ${step.command}`);
    const result = spawnNpmScript(step.script, {
      cwd,
      env: { ...env, ...step.env }
    });
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
  const plan = buildProductionReleaseCommandPlan();

  if (process.argv.includes("--list")) {
    console.log(JSON.stringify({ ok: true, commands: plan }, null, 2));
    process.exit(0);
  }

  const report = runProductionReleaseCommandPlan(plan);
  console.log(`\n${JSON.stringify(report, null, 2)}`);
  if (!report.ok) process.exit(1);
}
