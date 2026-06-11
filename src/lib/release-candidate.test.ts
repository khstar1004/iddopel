import { describe, expect, it } from "vitest";
// @ts-ignore - This test exercises the Node release gate script directly.
import { buildReleaseCommandPlan, releaseCandidateScripts } from "../../scripts/verify-release-candidate.mjs";

describe("release candidate verifier", () => {
  it("runs the full local release gate in the expected order", () => {
    expect(releaseCandidateScripts.map((step: { script: string }) => step.script)).toEqual([
      "verify",
      "scan:maigret",
      "code:hygiene",
      "product:verify",
      "security:audit",
      "security:secrets",
      "e2e",
      "assets:all",
      "store:verify",
      "toss:verify",
      "mobile:verify",
      "android:debug",
      "android:bundle",
      "deploy:verify",
      "launch:readiness"
    ]);
  });

  it("can produce a documented dry-run plan without executing commands", () => {
    expect(buildReleaseCommandPlan()).toEqual([
      { script: "verify", command: "npm run verify", env: {} },
      { script: "scan:maigret", command: "npm run scan:maigret", env: {} },
      { script: "code:hygiene", command: "npm run code:hygiene", env: {} },
      { script: "product:verify", command: "npm run product:verify", env: {} },
      { script: "security:audit", command: "npm run security:audit", env: {} },
      { script: "security:secrets", command: "npm run security:secrets", env: {} },
      {
        script: "e2e",
        command: "E2E_BASE_URL=http://127.0.0.1:3130 E2E_REUSE_EXISTING_SERVER=false npm run e2e",
        env: { E2E_BASE_URL: "http://127.0.0.1:3130", E2E_REUSE_EXISTING_SERVER: "false" }
      },
      { script: "assets:all", command: "npm run assets:all", env: {} },
      { script: "store:verify", command: "npm run store:verify", env: {} },
      { script: "toss:verify", command: "npm run toss:verify", env: {} },
      { script: "mobile:verify", command: "npm run mobile:verify", env: {} },
      { script: "android:debug", command: "npm run android:debug", env: {} },
      { script: "android:bundle", command: "npm run android:bundle", env: {} },
      { script: "deploy:verify", command: "npm run deploy:verify", env: {} },
      { script: "launch:readiness", command: "npm run launch:readiness", env: {} }
    ]);
  });
});
