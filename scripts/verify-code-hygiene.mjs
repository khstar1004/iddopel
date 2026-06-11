import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const includedRootPrefixes = [
  "src/",
  "tests/",
  "native-web/",
  "ios/App/App/",
  "android/app/src/"
];

const ignoredDirectoryNames = new Set([
  ".git",
  ".gradle",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "node_modules",
  "test-results"
]);

const scannedExtensions = new Set([
  ".config",
  ".css",
  ".gradle",
  ".html",
  ".java",
  ".js",
  ".json",
  ".kt",
  ".md",
  ".mjs",
  ".plist",
  ".properties",
  ".swift",
  ".ts",
  ".tsx",
  ".xml",
  ".yaml",
  ".yml"
]);

export function shouldScanPath(filePath) {
  const normalized = normalizePath(filePath);
  if (!normalized || normalized === ".") return false;
  if (hasIgnoredDirectory(normalized)) return false;
  if (!includedRootPrefixes.some((prefix) => normalized.startsWith(prefix))) return false;

  return scannedExtensions.has(extname(basename(normalized)));
}

export function scanTextForCodeHygiene(filePath, contents) {
  const findings = [];
  const lines = contents.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;

    for (const finding of detectLineFindings(rawLine)) {
      findings.push(createFinding(filePath, lineNumber, finding));
    }
  });

  return findings;
}

export async function scanWorkspace(rootDir = process.cwd()) {
  const files = await collectScannableFiles(rootDir);
  const allFindings = [];

  for (const file of files) {
    const contents = await readFile(file, "utf-8").catch(() => null);
    if (contents === null) continue;
    allFindings.push(...scanTextForCodeHygiene(relativePath(rootDir, file), contents));
  }

  return {
    ok: allFindings.length === 0,
    scannedFiles: files.length,
    findings: allFindings
  };
}

async function collectScannableFiles(rootDir) {
  const root = resolve(rootDir);
  const files = [];

  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      const normalized = relativePath(root, fullPath);

      if (entry.isDirectory()) {
        if (!shouldDescendIntoDirectory(normalized)) continue;
        await walk(fullPath);
        continue;
      }

      if (!entry.isFile() || !shouldScanPath(normalized)) continue;

      const fileStat = await stat(fullPath);
      if (fileStat.size > 1024 * 1024) continue;
      files.push(fullPath);
    }
  }

  await walk(root);
  return files;
}

function shouldDescendIntoDirectory(directoryPath) {
  const normalized = normalizePath(directoryPath);
  if (!normalized || normalized === ".") return true;
  if (hasIgnoredDirectory(normalized)) return false;

  const directoryPrefix = normalized.endsWith("/") ? normalized : `${normalized}/`;
  return includedRootPrefixes.some((prefix) => prefix.startsWith(directoryPrefix) || normalized.startsWith(prefix));
}

function detectLineFindings(line) {
  const findings = [];

  if (/\b(?:TODO|FIXME)\b/i.test(line)) {
    findings.push({
      type: "unresolved-task-marker",
      detail: "Resolve task markers before shipping the release candidate."
    });
  }

  if (/\bdebugger\b/.test(line)) {
    findings.push({
      type: "debug-statement",
      detail: "Remove debugger statements before shipping the release candidate."
    });
  }

  if (/\bconsole\.(?:log|debug)\s*\(/.test(line)) {
    findings.push({
      type: "console-debug-call",
      detail: "Remove console.log/debug calls from runtime and test release paths."
    });
  }

  if (/\b(?:test|it|describe)\.(?:only|skip)\s*\(/.test(line)) {
    findings.push({
      type: "focused-or-skipped-test",
      detail: "Remove focused or skipped tests so the full suite stays enforced."
    });
  }

  return findings;
}

function hasIgnoredDirectory(filePath) {
  return normalizePath(filePath)
    .split("/")
    .some((part) => ignoredDirectoryNames.has(part));
}

function createFinding(filePath, line, finding) {
  return {
    file: normalizePath(filePath),
    line,
    ...finding
  };
}

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

function relativePath(rootDir, filePath) {
  return resolve(rootDir) === resolve(filePath)
    ? "."
    : resolve(filePath).slice(resolve(rootDir).length + 1).replaceAll("\\", "/");
}

function isMainModule() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  scanWorkspace()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (!report.ok) process.exit(1);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
