import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultIntegration = "neon";
const defaultResourceName = "id-doppelganger-postgres";
const defaultEnvironment = "production";
const defaultProviderPlan = "free";
const defaultPulledEnvFile = ".vercel/.env.production.local";
const sourceReferences = [
  "https://vercel.com/docs/storage",
  "https://vercel.com/docs/marketplace-storage",
  "https://vercel.com/docs/postgres",
  "https://vercel.com/docs/cli/integration",
  "https://vercel.com/docs/cli/env"
];

export function createVercelPostgresSetupPlan({
  env = {},
  cwd = process.cwd(),
  now = new Date(),
  options = {}
} = {}) {
  const integration = options.integration || env.VERCEL_POSTGRES_INTEGRATION || defaultIntegration;
  const resourceName = options.name || env.VERCEL_POSTGRES_RESOURCE_NAME || defaultResourceName;
  const environments = uniqueValues(options.environments?.length ? options.environments : parseCsv(env.VERCEL_POSTGRES_ENVIRONMENTS) || [defaultEnvironment]);
  const plan = options.interactivePlan ? "" : options.plan || env.VERCEL_POSTGRES_PLAN || defaultProviderPlan;
  const metadata = uniqueValues([...(options.metadata || []), ...(parseCsv(env.VERCEL_POSTGRES_METADATA) || [])]);
  const pulledEnvFile = options.envFile || env.VERCEL_PRODUCTION_ENV_FILE || defaultPulledEnvFile;
  const productionBaseUrl = options.productionBaseUrl || env.VERCEL_PRODUCTION_BASE_URL || env.PRODUCTION_BASE_URL || "https://iddopel.vercel.app";
  const vercelBin = options.vercelBin || env.VERCEL_CLI_BIN || "vercel";
  const linked = existsSync(resolve(cwd, ".vercel", "project.json"));

  const commands = [];
  if (!linked) {
    commands.push(commandStep("link-project", vercelBin, ["link"], {}, "Link this workspace to the existing Vercel project."));
  }

  if (!options.skipProvision) {
    commands.push(
      commandStep(
        "provision-postgres",
        vercelBin,
        [
          "integration",
          "add",
          integration,
          "--name",
          resourceName,
          ...environments.flatMap((environment) => ["--environment", environment]),
          ...metadata.flatMap((item) => ["--metadata", item]),
          ...(plan ? ["--plan", plan] : []),
          "--no-env-pull"
        ],
        {},
        "Provision and connect a Marketplace Postgres resource to the linked Vercel project."
      )
    );
  }

  commands.push(
    commandStep(
      "pull-production-env",
      vercelBin,
      ["env", "pull", pulledEnvFile, "--environment=production", "--yes"],
      {},
      "Pull production environment variables into an ignored local file so Postgres aliases can be inspected locally."
    ),
    commandStep(
      "migrate-production-db",
      vercelBin,
      ["env", "run", "-e", "production", "--", "npm", "run", "db:migrate"],
      {},
      "Run database migrations with Vercel production environment variables without writing secrets into the command line."
    )
  );

  if (!options.skipDeploy) {
    commands.push(
      commandStep("deploy-production", vercelBin, ["deploy", "--prod"], {}, "Redeploy production after Marketplace env variables are connected.")
    );
  }

  commands.push(
    commandStep(
      "verify-vercel-production",
      vercelBin,
      ["env", "run", "-e", "production", "--", "npm", "run", "vercel:production"],
      { VERCEL_PRODUCTION_BASE_URL: productionBaseUrl },
      "Verify the live production shape: Postgres storage, paid report locking, live checkout provider, and closed cron routes."
    )
  );

  return {
    ok: true,
    generatedAt: now.toISOString(),
    linked,
    integration,
    resourceName,
    environments,
    plan: plan || null,
    metadata,
    pulledEnvFile,
    productionBaseUrl,
    commands,
    sources: sourceReferences,
    notes: [
      "Vercel Marketplace storage is available on all Vercel plans; the provider plan still depends on the selected integration.",
      "The default provider plan is free. Use --plan to choose another plan or --interactive-plan to let Vercel prompt for one.",
      "Run the generated plan with --execute only after confirming the selected Marketplace provider and plan.",
      "The migration step uses vercel env run so database credentials stay in Vercel environment storage."
    ]
  };
}

export function renderVercelPostgresSetupRunbook(plan) {
  const lines = [
    "# Vercel Postgres CLI Setup",
    "",
    `Generated: ${plan.generatedAt}`,
    `Project linked: ${plan.linked ? "yes" : "no"}`,
    `Integration: ${plan.integration}`,
    `Resource name: ${plan.resourceName}`,
    `Environments: ${plan.environments.join(", ")}`,
    `Provider plan: ${plan.plan || "interactive/default"}`,
    "",
    "## Commands",
    "```bash",
    ...plan.commands.map(formatDisplayCommand),
    "```",
    "",
    "## Notes",
    ...plan.notes.map((note) => `- ${note}`),
    "",
    "## References",
    ...plan.sources.map((source) => `- ${source}`)
  ];

  return `${lines.join("\n")}\n`;
}

export function runVercelPostgresSetupPlan(plan, { cwd = process.cwd(), env = process.env, spawnSyncImpl = spawnSync } = {}) {
  const results = [];
  for (const step of plan.commands) {
    console.log(`\n[vercel:db] ${formatDisplayCommand(step)}`);
    const result = spawnSyncImpl(step.command, step.args, {
      cwd,
      env: { ...env, ...step.env },
      stdio: "inherit",
      shell: false
    });
    const ok = !result.error && result.status === 0;
    results.push({
      id: step.id,
      command: formatDisplayCommand(step),
      ok,
      status: result.status ?? null,
      error: result.error?.message || null
    });
    if (!ok) return { ok: false, failedStep: step.id, results };
  }
  return { ok: true, failedStep: null, results };
}

function commandStep(id, command, args, env, description) {
  return { id, command, args, env, description };
}

function formatDisplayCommand(step) {
  const envPrefix = Object.entries(step.env || {})
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  return `${envPrefix ? `${envPrefix} ` : ""}${[step.command, ...step.args].join(" ")}`;
}

function uniqueValues(values) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function parseCsv(value) {
  const items = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : null;
}

function parseArgs(argv) {
  const options = {
    execute: false,
    jsonOnly: false,
    skipProvision: false,
    skipDeploy: false,
    interactivePlan: false,
    environments: [],
    metadata: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--execute") {
      options.execute = true;
    } else if (item === "--json-only") {
      options.jsonOnly = true;
    } else if (item === "--skip-provision") {
      options.skipProvision = true;
    } else if (item === "--skip-deploy") {
      options.skipDeploy = true;
    } else if (item === "--interactive-plan") {
      options.interactivePlan = true;
    } else if (item === "--integration") {
      options.integration = argv[++index];
    } else if (item.startsWith("--integration=")) {
      options.integration = item.slice("--integration=".length);
    } else if (item === "--name") {
      options.name = argv[++index];
    } else if (item.startsWith("--name=")) {
      options.name = item.slice("--name=".length);
    } else if (item === "--plan") {
      options.plan = argv[++index];
    } else if (item.startsWith("--plan=")) {
      options.plan = item.slice("--plan=".length);
    } else if (item === "--environment" || item === "-e") {
      options.environments.push(argv[++index]);
    } else if (item.startsWith("--environment=")) {
      options.environments.push(item.slice("--environment=".length));
    } else if (item === "--metadata" || item === "-m") {
      options.metadata.push(argv[++index]);
    } else if (item.startsWith("--metadata=")) {
      options.metadata.push(item.slice("--metadata=".length));
    } else if (item === "--env-file") {
      options.envFile = argv[++index];
    } else if (item.startsWith("--env-file=")) {
      options.envFile = item.slice("--env-file=".length);
    } else if (item === "--base-url") {
      options.productionBaseUrl = argv[++index];
    } else if (item.startsWith("--base-url=")) {
      options.productionBaseUrl = item.slice("--base-url=".length);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const plan = createVercelPostgresSetupPlan({ options, env: process.env });

  if (options.jsonOnly) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    console.log(JSON.stringify(plan, null, 2));
    console.log("");
    console.log(renderVercelPostgresSetupRunbook(plan));
  }

  if (!options.execute) return;
  const result = runVercelPostgresSetupPlan(plan);
  console.log(`\n${JSON.stringify({ ok: result.ok, result }, null, 2)}`);
  if (!result.ok) process.exit(1);
}

function isMainModule() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
