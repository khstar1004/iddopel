import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-ignore - This test exercises the Node Vercel CLI setup script directly.
import { createVercelPostgresSetupPlan, renderVercelPostgresSetupRunbook, runVercelPostgresSetupPlan } from "../../scripts/setup-vercel-postgres.mjs";

function withTempProject<T>(linked: boolean, run: (cwd: string) => T): T {
  const cwd = mkdtempSync(join(tmpdir(), "iddopel-vercel-"));
  try {
    if (linked) {
      mkdirSync(join(cwd, ".vercel"), { recursive: true });
      writeFileSync(join(cwd, ".vercel", "project.json"), "{\"projectId\":\"prj_test\",\"orgId\":\"org_test\"}");
    }
    return run(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe("Vercel Postgres setup plan", () => {
  it("builds a free-plan Vercel Marketplace Postgres dry run for an unlinked project", () => {
    withTempProject(false, (cwd) => {
      const plan = createVercelPostgresSetupPlan({
        cwd,
        env: {},
        now: new Date("2026-06-12T00:00:00.000Z")
      });

      expect(plan.linked).toBe(false);
      expect(plan.plan).toBe("free");
      expect(plan.commands.map((command: { id: string }) => command.id)).toEqual([
        "link-project",
        "provision-postgres",
        "pull-production-env",
        "migrate-production-db",
        "deploy-production",
        "verify-vercel-production"
      ]);
      expect(plan.commands[1]).toEqual(
        expect.objectContaining({
          command: "vercel",
          args: expect.arrayContaining([
            "integration",
            "add",
            "neon",
            "--name",
            "id-doppelganger-postgres",
            "--environment",
            "production",
            "--plan",
            "free",
            "--no-env-pull"
          ])
        })
      );
    });
  });

  it("skips link, provision, and deploy steps when requested for a linked project", () => {
    withTempProject(true, (cwd) => {
      const plan = createVercelPostgresSetupPlan({
        cwd,
        options: { skipProvision: true, skipDeploy: true }
      });

      expect(plan.linked).toBe(true);
      expect(plan.commands.map((command: { id: string }) => command.id)).toEqual([
        "pull-production-env",
        "migrate-production-db",
        "verify-vercel-production"
      ]);
    });
  });

  it("can skip the paid-production verification gate for beta database setup", () => {
    withTempProject(true, (cwd) => {
      const plan = createVercelPostgresSetupPlan({
        cwd,
        options: { skipVerify: true }
      });

      expect(plan.commands.map((command: { id: string }) => command.id)).not.toContain("verify-vercel-production");
      expect(plan.commands.map((command: { id: string }) => command.id)).toContain("migrate-production-db");
      expect(plan.commands.map((command: { id: string }) => command.id)).toContain("deploy-production");
    });
  });

  it("accepts custom integration, environments, metadata, env file, and production URL", () => {
    withTempProject(true, (cwd) => {
      const plan = createVercelPostgresSetupPlan({
        cwd,
        options: {
          integration: "supabase",
          name: "id-db",
          plan: "starter",
          environments: ["production", "preview"],
          metadata: ["region=iad1", "version=16"],
          envFile: ".vercel/.env.prod.local",
          productionBaseUrl: "https://iddopel.example"
        }
      });
      const provision = plan.commands.find((command: { id: string }) => command.id === "provision-postgres");
      const pull = plan.commands.find((command: { id: string }) => command.id === "pull-production-env");
      const verify = plan.commands.find((command: { id: string }) => command.id === "verify-vercel-production");

      expect(provision?.args).toEqual(
        expect.arrayContaining([
          "supabase",
          "--name",
          "id-db",
          "--environment",
          "production",
          "--environment",
          "preview",
          "--metadata",
          "region=iad1",
          "--metadata",
          "version=16",
          "--plan",
          "starter"
        ])
      );
      expect(pull?.args).toEqual(expect.arrayContaining([".vercel/.env.prod.local", "--environment=production", "--yes"]));
      expect(verify?.env).toEqual({ VERCEL_PRODUCTION_BASE_URL: "https://iddopel.example" });
    });
  });

  it("can leave plan selection interactive when the provider plan id is uncertain", () => {
    withTempProject(true, (cwd) => {
      const plan = createVercelPostgresSetupPlan({ cwd, options: { interactivePlan: true } });
      const provision = plan.commands.find((command: { id: string }) => command.id === "provision-postgres");

      expect(plan.plan).toBeNull();
      expect(provision?.args).not.toContain("--plan");
      expect(renderVercelPostgresSetupRunbook(plan)).toContain("Provider plan: interactive/default");
    });
  });

  it("stops command execution on the first failed Vercel step", () => {
    const calls: Array<{ command: string; args: string[]; env: Record<string, string> }> = [];
    const plan = {
      commands: [
        { id: "first", command: "vercel", args: ["env", "pull"], env: {}, description: "first" },
        { id: "second", command: "vercel", args: ["deploy", "--prod"], env: { TEST_FLAG: "1" }, description: "second" },
        { id: "third", command: "vercel", args: ["env", "run"], env: {}, description: "third" }
      ]
    };

    const result = runVercelPostgresSetupPlan(plan, {
      cwd: process.cwd(),
      env: { PATH: "test-path" },
      spawnSyncImpl: (command: string, args: string[], options: { env: Record<string, string> }) => {
        calls.push({ command, args, env: options.env });
        return { status: calls.length === 1 ? 0 : 1 };
      }
    });

    expect(result.ok).toBe(false);
    expect(result.failedStep).toBe("second");
    expect(calls).toHaveLength(2);
    expect(calls[1].env).toEqual(expect.objectContaining({ PATH: "test-path", TEST_FLAG: "1" }));
  });
});
