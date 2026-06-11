import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const marketingDir = path.join(root, "docs", "marketing");
const assetsDir = path.join(marketingDir, "assets");

const archives = [
  {
    output: path.join(marketingDir, "id-doppelganger-press-kit.zip"),
    entries: [
      ["press-release.md", path.join(marketingDir, "press-release.md")],
      ["launch-kit.md", path.join(marketingDir, "launch-kit.md")],
      ["product-hunt-gallery-1270x760.png", path.join(assetsDir, "product-hunt-gallery-1270x760.png")],
      ["social-card-1200x630.png", path.join(assetsDir, "social-card-1200x630.png")],
      ["square-card-1080x1080.png", path.join(assetsDir, "square-card-1080x1080.png")]
    ]
  },
  {
    output: path.join(marketingDir, "id-doppelganger-launch-kit-v2.zip"),
    entries: [
      ["press-release.md", path.join(marketingDir, "press-release.md")],
      ["press-email.md", path.join(marketingDir, "press-email.md")],
      ["launch-campaign-v2.md", path.join(marketingDir, "launch-campaign-v2.md")],
      ["social-copy-v2.md", path.join(marketingDir, "social-copy-v2.md")],
      ["media-pitch-list.csv", path.join(marketingDir, "media-pitch-list.csv")],
      ["brand-risk-check-1080x1080.png", path.join(assetsDir, "brand-risk-check-1080x1080.png")],
      ["press-onepager-1600x2000.png", path.join(assetsDir, "press-onepager-1600x2000.png")],
      ["product-hunt-01-scan-1270x760.png", path.join(assetsDir, "product-hunt-01-scan-1270x760.png")],
      ["product-hunt-02-results-1270x760.png", path.join(assetsDir, "product-hunt-02-results-1270x760.png")],
      ["product-hunt-03-report-1270x760.png", path.join(assetsDir, "product-hunt-03-report-1270x760.png")],
      ["product-hunt-gallery-1270x760.png", path.join(assetsDir, "product-hunt-gallery-1270x760.png")],
      ["social-card-1200x630.png", path.join(assetsDir, "social-card-1200x630.png")],
      ["square-card-1080x1080.png", path.join(assetsDir, "square-card-1080x1080.png")]
    ]
  }
];

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

await Promise.all(archives.map((archive) => writeArchive(archive)));

console.log(JSON.stringify({
  ok: true,
  archives: archives.map((archive) => path.relative(root, archive.output))
}, null, 2));

async function writeArchive({ output, entries }) {
  await mkdir(path.dirname(output), { recursive: true });
  await rm(output, { force: true });

  const zipEntries = await Promise.all(
    entries.map(async ([name, file]) => ({
      name,
      data: await readFile(file),
      date: new Date()
    }))
  );

  await writeFile(output, buildZip(zipEntries));
}

function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf-8");
    const crc = crc32(entry.data);
    const { dosTime, dosDate } = toDosDateTime(entry.date);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + entry.data.length;
  }

  const centralOffset = offset;
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function toDosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    dosTime: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    dosDate: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
