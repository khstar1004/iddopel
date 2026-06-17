import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scannedRoots = ["src/", "native-web/", "docs/"];
const clientRoots = ["src/components/", "src/app/", "native-web/"];
const ignoredDirectoryNames = new Set([".git", ".next", "build", "coverage", "node_modules", "test-results"]);
const scannedExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx", ".md"]);
const sensitiveIdentityPatterns = [
  { type: "ci-plain-exposure", pattern: /\b(?:ci|CI|unique_key|uniqueKey)\b/ },
  { type: "di-plain-exposure", pattern: /\b(?:di|DI|unique_in_site|uniqueInSite)\b/ },
  { type: "identity-token-client-storage", pattern: /\b(?:localStorage|sessionStorage)\s*\.\s*setItem\s*\([^)]*(?:identity|verification|certification|ci|di)/i }
];

const allowedFiles = new Set([
  "docs/identity-verification-assurance.md",
  "docs/privacy-data-map.md"
]);

export function shouldScanIdentityAssurancePath(filePath) {
  const normalized = normalizePath(filePath);
  if (!normalized || normalized === ".") return false;
  if (hasIgnoredDirectory(normalized)) return false;
  if (!scannedRoots.some((root) => normalized.startsWith(root))) return false;
  return scannedExtensions.has(extname(basename(normalized)));
}

export function scanTextForIdentityAssurance(filePath, contents) {
  const normalized = normalizePath(filePath);
  if (allowedFiles.has(normalized)) return [];

  const findings = [];
  const lines = contents.split(/\r?\n/);
  const isClientPath = clientRoots.some((root) => normalized.startsWith(root));

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    if (isClientPath) {
      for (const rule of sensitiveIdentityPatterns) {
        if (rule.pattern.test(line) && !isCommentOnly(line)) {
          findings.push(createFinding(normalized, lineNumber, rule.type, clientFindingDetail(rule.type)));
        }
      }
    }

    if (/requestIdentityVerification|certifications\/|identity-verification/i.test(line) && !hasServerVerificationMarker(contents)) {
      findings.push(createFinding(
        normalized,
        lineNumber,
        "identity-flow-without-server-verification-marker",
        "Identity verification integrations must document server-side result lookup, one-time nonce use, and no CI/DI client exposure."
      ));
    }
  });

  return findings;
}

export async function scanWorkspace(rootDir = process.cwd()) {
  const files = await collectScannableFiles(rootDir);
  const findings = [];

  for (const file of files) {
    const contents = await readFile(file, "utf-8").catch(() => null);
    if (contents === null) continue;
    findings.push(...scanTextForIdentityAssurance(relativePath(rootDir, file), contents));
  }

  return {
    ok: findings.length === 0,
    scannedFiles: files.length,
    findings
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

      if (!entry.isFile() || !shouldScanIdentityAssurancePath(normalized)) continue;

      const fileStat = await stat(fullPath);
      if (fileStat.size > 1024 * 1024) continue;
      files.push(fullPath);
    }
  }

  await walk(root);
  return files;
}

function hasServerVerificationMarker(contents) {
  return /IDENTITY_ASSURANCE_SERVER_VERIFIED/.test(contents);
}

function shouldDescendIntoDirectory(directoryPath) {
  const normalized = normalizePath(directoryPath);
  if (!normalized || normalized === ".") return true;
  if (hasIgnoredDirectory(normalized)) return false;

  const directoryPrefix = normalized.endsWith("/") ? normalized : `${normalized}/`;
  return scannedRoots.some((root) => root.startsWith(directoryPrefix) || normalized.startsWith(root));
}

function clientFindingDetail(type) {
  if (type === "identity-token-client-storage") {
    return "Do not store identity verification tokens, CI, or DI in browser storage.";
  }
  return "Do not expose CI/DI or PortOne identity keys in client-visible code or markup.";
}

function isCommentOnly(line) {
  return /^\s*(?:\/\/|\/\*|\*|#)/.test(line);
}

function hasIgnoredDirectory(filePath) {
  return normalizePath(filePath)
    .split("/")
    .some((part) => ignoredDirectoryNames.has(part));
}

function createFinding(file, line, type, detail) {
  return { file, line, type, detail };
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
