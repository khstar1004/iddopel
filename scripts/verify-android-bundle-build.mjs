import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const isWindows = process.platform === "win32";
const artifact = "android/app/build/outputs/bundle/release/app-release.aab";
const androidSigningSecretKeys = [
  "GOOGLE_PLAY_UPLOAD_KEYSTORE_PASSWORD",
  "GOOGLE_PLAY_UPLOAD_KEY_PASSWORD"
];
const androidSigningRequiredFlags = ["ANDROID_RELEASE_SIGNING_REQUIRED", "MOBILE_RELEASE_CHECK", "STORE_RELEASE_CHECK"];

export function resolveAndroidUploadSigningConfig(env = process.env) {
  const hasPath = hasConfiguredValue(env.GOOGLE_PLAY_UPLOAD_KEYSTORE_PATH);
  const hasBase64 = hasConfiguredValue(env.GOOGLE_PLAY_UPLOAD_KEYSTORE_BASE64);
  const source = hasPath ? "path" : hasBase64 ? "base64" : "none";
  const missing = [];

  if (!hasPath && !hasBase64) {
    missing.push("GOOGLE_PLAY_UPLOAD_KEYSTORE_BASE64 or GOOGLE_PLAY_UPLOAD_KEYSTORE_PATH");
  }

  if (!hasConfiguredValue(env.GOOGLE_PLAY_UPLOAD_KEY_ALIAS)) {
    missing.push("GOOGLE_PLAY_UPLOAD_KEY_ALIAS");
  }

  for (const key of androidSigningSecretKeys) {
    if (!hasConfiguredValue(env[key])) missing.push(key);
  }

  return {
    required: androidSigningRequiredFlags.some((key) => env[key] === "true"),
    configured: missing.length === 0,
    source,
    missing
  };
}

function main() {
  const projectRoot = process.cwd();
  const androidDir = path.join(projectRoot, "android");
  const gradle = path.join(androidDir, isWindows ? "gradlew.bat" : "gradlew");
  const artifactPath = path.join(projectRoot, artifact);
  const javaHome = findJavaHome();
  const androidHome = findAndroidHome();
  const signing = resolveAndroidUploadSigningConfig(process.env);

  if (!existsSync(gradle)) {
    fail(`Gradle wrapper not found at ${gradle}`);
  }
  if (!javaHome) {
    fail("JAVA_HOME not found. Set JAVA_HOME or install a JDK under ~/.codex/jdks/temurin21.");
  }
  if (!androidHome) {
    fail("ANDROID_HOME not found. Set ANDROID_HOME/ANDROID_SDK_ROOT or install the SDK under ~/.codex/android-sdk.");
  }
  if (signing.required && !signing.configured) {
    fail(`Android release upload signing is required. Missing: ${signing.missing.join(", ")}.`);
  }

  const env = {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidHome,
    ANDROID_SDK_ROOT: androidHome,
    PATH: [
      path.join(javaHome, "bin"),
      path.join(androidHome, "cmdline-tools", "latest", "bin"),
      path.join(androidHome, "platform-tools"),
      process.env.PATH ?? ""
    ].join(path.delimiter)
  };

  const command = isWindows ? "cmd.exe" : gradle;
  const args = isWindows ? ["/d", "/c", "call gradlew.bat :app:bundleRelease"] : [":app:bundleRelease"];

  const result = spawnSync(command, args, {
    cwd: androidDir,
    env,
    stdio: "inherit",
    shell: false
  });

  if (result.error) {
    fail(result.error.message);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  if (!existsSync(artifactPath)) {
    fail(`Android release bundle was not created at ${artifact}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        javaHome,
        androidHome,
        artifact,
        signingRequired: signing.required,
        signing: signing.configured ? `configured:${signing.source}` : "not-configured"
      },
      null,
      2
    )
  );
}

function findJavaHome() {
  const configured = process.env.JAVA_HOME?.trim();
  if (configured && hasJava(configured)) return configured;

  const codexJdkRoot = path.join(homedir(), ".codex", "jdks", "temurin21");
  if (existsSync(codexJdkRoot)) {
    for (const entry of readdirSync(codexJdkRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const candidate = path.join(codexJdkRoot, entry.name);
        if (hasJava(candidate)) return candidate;
      }
    }
  }

  return null;
}

function findAndroidHome() {
  for (const value of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT]) {
    const configured = value?.trim();
    if (configured && hasAndroidSdk(configured)) return configured;
  }

  const codexSdkRoot = path.join(homedir(), ".codex", "android-sdk");
  if (hasAndroidSdk(codexSdkRoot)) return codexSdkRoot;
  return null;
}

function hasJava(candidate) {
  return existsSync(path.join(candidate, "bin", isWindows ? "java.exe" : "java"));
}

function hasAndroidSdk(candidate) {
  return (
    existsSync(path.join(candidate, "platforms", "android-36")) &&
    existsSync(path.join(candidate, "cmdline-tools", "latest", "bin", isWindows ? "sdkmanager.bat" : "sdkmanager"))
  );
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function hasConfiguredValue(value) {
  const input = String(value || "").trim();
  return Boolean(input) && !/YOUR_|your-|replace-with|placeholder|example/i.test(input);
}

function isMainModule() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  main();
}
