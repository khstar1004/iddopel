import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const requiredFiles = [
  "src/app/toss/page.tsx",
  "src/components/TossMiniApp.tsx",
  "src/lib/toss-cors.ts",
  "next.config.ts",
  "docs/toss-submission.md",
  ".cursor/mcp.example.json",
  ".env.example"
];

export function createTossSubmissionReport({ files, packageJson, env = process.env, releaseCheck = false }) {
  const checks = [];
  const localFailures = [];
  const releaseFailures = [];
  const warnings = [];

  function addLocalCheck(name, ok, detail) {
    const check = { name, ok, detail };
    checks.push(check);
    if (!ok) localFailures.push({ name, detail });
  }

  function addReleaseCheck(name, ok, detail) {
    const check = { name, ok, detail };
    checks.push(check);
    if (!ok) releaseFailures.push({ name, detail });
  }

  for (const file of requiredFiles) {
    addLocalCheck(`Required file ${file}`, files.has(file), `${file} must exist.`);
  }

  addLocalCheck("Package script toss:verify", Boolean(packageJson?.scripts?.["toss:verify"]), "package.json must define toss:verify.");

  const page = text(files, "src/app/toss/page.tsx");
  addLocalCheck("Toss route metadata", page.includes("토스 인앱") && page.includes("어디에 공개로 남아"), "The /toss route needs review-safe metadata.");
  addLocalCheck("Toss route mobile viewport", page.includes("device-width") && page.includes("#F7F8FA"), "The /toss route needs a mobile viewport and Toss-light theme color.");

  const component = text(files, "src/components/TossMiniApp.tsx");
  addLocalCheck("Toss surface uses soft security positioning", component.includes("내 아이디, 어디에 남아 있을까?"), "Use a simple Toss/app result headline.");
  addLocalCheck("Toss surface prioritizes result cards", component.includes("공개 흔적") && component.includes("toss-result-card"), "Show public traces before the score summary.");
  addLocalCheck("Toss surface requires legitimate purpose", component.includes("정당한 목적으로 공개 아이디 사용 현황을 점검해요."), "Require legitimate-purpose acknowledgement.");
  addLocalCheck("Toss surface includes disallowed search copy", component.includes("실명, 전화번호, 이메일 검색은 지원하지 않아요."), "Explain unsupported sensitive searches.");
  addLocalCheck("Toss surface avoids identity proof claims", component.includes("같은 사람이라고 단정하지 않아요"), "Explain that results do not prove same-person identity.");
  addLocalCheck("Toss surface has paid report CTA", component.includes("전체 리포트 보기") && component.includes("/api/orders"), "The Toss surface should lead from free score to paid report checkout.");
  addLocalCheck("Toss surface calls scan API", component.includes("/api/scans"), "The Toss surface should call /api/scans.");
  addLocalCheck("Toss surface avoids people-search copy", !/(사람 찾기|동일인 판정|신상|스토킹|털어)/.test(component), "Avoid people-search, stalking, or doxxing positioning in Toss.");

  const cors = text(files, "src/lib/toss-cors.ts");
  addLocalCheck("Toss API CORS allowlist exists", cors.includes("TOSS_MINI_APP_NAME") && cors.includes("TOSS_ALLOWED_ORIGINS"), "Toss mini-app API calls need an explicit Origin allowlist.");
  addLocalCheck("Toss API CORS covers live and private origins", cors.includes("apps.tossmini.com") && cors.includes("private-apps.tossmini.com"), "Allow both live and QR/private Toss origins.");
  addLocalCheck("Toss API rejects unknown origins", cors.includes("FORBIDDEN_ORIGIN"), "Unknown cross-origin API requests should fail closed.");

  const nextConfig = text(files, "next.config.ts");
  addLocalCheck("Toss Payments CSP hosts", nextConfig.includes("https://js.tosspayments.com") && nextConfig.includes("https://api.tosspayments.com"), "CSP should allow Toss Payments script/API hosts.");
  addLocalCheck("Toss payment frame hosts", nextConfig.includes("https://pay.toss.im") && nextConfig.includes("https://*.tosspayments.com"), "CSP should allow Toss payment window frame hosts.");

  const docs = text(files, "docs/toss-submission.md");
  addLocalCheck("Toss docs include policy links", docs.includes("개인정보처리방침") && docs.includes("이용약관") && docs.includes("책임 있는 사용 정책"), "Submission docs should list required policy links.");
  addLocalCheck("Toss docs include review prerequisites", docs.includes("Toss developer console app id") && docs.includes("Production domain allowlist"), "Submission docs should list external Toss console prerequisites.");
  addLocalCheck("Toss docs include MCP setup", docs.includes("apps-in-toss-ax") && docs.includes("@tosspayments/integration-guide-mcp"), "Submission docs should include AppsInToss and Toss Payments MCP setup.");
  addLocalCheck("Toss docs cite official App-in-Toss sources", docs.includes("developers-apps-in-toss.toss.im/development/test/toss.html") && docs.includes("developers-apps-in-toss.toss.im/design/ux-writing.html"), "Submission docs should cite current App-in-Toss testing and UX writing docs.");
  addLocalCheck("Toss docs cite Toss Payments source", docs.includes("docs.tosspayments.com/guides/v2/payment-window/integration"), "Submission docs should cite Toss Payments integration docs.");

  const mcpExample = text(files, ".cursor/mcp.example.json");
  addLocalCheck("Toss MCP config includes AppsInToss AX", mcpExample.includes('"apps-in-toss"') && mcpExample.includes('"ax"') && mcpExample.includes('"mcp"') && mcpExample.includes('"start"'), "Cursor MCP example should include AppsInToss AX.");
  addLocalCheck("Toss MCP config includes Toss Payments guide", mcpExample.includes('"tosspayments-integration-guide"') && mcpExample.includes("@tosspayments/integration-guide-mcp@latest"), "Cursor MCP example should include the Toss Payments integration guide MCP.");

  const envExample = text(files, ".env.example");
  for (const key of [
    "TOSS_CLIENT_KEY",
    "TOSS_SECRET_KEY",
    "TOSS_SECURITY_KEY",
    "TOSS_CONSOLE_API_KEY",
    "TOSS_CONSOLE_APP_ID",
    "TOSS_MINI_APP_NAME",
    "TOSS_ALLOWED_ORIGINS",
    "TOSS_REVIEW_TEST_USERNAME",
    "TOSS_REVIEW_SCENARIO"
  ]) {
    addLocalCheck(`.env.example key ${key}`, envExample.includes(`${key}=`), `.env.example must document ${key}.`);
  }

  if (releaseCheck) {
    addReleaseCheck("Env TOSS_CONSOLE_API_KEY", value(env, "TOSS_CONSOLE_API_KEY").length >= 12, "Set the Apps in Toss console API key for AX/console release automation.");
    addReleaseCheck("Env TOSS_CONSOLE_APP_ID", Boolean(value(env, "TOSS_CONSOLE_APP_ID")), "Set the Toss developer console app id.");
    addReleaseCheck("Env TOSS_MINI_APP_NAME", /^[a-z0-9-]+$/.test(value(env, "TOSS_MINI_APP_NAME")), "Set the Toss mini app name used for tossmini.com origins.");
    addReleaseCheck("Env SITE_URL", isHttpsUrl(value(env, "SITE_URL")), "Set SITE_URL to the production HTTPS origin.");
    addReleaseCheck("Env PAYMENT_PROVIDER", value(env, "PAYMENT_PROVIDER") === "toss", "Set PAYMENT_PROVIDER=toss for Toss/web checkout.");
    addReleaseCheck("Env TOSS_CLIENT_KEY", /^test_ck_|^live_ck_/.test(value(env, "TOSS_CLIENT_KEY")), "Set the Toss Payments client key.");
    addReleaseCheck("Env TOSS_SECRET_KEY", value(env, "TOSS_SECRET_KEY").length >= 12, "Set the Toss Payments secret key.");
    addReleaseCheck("Env TOSS_SECURITY_KEY", /^[a-f0-9]{64}$/i.test(value(env, "TOSS_SECURITY_KEY")), "Set the 64-character Toss Payments security key.");
    addReleaseCheck("Env TOSS_REVIEW_TEST_USERNAME", value(env, "TOSS_REVIEW_TEST_USERNAME").length >= 3, "Provide a review-safe username for Toss reviewers.");
    addReleaseCheck("Env TOSS_REVIEW_SCENARIO", value(env, "TOSS_REVIEW_SCENARIO").length >= 12, "Document the Toss review scenario.");
  } else {
    warnings.push({
      name: "Toss release credential check skipped",
      detail: "Set TOSS_RELEASE_CHECK=true to require Toss console API key/id, production origin, Toss secret key, and review scenario env values."
    });
  }

  const ok = localFailures.length === 0 && (!releaseCheck || releaseFailures.length === 0);
  return {
    ok,
    mode: releaseCheck ? "release" : "local",
    checks,
    localFailures,
    releaseFailures,
    warnings
  };
}

async function main() {
  const [packageJson, files] = await Promise.all([readJson("package.json"), readFiles(requiredFiles)]);
  const report = createTossSubmissionReport({
    files,
    packageJson,
    releaseCheck: process.env.TOSS_RELEASE_CHECK === "true"
  });

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf-8"));
}

async function readFiles(paths) {
  const entries = await Promise.all(
    paths.map(async (path) => {
      try {
        await access(path);
        return [path, await readFile(path, "utf-8")];
      } catch {
        return [path, ""];
      }
    })
  );
  return new Map(entries);
}

function text(files, file) {
  return files.get(file) ?? "";
}

function value(env, key) {
  return env[key]?.trim() ?? "";
}

function isHttpsUrl(input) {
  try {
    const url = new URL(input);
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname) && !/YOUR_|example/i.test(input);
  } catch {
    return false;
  }
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
