import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

export const expectedMarketingAssets = {
  pngs: [
    ["docs/marketing/assets/social-card-1200x630.png", 1200, 630],
    ["docs/marketing/assets/square-card-1080x1080.png", 1080, 1080],
    ["docs/marketing/assets/brand-risk-check-1080x1080.png", 1080, 1080],
    ["docs/marketing/assets/product-hunt-gallery-1270x760.png", 1270, 760],
    ["docs/marketing/assets/product-hunt-01-scan-1270x760.png", 1270, 760],
    ["docs/marketing/assets/product-hunt-02-results-1270x760.png", 1270, 760],
    ["docs/marketing/assets/product-hunt-03-report-1270x760.png", 1270, 760],
    ["docs/marketing/assets/press-onepager-1600x2000.png", 1600, 2000]
  ],
  text: [
    "docs/marketing/press-release.md",
    "docs/marketing/press-email.md",
    "docs/marketing/launch-kit.md",
    "docs/marketing/launch-campaign-v2.md",
    "docs/marketing/social-copy-v2.md",
    "docs/marketing/media-pitch-list.csv",
    "docs/marketing/distribution-log.md"
  ],
  archives: [
    {
      file: "docs/marketing/id-doppelganger-press-kit.zip",
      entries: [
        "press-release.md",
        "launch-kit.md",
        "product-hunt-gallery-1270x760.png",
        "social-card-1200x630.png",
        "square-card-1080x1080.png"
      ]
    },
    {
      file: "docs/marketing/id-doppelganger-launch-kit-v2.zip",
      entries: [
        "press-release.md",
        "press-email.md",
        "launch-campaign-v2.md",
        "social-copy-v2.md",
        "media-pitch-list.csv",
        "brand-risk-check-1080x1080.png",
        "press-onepager-1600x2000.png",
        "product-hunt-01-scan-1270x760.png",
        "product-hunt-02-results-1270x760.png",
        "product-hunt-03-report-1270x760.png",
        "product-hunt-gallery-1270x760.png",
        "social-card-1200x630.png",
        "square-card-1080x1080.png"
      ]
    }
  ]
};

const staleAssetName = "product-hunt-02-score-1270x760.png";

export async function createMarketingAssetReport({ archives, checkPngDimensions = true } = {}) {
  const checks = [];
  const failures = [];

  if (checkPngDimensions) {
    for (const [file, width, height] of expectedMarketingAssets.pngs) {
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

  for (const file of expectedMarketingAssets.text) {
    try {
      const content = await readFile(file, "utf-8");
      addCheck(checks, failures, `Text ${file}`, content.trim().length > 0, `${file} must not be empty.`);
      addCheck(checks, failures, `Text ${file} result-first`, !content.includes(staleAssetName), `${file} must not reference ${staleAssetName}.`);
    } catch (error) {
      addCheck(checks, failures, `Text ${file}`, false, error instanceof Error ? error.message : `${file} could not be read.`);
    }
  }

  for (const archive of expectedMarketingAssets.archives) {
    const buffer = archives?.get(archive.file) ?? await readOptionalBuffer(archive.file);
    if (!buffer) {
      addCheck(checks, failures, `Archive ${archive.file}`, false, `${archive.file} must exist.`);
      continue;
    }

    addCheck(checks, failures, `Archive ${archive.file}`, buffer.length > 0, `${archive.file} must not be empty.`);

    if (buffer.includes(Buffer.from(staleAssetName, "utf-8"))) {
      failures.push({
        name: "Archive has stale score-first asset",
        file: archive.file,
        detail: `${archive.file} must not include ${staleAssetName}.`
      });
    }

    const entries = readZipEntries(buffer);
    const expected = [...archive.entries].sort();
    const actual = [...entries].sort();
    addCheck(
      checks,
      failures,
      `Archive entries ${archive.file}`,
      JSON.stringify(actual) === JSON.stringify(expected),
      `${archive.file} entries must be ${expected.join(", ")}.`
    );
  }

  return {
    ok: failures.length === 0,
    checks,
    failures
  };
}

async function readOptionalBuffer(file) {
  try {
    await access(file);
    return await readFile(file);
  } catch {
    return null;
  }
}

function readZipEntries(buffer) {
  const end = findEndOfCentralDirectory(buffer);
  if (end === -1) return [];

  const totalEntries = buffer.readUInt16LE(end + 10);
  let cursor = buffer.readUInt32LE(end + 16);
  const entries = [];

  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) return [];
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const nameStart = cursor + 46;
    entries.push(buffer.subarray(nameStart, nameStart + nameLength).toString("utf-8"));
    cursor = nameStart + nameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function addCheck(checks, failures, name, ok, detail) {
  checks.push({ name, ok, detail });
  if (!ok) failures.push({ name, detail });
}

function isMainModule() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  createMarketingAssetReport()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (!report.ok) process.exit(1);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
