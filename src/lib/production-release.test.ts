import { describe, expect, it } from "vitest";
// @ts-ignore - This test exercises the Node production release script directly.
import { buildProductionReleaseCommandPlan, productionReleaseSteps } from "../../scripts/verify-production-release.mjs";

describe("production release verifier", () => {
  it("runs the external release gates in a launch-safe order", () => {
    expect(productionReleaseSteps.map((step: { script: string }) => step.script)).toEqual([
      "assets:all",
      "scan:maigret",
      "code:hygiene",
      "security:audit",
      "security:secrets",
      "deploy:verify",
      "db:migrate",
      "verify:production",
      "alerts:test",
      "smoke:release",
      "toss:verify",
      "store:finalize",
      "store:verify",
      "mobile:configure",
      "mobile:verify",
      "android:bundle",
      "launch:readiness"
    ]);
  });

  it("sets release-check environment flags on the commands that need them", () => {
    expect(buildProductionReleaseCommandPlan()).toEqual([
      { script: "assets:all", command: "npm run assets:all", env: {} },
      { script: "scan:maigret", command: "SCAN_PROVIDER=maigret npm run scan:maigret", env: { SCAN_PROVIDER: "maigret" } },
      { script: "code:hygiene", command: "npm run code:hygiene", env: {} },
      { script: "security:audit", command: "npm run security:audit", env: {} },
      { script: "security:secrets", command: "npm run security:secrets", env: {} },
      { script: "deploy:verify", command: "DEPLOY_RELEASE_CHECK=true npm run deploy:verify", env: { DEPLOY_RELEASE_CHECK: "true" } },
      { script: "db:migrate", command: "npm run db:migrate", env: {} },
      { script: "verify:production", command: "npm run verify:production", env: {} },
      { script: "alerts:test", command: "npm run alerts:test", env: {} },
      { script: "smoke:release", command: "SMOKE_CONFIRM_PAYMENT=skip npm run smoke:release", env: { SMOKE_CONFIRM_PAYMENT: "skip" } },
      { script: "toss:verify", command: "TOSS_RELEASE_CHECK=true npm run toss:verify", env: { TOSS_RELEASE_CHECK: "true" } },
      { script: "store:finalize", command: "npm run store:finalize", env: {} },
      { script: "store:verify", command: "STORE_RELEASE_CHECK=true npm run store:verify", env: { STORE_RELEASE_CHECK: "true" } },
      { script: "mobile:configure", command: "npm run mobile:configure", env: {} },
      { script: "mobile:verify", command: "MOBILE_RELEASE_CHECK=true npm run mobile:verify", env: { MOBILE_RELEASE_CHECK: "true" } },
      { script: "android:bundle", command: "npm run android:bundle", env: {} },
      { script: "launch:readiness", command: "LAUNCH_RELEASE_CHECK=true npm run launch:readiness", env: { LAUNCH_RELEASE_CHECK: "true" } }
    ]);
  });
});
