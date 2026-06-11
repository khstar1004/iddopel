import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const requiredFiles = [
  "capacitor.config.ts",
  "native-web/index.html",
  "native-web/styles.css",
  "native-web/app.js",
  "native-web/native-billing-bridge.js",
  "native-web/app-config.js",
  "store-assets/app-icon-1024.png",
  "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png",
  "android/app/src/main/java/com/iddoppelganger/app/NativeBillingPlugin.java",
  "ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json",
  "ios/App/App/MainViewController.swift",
  "ios/App/App/NativeBillingPlugin.swift"
];

for (const file of requiredFiles) {
  await access(file);
}

const capacitorConfig = await readFile("capacitor.config.ts", "utf-8");
if (capacitorConfig.includes("server:") || capacitorConfig.includes("url:")) {
  throw new Error("Capacitor production config must not use server.url");
}

const appConfig = await readFile("native-web/app-config.js", "utf-8");
const hasPlaceholder = appConfig.includes("YOUR_PRODUCTION_DOMAIN");
if (process.env.MOBILE_RELEASE_CHECK === "true" && hasPlaceholder) {
  throw new Error("native-web/app-config.js still contains YOUR_PRODUCTION_DOMAIN");
}
if (process.env.MOBILE_RELEASE_CHECK === "true" && process.env.MOBILE_PAYMENTS_ENABLED === "true" && !/["']?paymentsEnabled["']?\s*:\s*true/.test(appConfig)) {
  throw new Error("native-web/app-config.js must enable payments when MOBILE_PAYMENTS_ENABLED=true");
}

const nativeHtml = await readFile("native-web/index.html", "utf-8");
const nativeJs = await readFile("native-web/app.js", "utf-8");
const nativeBillingBridge = await readFile("native-web/native-billing-bridge.js", "utf-8");
const androidBuild = await readFile("android/app/build.gradle", "utf-8");
const androidMainActivity = await readFile("android/app/src/main/java/com/iddoppelganger/app/MainActivity.java", "utf-8");
const androidBillingPlugin = await readFile("android/app/src/main/java/com/iddoppelganger/app/NativeBillingPlugin.java", "utf-8");
const iosStoryboard = await readFile("ios/App/App/Base.lproj/Main.storyboard", "utf-8");
const iosMainViewController = await readFile("ios/App/App/MainViewController.swift", "utf-8");
const iosBillingPlugin = await readFile("ios/App/App/NativeBillingPlugin.swift", "utf-8");
const iosProject = await readFile("ios/App/App.xcodeproj/project.pbxproj", "utf-8");

const reviewSafeChecks = [
  [nativeHtml.includes('id="acknowledge"'), "native shell must require legitimate-purpose acknowledgement"],
  [nativeHtml.includes("native-billing-bridge.js"), "native shell must load the native billing bridge adapter before app code"],
  [nativeHtml.includes("사람 찾기나 동일인 판정 앱이 아니에요"), "native shell must show not-a-people-search review copy"],
  [nativeHtml.includes("검색 기록은 결과 화면에서 바로 삭제"), "native shell must explain deletion in review-facing copy"],
  [nativeJs.includes("validateUsername"), "native shell must validate disallowed input before scanning"],
  [nativeJs.includes("이메일 검색은 지원하지 않아요"), "native shell must block email-style searches"],
  [nativeJs.includes("전화번호 검색은 지원하지 않아요"), "native shell must block phone-number-style searches"],
  [nativeJs.includes("주민번호처럼 보이는 값"), "native shell must block resident-number-like searches"],
  [nativeJs.includes("URL 검색은 지원하지 않아요"), "native shell must block URL-style searches"],
  [nativeJs.includes("App Store와 Google Play 결제 상품 설정"), "native shell must keep native paid reports review-safe until IAP is configured"],
  [nativeHtml.includes('id="restore-report"'), "native shell must expose restore purchase UI for store review"],
  [nativeJs.includes("IDD_NATIVE_BILLING"), "native shell must use the native billing bridge contract"],
  [nativeJs.includes("purchaseDetailedReport"), "native shell must call the native purchase bridge"],
  [nativeJs.includes("restoreDetailedReport"), "native shell must call the native restore bridge"],
  [nativeJs.includes("completeDetailedReportPurchase"), "native shell must complete native purchases after server entitlement succeeds"],
  [nativeJs.includes("/api/mobile/entitlements/apple"), "native shell must redeem Apple transactions through the server entitlement API"],
  [nativeJs.includes("/api/mobile/entitlements/google"), "native shell must redeem Google Play purchases through the server entitlement API"],
  [nativeBillingBridge.includes("Capacitor?.Plugins?.NativeBilling"), "native billing adapter must bind the Capacitor NativeBilling plugin"],
  [nativeBillingBridge.includes("completeDetailedReportPurchase"), "native billing adapter must expose purchase completion"],
  [androidBuild.includes("com.android.billingclient:billing:9.0.0"), "Android build must include Google Play Billing 9"],
  [androidMainActivity.includes("registerPlugin(NativeBillingPlugin.class)"), "Android MainActivity must register the NativeBilling plugin"],
  [androidBillingPlugin.includes('@CapacitorPlugin(name = "NativeBilling")'), "Android NativeBilling plugin must use the NativeBilling JS name"],
  [androidBillingPlugin.includes("BillingClient"), "Android NativeBilling plugin must initialize Google Play BillingClient"],
  [androidBillingPlugin.includes("PendingPurchasesParams"), "Android NativeBilling plugin must enable pending one-time purchases"],
  [androidBillingPlugin.includes("queryProductDetailsAsync"), "Android NativeBilling plugin must query Google Play product details"],
  [androidBillingPlugin.includes("launchBillingFlow"), "Android NativeBilling plugin must launch the Play purchase flow"],
  [androidBillingPlugin.includes("queryPurchasesAsync"), "Android NativeBilling plugin must support restore/pending purchase recovery"],
  [androidBillingPlugin.includes("consumeAsync"), "Android NativeBilling plugin must consume the per-report one-time product after entitlement"],
  [iosStoryboard.includes("MainViewController"), "iOS storyboard must use the custom Capacitor bridge view controller"],
  [iosMainViewController.includes("registerPluginInstance(NativeBillingPlugin())"), "iOS bridge view controller must register the NativeBilling plugin"],
  [iosProject.includes("NativeBillingPlugin.swift in Sources"), "iOS project must compile NativeBillingPlugin.swift"],
  [iosBillingPlugin.includes("CAPBridgedPlugin"), "iOS NativeBilling plugin must use the Capacitor bridged plugin API"],
  [iosBillingPlugin.includes('jsName = "NativeBilling"'), "iOS NativeBilling plugin must use the NativeBilling JS name"],
  [iosBillingPlugin.includes("import StoreKit"), "iOS NativeBilling plugin must use StoreKit"],
  [iosBillingPlugin.includes("Product.products"), "iOS NativeBilling plugin must query App Store products"],
  [iosBillingPlugin.includes("product.purchase()"), "iOS NativeBilling plugin must launch the StoreKit purchase flow"],
  [iosBillingPlugin.includes("Transaction.unfinished"), "iOS NativeBilling plugin must support unfinished transaction recovery"],
  [iosBillingPlugin.includes("transaction.finish()"), "iOS NativeBilling plugin must finish transactions after entitlement"]
];

for (const [ok, message] of reviewSafeChecks) {
  if (!ok) throw new Error(message);
}

const cap = spawnSync(process.execPath, ["node_modules/@capacitor/cli/bin/capacitor", "--version"], {
  encoding: "utf-8"
});
if (cap.status !== 0) {
  throw new Error(cap.stderr || cap.stdout || "Capacitor CLI is not available");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      capacitor: cap.stdout.trim(),
      configuredForRelease: !hasPlaceholder,
      webDir: "native-web",
      androidProject: true,
      iosProject: true
    },
    null,
    2
  )
);
