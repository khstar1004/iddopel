import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const androidDir = path.join(projectRoot, "android");
const isWindows = process.platform === "win32";
const gradle = path.join(androidDir, isWindows ? "gradlew.bat" : "gradlew");

const javaHome = findJavaHome();
const androidHome = findAndroidHome();

if (!existsSync(gradle)) {
  fail(`Gradle wrapper not found at ${gradle}`);
}
if (!javaHome) {
  fail("JAVA_HOME not found. Set JAVA_HOME or install a JDK under ~/.codex/jdks/temurin21.");
}
if (!androidHome) {
  fail("ANDROID_HOME not found. Set ANDROID_HOME/ANDROID_SDK_ROOT or install the SDK under ~/.codex/android-sdk.");
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
const args = isWindows ? ["/d", "/c", "call gradlew.bat :app:assembleDebug"] : [":app:assembleDebug"];

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

console.log(
  JSON.stringify(
    {
      ok: true,
      javaHome,
      androidHome,
      artifact: "android/app/build/outputs/apk/debug/app-debug.apk"
    },
    null,
    2
  )
);

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
