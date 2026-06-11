import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const requiredPositioningFiles = [
  "docs/marketing/competitor-uiux-benchmark.md",
  "docs/marketing/launch-kit.md",
  "docs/marketing/launch-campaign-v2.md",
  "docs/marketing/gtm-plan.md",
  "plan.md",
  "simillarservice.md",
  "src/components/ScanExperience.tsx",
  "src/components/TossMiniApp.tsx",
  "native-web/index.html",
  "scripts/generate-store-assets.mjs"
];

const requiredContent = [
  {
    file: "docs/marketing/competitor-uiux-benchmark.md",
    snippets: ["Namechk", "WhatsMyName.io", "Apify Maigret Actor", "FootprintIQ", "Maigret iOS", "Results come before scores"]
  },
  {
    file: "src/components/ScanExperience.tsx",
    snippets: ["공개 후보 확인", "지금 잡힌 후보", "상세 URL 잠김"]
  },
  {
    file: "src/components/TossMiniApp.tsx",
    snippets: ["공개 후보 확인", "잡힌 공개 후보", "상세 URL 잠김"]
  },
  {
    file: "native-web/index.html",
    snippets: ["공개 후보 확인", "발견된 공개 후보"]
  },
  {
    file: "scripts/generate-store-assets.mjs",
    snippets: ["공개 후보 확인", "지금 잡힌 후보", "상세 URL 잠김", "원본 HTML/PDF 저장"]
  },
  {
    file: "plan.md",
    snippets: ["공개 후보 확인", "발견된 공개 후보를 먼저", "점수는 마지막"]
  },
  {
    file: "simillarservice.md",
    snippets: ["결과 카드가 먼저", "Maigret HTML 리포트", "https://whatsmyname.io/"]
  }
];

const staleCopyChecks = [
  {
    pattern: /희소성 점수 보기/g,
    detail: "Use result-first CTA copy such as 공개 후보 확인."
  },
  {
    pattern: /CTA:\s*(?:내 아이디 점수 보기|아이디 점수 보기|ID 도플갱어 찾기)/g,
    detail: "Marketing CTAs should point to public candidate results, not score-first copy."
  },
  {
    pattern: /→\s*도플갱어 점수 공개/g,
    detail: "The funnel should reveal public candidates before scores."
  },
  {
    pattern: /점수·개수·분포 중심/g,
    detail: "The free result strategy is result-first, with scores as supporting interpretation."
  },
  {
    pattern: /점수는 마지막에 확인하세요|먼저 결과 후보를 보고|분포와 점수/g,
    detail: "Keep product UI copy short and result-card-first without explanatory score ordering."
  },
  {
    pattern: /See rarity\/exposure\/impersonation\/abandoned-account scores/g,
    detail: "Product gallery sequence should show public candidates before score summaries."
  }
];

const staleCopyFiles = [
  "plan.md",
  "docs/marketing/launch-kit.md",
  "docs/marketing/launch-campaign-v2.md",
  "docs/marketing/gtm-plan.md",
  "docs/toss-submission.md",
  "README.md",
  "src/components/ScanExperience.tsx",
  "src/components/TossMiniApp.tsx",
  "native-web/index.html"
];

export function createProductPositioningReport({ files }) {
  const checks = [];
  const failures = [];

  for (const file of requiredPositioningFiles) {
    addCheck(checks, failures, `Required file ${file}`, files.has(file), `${file} must exist.`);
  }

  for (const requirement of requiredContent) {
    const contents = files.get(requirement.file) ?? "";
    for (const snippet of requirement.snippets) {
      addCheck(
        checks,
        failures,
        `${requirement.file} contains ${snippet}`,
        contents.includes(snippet),
        `${requirement.file} must contain "${snippet}".`
      );
    }
  }

  for (const file of staleCopyFiles) {
    const contents = files.get(file) ?? "";
    const lines = contents.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const check of staleCopyChecks) {
        check.pattern.lastIndex = 0;
        if (check.pattern.test(line)) {
          failures.push({
            name: "Stale score-first copy",
            detail: check.detail,
            file,
            line: index + 1,
            text: line.trim()
          });
        }
      }
    });
  }

  return {
    ok: failures.length === 0,
    checks,
    failures
  };
}

async function loadFiles(filePaths) {
  const entries = await Promise.all(
    filePaths.map(async (file) => {
      try {
        await access(file);
        return [file, await readFile(file, "utf-8")];
      } catch {
        return [file, null];
      }
    })
  );

  return new Map(entries.filter(([, contents]) => contents !== null));
}

function addCheck(checks, failures, name, ok, detail) {
  checks.push({ name, ok, detail });
  if (!ok) failures.push({ name, detail });
}

function isMainModule() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  loadFiles([...new Set([...requiredPositioningFiles, ...staleCopyFiles])])
    .then((files) => {
      const report = createProductPositioningReport({ files });
      console.log(JSON.stringify(report, null, 2));
      if (!report.ok) process.exit(1);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
