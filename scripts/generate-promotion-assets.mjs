import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const outDir = path.join(root, "docs", "marketing", "assets");
fs.mkdirSync(outDir, { recursive: true });

const fontPath = path.join(root, "public", "fonts", "NotoSansCJKkr-Regular.otf");
const fontData = fs.existsSync(fontPath) ? fs.readFileSync(fontPath).toString("base64") : "";
const fontFamily = fontData ? "IDDNoto" : "Arial, sans-serif";
const fontFace = fontData
  ? `<style>@font-face{font-family:IDDNoto;src:url(data:font/otf;base64,${fontData}) format('opentype');}</style>`
  : "";

const screenshot = {
  scan: path.join(root, "store-assets", "screenshots", "iphone-6.7-01-scan.png"),
  results: path.join(root, "store-assets", "screenshots", "iphone-6.7-02-results.png"),
  report: path.join(root, "store-assets", "screenshots", "iphone-6.7-03-report.png")
};

fs.rmSync(path.join(outDir, "product-hunt-02-score-1270x760.png"), { force: true });

const generated = [];

await renderCard({
  name: "social-card-1200x630.png",
  width: 1200,
  height: 630,
  theme: "light",
  title: ["아이디는", "기억보다 오래 남습니다"],
  subtitle: ["내 아이디가 남은 곳과 잠긴 상세 URL을", "점수보다 먼저 확인하세요."],
  eyebrow: "ID 도플갱어",
  chips: ["username 문자열 점검", "동일인 판정 아님", "정밀 리포트"],
  shots: [
    { file: screenshot.scan, x: 790, y: 64, w: 188, h: 408, rotate: -5 },
    { file: screenshot.results, x: 945, y: 94, w: 200, h: 434, rotate: 5 }
  ],
  accent: "#00A3FF"
});

await renderCard({
  name: "square-card-1080x1080.png",
  width: 1080,
  height: 1080,
  theme: "dark",
  title: ["활동명 확정 전", "30초 점검"],
  subtitle: ["새 이름 공개 전,", "공개 흔적을 먼저 확인합니다."],
  eyebrow: "CREATOR HANDLE CHECK",
  chips: ["공개 흔적", "상세 URL 잠김", "정밀 리포트"],
  shots: [
    { file: screenshot.results, x: 662, y: 410, w: 248, h: 538, rotate: 4 },
    { file: screenshot.scan, x: 484, y: 482, w: 218, h: 474, rotate: -6 }
  ],
  accent: "#2DD4BF"
});

await renderCard({
  name: "brand-risk-check-1080x1080.png",
  width: 1080,
  height: 1080,
  theme: "warm",
  title: ["브랜드명 공개 전", "계정 선점 리스크 체크"],
  subtitle: ["같은 username이 남은 곳을 확인하고", "공식 계정 확보 우선순위를 정하세요."],
  eyebrow: "PRE-LAUNCH BRAND CHECK",
  chips: ["브랜드명", "계정 선점", "사칭 신호"],
  shots: [
    { file: screenshot.report, x: 668, y: 388, w: 250, h: 542, rotate: 4 },
    { file: screenshot.results, x: 496, y: 474, w: 218, h: 474, rotate: -6 }
  ],
  accent: "#F97316"
});

await renderCard({
  name: "product-hunt-gallery-1270x760.png",
  width: 1270,
  height: 760,
  theme: "light",
  title: ["Username risk check,", "without people-search"],
  subtitle: ["Find where a username shows up first,", "then unlock full URLs and action reports."],
  eyebrow: "ID Doppelganger",
  chips: ["Korean-first", "Not identity proof", "Actionable report"],
  safety: "Public username traces only. No identity matching.",
  shots: [
    { file: screenshot.scan, x: 744, y: 76, w: 220, h: 478, rotate: -5 },
    { file: screenshot.results, x: 930, y: 112, w: 236, h: 512, rotate: 5 }
  ],
  accent: "#00A3FF"
});

await renderStep({
  name: "product-hunt-01-scan-1270x760.png",
  title: ["1. Enter a username", "and legitimate purpose"],
  subtitle: ["Username-string checking,", "not people search."],
  file: screenshot.scan
});

await renderStep({
  name: "product-hunt-02-results-1270x760.png",
  title: ["2. Public traces", "first"],
  subtitle: ["Platform cards appear before", "score summaries and full URLs."],
  file: screenshot.results
});

await renderStep({
  name: "product-hunt-03-report-1270x760.png",
  title: ["3. Turn findings", "into a safe report"],
  subtitle: ["Public URLs, risk labels,", "and next steps without identity claims."],
  file: screenshot.report
});

await renderOnePager();

console.log(JSON.stringify({ ok: true, generated }, null, 2));

async function renderCard({ name, width, height, theme, title, subtitle, eyebrow, chips, shots, accent, safety }) {
  const background = Buffer.from(buildCardSvg({ width, height, theme, title, subtitle, eyebrow, chips, accent, safety }));
  const composites = [];

  for (const shot of shots) {
    const mock = await buildPhoneMockup(shot.file, shot.w, shot.h, shot.rotate ?? 0);
    composites.push({ input: mock, left: shot.x, top: shot.y });
  }

  await sharp(background).composite(composites).png().toFile(path.join(outDir, name));
  generated.push(path.join("docs", "marketing", "assets", name));
}

function buildCardSvg({ width, height, theme, title, subtitle, eyebrow, chips, accent, safety }) {
  const palette = {
    light: {
      bg: "#F5F7FB",
      panel: "#FFFFFF",
      ink: "#08111F",
      muted: "#4A5568",
      line: "#D8E0EA",
      soft: "#E7F7FF"
    },
    dark: {
      bg: "#080B10",
      panel: "#111927",
      ink: "#F8FAFC",
      muted: "#B9C7D8",
      line: "#263244",
      soft: "#0E2A34"
    },
    warm: {
      bg: "#FFF8F0",
      panel: "#FFFFFF",
      ink: "#101015",
      muted: "#5B5E66",
      line: "#E9D8C8",
      soft: "#FFE7D1"
    }
  }[theme];

  const isWide = width > height;
  const left = isWide ? 72 : 68;
  const titleY = isWide ? 204 : 266;
  const titleSize = isWide ? 62 : 68;
  const lineHeight = titleSize * 1.14;
  const subtitleY = titleY + title.length * lineHeight + 24;
  const subtitleLines = Array.isArray(subtitle) ? subtitle : [subtitle];
  const chipY = isWide ? height - 112 : 676;
  const eyebrowWidth = Math.max(isWide ? 218 : 252, eyebrow.length * 13 + 62);
  let chipCursor = left;
  const chipMarkup = chips
    .map((chip, index) => {
      const w = Math.max(132, estimateTextWidth(chip, isWide ? 13 : 14, isWide ? 22 : 24) + 34);
      const x = chipCursor;
      chipCursor += w + 16;
      return `<g transform="translate(${x}, ${chipY})"><rect width="${w}" height="46" rx="8" fill="${index === 0 ? accent : palette.panel}" stroke="${index === 0 ? accent : palette.line}" stroke-width="1.5"/><text x="17" y="30" font-family="${fontFamily}" font-size="20" fill="${index === 0 ? "#06111D" : palette.ink}">${escapeXml(chip)}</text></g>`;
    })
    .join("");
  const subtitleMarkup = subtitleLines
    .map((line, index) => `<text x="${left}" y="${subtitleY + index * (isWide ? 38 : 44)}" font-family="${fontFamily}" font-size="${isWide ? 27 : 30}" fill="${palette.muted}" letter-spacing="0">${escapeXml(line)}</text>`)
    .join("");
  const safetyY = subtitleY + subtitleLines.length * (isWide ? 38 : 44) + 22;
  const safetyText = safety ?? (isWide ? "결과는 공개 username 흔적이며, 동일인 증거가 아닙니다." : "결과는 동일인 증거가 아닙니다.");
  const safetyMarkup = `<text x="${left}" y="${safetyY}" font-family="${fontFamily}" font-size="${isWide ? 22 : 24}" fill="${palette.muted}" letter-spacing="0">${escapeXml(safetyText)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    ${fontFace}
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.bg}"/>
      <stop offset="0.58" stop-color="${palette.bg}"/>
      <stop offset="1" stop-color="${palette.soft}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#wash)"/>
  <path d="M${width - 520} -40 C${width - 220} 18 ${width - 64} 220 ${width + 46} 520" fill="none" stroke="${accent}" stroke-width="98" opacity="0.12"/>
  <path d="M${width - 480} ${height + 70} C${width - 300} ${height - 88} ${width - 180} ${height - 150} ${width + 90} ${height - 258}" fill="none" stroke="${accent}" stroke-width="44" opacity="0.16"/>
  <rect x="${left}" y="${isWide ? 68 : 78}" width="${eyebrowWidth}" height="44" rx="8" fill="${palette.panel}" stroke="${palette.line}" stroke-width="1.5"/>
  <circle cx="${left + 24}" cy="${isWide ? 90 : 100}" r="9" fill="${accent}"/>
  <text x="${left + 44}" y="${isWide ? 98 : 108}" font-family="${fontFamily}" font-size="20" fill="${palette.ink}">${escapeXml(eyebrow)}</text>
  <text x="${left}" y="${titleY}" font-family="${fontFamily}" font-size="${titleSize}" font-weight="800" fill="${palette.ink}" letter-spacing="0">${escapeXml(title[0])}</text>
  <text x="${left}" y="${titleY + lineHeight}" font-family="${fontFamily}" font-size="${titleSize}" font-weight="800" fill="${palette.ink}" letter-spacing="0">${escapeXml(title[1])}</text>
  ${subtitleMarkup}
  ${safetyMarkup}
  ${chipMarkup}
  <rect x="${width - (isWide ? 474 : 440)}" y="${isWide ? 58 : 358}" width="${isWide ? 364 : 346}" height="${isWide ? 498 : 604}" rx="12" fill="${palette.panel}" opacity="0.82"/>
  <text x="${width - (isWide ? 432 : 402)}" y="${isWide ? height - 60 : 994}" font-family="${fontFamily}" font-size="${isWide ? 21 : 23}" fill="${palette.muted}">id-doppelganger.app</text>
</svg>`;
}

async function renderStep({ name, title, subtitle, file }) {
  const width = 1270;
  const height = 760;
  const mock = await buildPhoneMockup(file, 282, 612, 0);
  const titleLines = Array.isArray(title) ? title : [title];
  const subtitleLines = Array.isArray(subtitle) ? subtitle : [subtitle];
  const titleMarkup = titleLines
    .map((line, index) => `<text x="92" y="${204 + index * 58}" font-family="${fontFamily}" font-size="52" font-weight="800" fill="#08111F">${escapeXml(line)}</text>`)
    .join("");
  const subtitleY = 238 + titleLines.length * 58;
  const subtitleMarkup = subtitleLines
    .map((line, index) => `<text x="92" y="${subtitleY + index * 36}" font-family="${fontFamily}" font-size="27" fill="#4A5568">${escapeXml(line)}</text>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>${fontFace}</defs>
  <rect width="${width}" height="${height}" fill="#F5F7FB"/>
  <rect x="72" y="72" width="560" height="616" rx="8" fill="#FFFFFF" stroke="#D8E0EA" stroke-width="2"/>
  <rect x="738" y="54" width="386" height="652" rx="16" fill="#0B1018"/>
  <path d="M92 122H574" stroke="#00A3FF" stroke-width="8"/>
  ${titleMarkup}
  ${subtitleMarkup}
  <rect x="92" y="414" width="366" height="58" rx="8" fill="#08111F"/>
  <text x="116" y="452" font-family="${fontFamily}" font-size="24" fill="#FFFFFF">ID Doppelganger</text>
  <text x="92" y="562" font-family="${fontFamily}" font-size="24" fill="#4A5568">Public username traces only.</text>
  <text x="92" y="604" font-family="${fontFamily}" font-size="24" fill="#4A5568">No identity matching. No people search.</text>
</svg>`;

  await sharp(Buffer.from(svg)).composite([{ input: mock, left: 790, top: 76 }]).png().toFile(path.join(outDir, name));
  generated.push(path.join("docs", "marketing", "assets", name));
}

async function renderOnePager() {
  const name = "press-onepager-1600x2000.png";
  const scan = await buildPhoneMockup(screenshot.scan, 284, 616, -4);
  const results = await buildPhoneMockup(screenshot.results, 318, 690, 4);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2000" viewBox="0 0 1600 2000">
  <defs>${fontFace}</defs>
  <rect width="1600" height="2000" fill="#F5F7FB"/>
  <rect x="104" y="104" width="1392" height="1792" rx="14" fill="#FFFFFF" stroke="#D8E0EA" stroke-width="2"/>
  <circle cx="178" cy="178" r="15" fill="#00A3FF"/>
  <text x="212" y="193" font-family="${fontFamily}" font-size="34" fill="#08111F">ID 도플갱어</text>
  <text x="150" y="360" font-family="${fontFamily}" font-size="92" font-weight="800" fill="#08111F">아이디는 기억보다</text>
  <text x="150" y="468" font-family="${fontFamily}" font-size="92" font-weight="800" fill="#08111F">오래 남습니다</text>
  <text x="150" y="560" font-family="${fontFamily}" font-size="38" fill="#4A5568">공개 흔적, 잠긴 상세 URL, 정리 가이드를</text>
  <text x="150" y="616" font-family="${fontFamily}" font-size="38" fill="#4A5568">점검하는 한국어 username 리스크 서비스.</text>
  <rect x="150" y="690" width="462" height="66" rx="8" fill="#08111F"/>
  <text x="182" y="735" font-family="${fontFamily}" font-size="29" fill="#FFFFFF">username 문자열 점검</text>
  <rect x="632" y="690" width="330" height="66" rx="8" fill="#E7F7FF" stroke="#C9E9FF"/>
  <text x="664" y="735" font-family="${fontFamily}" font-size="29" fill="#08111F">동일인 판정 아님</text>
  <rect x="150" y="1034" width="580" height="500" rx="12" fill="#F5F7FB" stroke="#D8E0EA"/>
  <text x="204" y="1132" font-family="${fontFamily}" font-size="42" font-weight="800" fill="#08111F">주요 사용 장면</text>
  <text x="204" y="1238" font-family="${fontFamily}" font-size="33" fill="#2D3748">1. 오래된 아이디 공개 노출 점검</text>
  <text x="204" y="1306" font-family="${fontFamily}" font-size="33" fill="#2D3748">2. 크리에이터 활동명 겹침 확인</text>
  <text x="204" y="1374" font-family="${fontFamily}" font-size="33" fill="#2D3748">3. 브랜드명 공식 계정 선점</text>
  <text x="204" y="1442" font-family="${fontFamily}" font-size="33" fill="#2D3748">4. 사칭 신호 검토와 신고 준비</text>
  <rect x="150" y="1604" width="1300" height="146" rx="12" fill="#08111F"/>
  <text x="204" y="1668" font-family="${fontFamily}" font-size="33" fill="#FFFFFF">서비스 URL: [PUBLIC_URL]</text>
  <text x="204" y="1728" font-family="${fontFamily}" font-size="28" fill="#C9D6E2">문의: khstar1004@yonsei.ac.kr · 결과는 공개 username 참고 신호입니다.</text>
</svg>`;

  await sharp(Buffer.from(svg))
    .composite([
      { input: scan, left: 928, top: 646 },
      { input: results, left: 1112, top: 724 }
    ])
    .png()
    .toFile(path.join(outDir, name));
  generated.push(path.join("docs", "marketing", "assets", name));
}

async function buildPhoneMockup(file, width, height, rotate) {
  const innerMargin = 14;
  const inner = await roundedImage(file, width - innerMargin * 2, height - innerMargin * 2, 26);
  const frame = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect x="0" y="0" width="${width}" height="${height}" rx="36" fill="#08111F"/>
    <rect x="5" y="5" width="${width - 10}" height="${height - 10}" rx="32" fill="#111927" stroke="#263244" stroke-width="2"/>
    <rect x="${width / 2 - 34}" y="13" width="68" height="8" rx="4" fill="#2D3748"/>
  </svg>`);
  const built = await sharp(frame).composite([{ input: inner, left: innerMargin, top: innerMargin + 12 }]).png().toBuffer();

  if (!rotate) return built;
  return sharp(built)
    .rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function roundedImage(file, width, height, radius) {
  const image = await sharp(file).resize(width, height, { fit: "cover", position: "top" }).png().toBuffer();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" fill="#fff"/></svg>`);
  return sharp(image).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function estimateTextWidth(value, asciiWidth, wideWidth) {
  return [...String(value)].reduce((width, char) => width + (char.charCodeAt(0) > 127 ? wideWidth : asciiWidth), 0);
}
