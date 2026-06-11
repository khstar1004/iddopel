import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ignoredDirectoryNames = new Set([
  ".git",
  ".maigret-venv",
  ".next",
  ".turbo",
  ".gradle",
  "build",
  "coverage",
  "node_modules",
  "test-results"
]);

const scannedExtensions = new Set([
  "",
  ".config",
  ".css",
  ".env",
  ".example",
  ".gradle",
  ".html",
  ".java",
  ".js",
  ".json",
  ".key",
  ".kt",
  ".mjs",
  ".md",
  ".pem",
  ".plist",
  ".properties",
  ".rb",
  ".sql",
  ".swift",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml"
]);

const sensitiveEnvKeys = new Set([
  "APPLE_PRIVATE_KEY",
  "APP_STORE_CONNECT_API_KEY_P8",
  "APP_STORE_CONNECT_API_KEY_P8_BASE64",
  "CRON_SECRET",
  "DATABASE_URL",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
  "POSTGRES_PASSWORD",
  "TOSS_CLIENT_KEY",
  "TOSS_CONSOLE_API_KEY",
  "TOSS_SECURITY_KEY",
  "TOSS_SECRET_KEY"
]);

export function shouldScanPath(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  const parts = normalized.split("/");
  if (parts.some((part) => ignoredDirectoryNames.has(part))) return false;

  const fileName = basename(normalized);
  if (fileName.startsWith(".env") && !fileName.endsWith(".example")) return false;
  if (normalized.endsWith("/deploy/compose/.env")) return false;

  return scannedExtensions.has(extname(fileName));
}

export function scanTextForSecrets(filePath, contents) {
  const findings = [];
  const lines = contents.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const privateKeyFinding = detectPrivateKeyBlock(rawLine);
    if (privateKeyFinding) {
      findings.push(createFinding(filePath, lineNumber, privateKeyFinding));
    }

    const tokenFinding = detectInlineToken(rawLine);
    if (tokenFinding) {
      findings.push(createFinding(filePath, lineNumber, tokenFinding));
    }

    const envFinding = detectSensitiveAssignment(rawLine);
    if (envFinding) {
      findings.push(createFinding(filePath, lineNumber, envFinding));
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
    allFindings.push(...scanTextForSecrets(relativePath(rootDir, file), contents));
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
        if (!shouldScanPath(normalized)) continue;
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

function detectPrivateKeyBlock(line) {
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(line)) {
    return {
      type: "private-key",
      detail: "Private key material must not be committed to source files."
    };
  }
  return null;
}

function detectInlineToken(line) {
  const match = line.match(/\b(?:test|live)_sk_[A-Za-z0-9_-]{24,}\b/);
  if (!match) return null;

  return {
    type: "payment-secret-token",
    detail: "Payment secret key token detected; move it to the deployment secret manager."
  };
}

function detectSensitiveAssignment(line) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*(?:=|:)\s*(.+?)\s*$/);
  if (!match) return null;

  const [, key, rawValue] = match;
  if (!sensitiveEnvKeys.has(key)) return null;

  const value = stripInlineComment(rawValue).trim();
  if (isPlaceholderValue(value)) return null;

  if (key === "DATABASE_URL" && !/postgres(?:ql)?:\/\/[^:/"']+:[^@/"']+@/i.test(value)) {
    return null;
  }

  if (value.length < 12 && key !== "DATABASE_URL") return null;

  return {
    type: "sensitive-env-assignment",
    detail: `${key} appears to contain a real secret value. Keep it in .env or a secret manager, not source files.`
  };
}

function isPlaceholderValue(value) {
  const unquoted = value.replace(/^["']|["']$/g, "").trim();
  if (!unquoted) return true;
  if (unquoted === "..." || unquoted === "''" || unquoted === '""') return true;
  if (/\b(?:env|values|process\.env)\.[A-Z0-9_]+\b/.test(unquoted)) return true;
  if (unquoted.includes("${") || unquoted.includes("process.env") || unquoted.includes("ENV[")) return true;
  if (unquoted.includes("secrets.")) return true;
  if (unquoted.includes(".repeat(")) return true;

  const normalized = unquoted.toLowerCase();
  return [
    "change-me",
    "dummy",
    "example",
    "fake",
    "not-a-real",
    "placeholder",
    "replace",
    "set ",
    "should_not_render",
    "support@your_domain",
    "user:password",
    "-value",
    "your_",
    "your-",
    "your."
  ].some((marker) => normalized.includes(marker));
}

function stripInlineComment(value) {
  if (/^\s*["']/.test(value)) return value;
  return value.replace(/\s+#.*$/, "");
}

function createFinding(filePath, line, finding) {
  return {
    file: filePath.replaceAll("\\", "/"),
    line,
    ...finding
  };
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
