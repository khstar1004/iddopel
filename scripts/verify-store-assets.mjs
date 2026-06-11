import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const expectedPngs = [
  ["public/icons/icon-192.png", 192, 192],
  ["public/icons/icon-512.png", 512, 512],
  ["public/icons/maskable-512.png", 512, 512],
  ["public/icons/apple-touch-icon.png", 180, 180],
  ["store-assets/app-icon-1024.png", 1024, 1024],
  ["store-assets/play-icon-512.png", 512, 512],
  ["store-assets/play-feature-graphic-1024x500.png", 1024, 500],
  ["store-assets/screenshots/iphone-6.7-01-scan.png", 1290, 2796],
  ["store-assets/screenshots/iphone-6.7-02-results.png", 1290, 2796],
  ["store-assets/screenshots/iphone-6.7-03-report.png", 1290, 2796],
  ["store-assets/screenshots/ipad-12.9-01-scan.png", 2048, 2732],
  ["store-assets/screenshots/ipad-12.9-02-results.png", 2048, 2732],
  ["store-assets/screenshots/ipad-12.9-03-report.png", 2048, 2732],
  ["store-assets/screenshots/android-phone-01-scan.png", 1080, 1920],
  ["store-assets/screenshots/android-phone-02-results.png", 1080, 1920],
  ["store-assets/screenshots/android-phone-03-report.png", 1080, 1920],
  ["store-assets/screenshots/android-tablet-01-scan.png", 1600, 2560],
  ["store-assets/screenshots/android-tablet-02-results.png", 1600, 2560],
  ["store-assets/screenshots/android-tablet-03-report.png", 1600, 2560],
  ["fastlane/metadata/android/ko-KR/images/icon.png", 512, 512],
  ["fastlane/metadata/android/ko-KR/images/featureGraphic.png", 1024, 500],
  ["fastlane/metadata/android/ko-KR/images/phoneScreenshots/01-scan.png", 1080, 1920],
  ["fastlane/metadata/android/ko-KR/images/phoneScreenshots/02-results.png", 1080, 1920],
  ["fastlane/metadata/android/ko-KR/images/phoneScreenshots/03-report.png", 1080, 1920],
  ["fastlane/metadata/android/ko-KR/images/tenInchScreenshots/01-scan.png", 1600, 2560],
  ["fastlane/metadata/android/ko-KR/images/tenInchScreenshots/02-results.png", 1600, 2560],
  ["fastlane/metadata/android/ko-KR/images/tenInchScreenshots/03-report.png", 1600, 2560],
  ["fastlane/screenshots/ko-KR/iPhone-6.7-01-scan.png", 1290, 2796],
  ["fastlane/screenshots/ko-KR/iPhone-6.7-02-results.png", 1290, 2796],
  ["fastlane/screenshots/ko-KR/iPhone-6.7-03-report.png", 1290, 2796],
  ["fastlane/screenshots/ko-KR/iPad-12.9-01-scan.png", 2048, 2732],
  ["fastlane/screenshots/ko-KR/iPad-12.9-02-results.png", 2048, 2732],
  ["fastlane/screenshots/ko-KR/iPad-12.9-03-report.png", 2048, 2732]
];

const expectedJson = [
  "store-assets/apple-app-store.json",
  "store-assets/google-play-listing.json"
];

const expectedText = [
  "fastlane/metadata/android/ko-KR/title.txt",
  "fastlane/metadata/android/ko-KR/short_description.txt",
  "fastlane/metadata/android/ko-KR/full_description.txt",
  "fastlane/metadata/android/ko-KR/changelogs/default.txt",
  "fastlane/metadata/ko-KR/name.txt",
  "fastlane/metadata/ko-KR/subtitle.txt",
  "fastlane/metadata/ko-KR/keywords.txt",
  "fastlane/metadata/ko-KR/description.txt",
  "fastlane/metadata/ko-KR/promotional_text.txt",
  "fastlane/metadata/ko-KR/release_notes.txt",
  "fastlane/metadata/ko-KR/support_url.txt",
  "fastlane/metadata/ko-KR/privacy_url.txt",
  "fastlane/metadata/ko-KR/marketing_url.txt"
];

const resultFirstCopy = ["내 아이디 흔적 찾기", "아이디가 남은 곳", "상세 URL 잠김", "원본 HTML/PDF 저장"];

const secondResultFirstGeneratorSnippets = [
  'renderScreenshot("iphone-6.7-02-results.png"',
  'renderScreenshot("ipad-12.9-02-results.png"',
  'renderScreenshot("android-phone-02-results.png"',
  'renderScreenshot("android-tablet-02-results.png"',
  'copyAsset("store-assets/screenshots/android-phone-02-results.png"',
  'copyAsset("store-assets/screenshots/android-tablet-02-results.png"',
  'copyAsset("store-assets/screenshots/iphone-6.7-02-results.png"',
  'copyAsset("store-assets/screenshots/ipad-12.9-02-results.png"'
];

const staleScoreFirstFiles = [
  "store-assets/screenshots/iphone-6.7-02-score.png",
  "store-assets/screenshots/ipad-12.9-02-score.png",
  "store-assets/screenshots/android-phone-02-score.png",
  "store-assets/screenshots/android-tablet-02-score.png",
  "fastlane/metadata/android/ko-KR/images/phoneScreenshots/02-score.png",
  "fastlane/metadata/android/ko-KR/images/tenInchScreenshots/02-score.png",
  "fastlane/screenshots/ko-KR/iPhone-6.7-02-score.png",
  "fastlane/screenshots/ko-KR/iPad-12.9-02-score.png"
];

const staleGeneratorCopy = [
  "희소성 점수 보기",
  "희소성·노출도 점수를 한눈에",
  'screen === "score"',
  'renderScreenshot("iphone-6.7-02-score.png"',
  'copyAsset("store-assets/screenshots/android-phone-02-score.png"'
];

export const expectedStoreAssets = {
  pngs: expectedPngs,
  json: expectedJson,
  text: expectedText,
  resultFirstCopy,
  secondResultFirstGeneratorSnippets,
  staleScoreFirstFiles
};

export async function createStoreAssetReport({
  assetGenerator,
  checkPngDimensions = true,
  checkJson = true,
  checkText = true,
  existingFiles
} = {}) {
  const checks = [];
  const failures = [];

  const pngPaths = new Set(expectedPngs.map(([file]) => file));
  addCheck(
    checks,
    failures,
    "Expected assets include second result-first screenshots",
    secondResultFirstGeneratorSnippets.every((snippet) => {
      const file = snippet.match(/"([^"]+)"/)?.[1];
      return file ? [...pngPaths].some((path) => path.endsWith(file)) : true;
    }),
    "Every second app-store screenshot slot must point at a results screen."
  );
  addCheck(
    checks,
    failures,
    "Expected assets exclude stale score-first screenshots",
    !expectedPngs.some(([file]) => file.includes("02-score")),
    "Expected PNG manifest must not include 02-score screenshots."
  );

  if (checkPngDimensions) {
    for (const [file, width, height] of expectedPngs) {
      try {
        const metadata = await sharp(file).metadata();
        addCheck(
          checks,
          failures,
          `PNG ${file}`,
          metadata.format === "png" && metadata.width === width && metadata.height === height,
          `${file} must be a ${width}x${height} PNG.`
        );
      } catch (error) {
        addCheck(checks, failures, `PNG ${file}`, false, error instanceof Error ? error.message : `${file} could not be read.`);
      }
    }
  }

  if (checkJson) {
    for (const file of expectedJson) {
      try {
        await access(file);
        JSON.parse(await readFile(file, "utf-8"));
        addCheck(checks, failures, `JSON ${file}`, true, `${file} must be valid JSON.`);
      } catch (error) {
        addCheck(checks, failures, `JSON ${file}`, false, error instanceof Error ? error.message : `${file} could not be read.`);
      }
    }
  }

  if (checkText) {
    for (const file of expectedText) {
      try {
        const content = await readFile(file, "utf-8");
        addCheck(checks, failures, `Text ${file}`, content.trim().length > 0, `${file} must not be empty.`);
      } catch (error) {
        addCheck(checks, failures, `Text ${file}`, false, error instanceof Error ? error.message : `${file} could not be read.`);
      }
    }
  }

  const generator = assetGenerator ?? await readFile("scripts/generate-store-assets.mjs", "utf-8");
  for (const copy of resultFirstCopy) {
    addCheck(
      checks,
      failures,
      "Generator includes result-first store screenshot copy",
      generator.includes(copy),
      `scripts/generate-store-assets.mjs should include result-first store screenshot copy: ${copy}.`
    );
  }

  addCheck(
    checks,
    failures,
    "Generator includes second result-first screenshots",
    secondResultFirstGeneratorSnippets.every((snippet) => generator.includes(snippet)),
    "scripts/generate-store-assets.mjs must render and copy 02-results screenshots for every store target."
  );

  for (const staleCopy of staleGeneratorCopy) {
    addCheck(
      checks,
      failures,
      "Generator has stale score-first copy",
      !generator.includes(staleCopy),
      `scripts/generate-store-assets.mjs still contains stale score-first copy: ${staleCopy}.`
    );
  }

  for (const file of staleScoreFirstFiles) {
    addCheck(
      checks,
      failures,
      "Stale score-first store screenshot",
      !(await fileExists(file, existingFiles)),
      `${file} must be removed so score-first screenshots cannot ship.`
    );
  }

  return {
    ok: failures.length === 0,
    checks,
    failures
  };
}

async function fileExists(file, existingFiles) {
  if (existingFiles) return existingFiles.has(file);
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function addCheck(checks, failures, name, ok, detail) {
  checks.push({ name, ok, detail });
  if (!ok) failures.push({ name, detail });
}

function isMainModule() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  createStoreAssetReport()
    .then((report) => {
      if (!report.ok) {
        console.error(JSON.stringify(report, null, 2));
        process.exit(1);
      }
      console.log(`Verified ${expectedPngs.length} PNG assets, ${expectedJson.length} listing files, and ${expectedText.length} metadata files.`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
