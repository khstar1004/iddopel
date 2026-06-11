import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const iconSvgPath = path.join(root, "public", "icon.svg");
const publicIconsDir = path.join(root, "public", "icons");
const storeDir = path.join(root, "store-assets");
const screenshotDir = path.join(storeDir, "screenshots");
const fastlaneAndroidImagesDir = path.join(root, "fastlane", "metadata", "android", "ko-KR", "images");
const fastlaneAppleScreenshotsDir = path.join(root, "fastlane", "screenshots", "ko-KR");

const colors = {
  ink: "#090A0F",
  text: "#191F28",
  muted: "#6B7684",
  blue: "#3182F6",
  cyan: "#00D4FF",
  teal: "#2DD4BF",
  white: "#FFFFFF",
  line: "#E5E8EB",
  pale: "#F7F8FA"
};

await mkdir(publicIconsDir, { recursive: true });
await mkdir(screenshotDir, { recursive: true });
await mkdir(path.join(fastlaneAndroidImagesDir, "phoneScreenshots"), { recursive: true });
await mkdir(path.join(fastlaneAndroidImagesDir, "tenInchScreenshots"), { recursive: true });
await mkdir(fastlaneAppleScreenshotsDir, { recursive: true });

await Promise.all([
  "store-assets/screenshots/iphone-6.7-02-score.png",
  "store-assets/screenshots/ipad-12.9-02-score.png",
  "store-assets/screenshots/android-phone-02-score.png",
  "store-assets/screenshots/android-tablet-02-score.png",
  "fastlane/metadata/android/ko-KR/images/phoneScreenshots/02-score.png",
  "fastlane/metadata/android/ko-KR/images/tenInchScreenshots/02-score.png",
  "fastlane/screenshots/ko-KR/iPhone-6.7-02-score.png",
  "fastlane/screenshots/ko-KR/iPad-12.9-02-score.png"
].map((file) => rm(path.join(root, file), { force: true })));

await Promise.all([
  renderIcon("icon-192.png", 192),
  renderIcon("icon-512.png", 512),
  renderIcon("maskable-512.png", 512),
  renderIcon("apple-touch-icon.png", 180),
  renderStoreIcon("app-icon-1024.png", 1024),
  renderStoreIcon("play-icon-512.png", 512),
  renderSvg("play-feature-graphic-1024x500.png", featureGraphicSvg(), 1024, 500),
  renderScreenshot("iphone-6.7-01-scan.png", 1290, 2796, "scan"),
  renderScreenshot("iphone-6.7-02-results.png", 1290, 2796, "results"),
  renderScreenshot("iphone-6.7-03-report.png", 1290, 2796, "report"),
  renderScreenshot("ipad-12.9-01-scan.png", 2048, 2732, "scan"),
  renderScreenshot("ipad-12.9-02-results.png", 2048, 2732, "results"),
  renderScreenshot("ipad-12.9-03-report.png", 2048, 2732, "report"),
  renderScreenshot("android-phone-01-scan.png", 1080, 1920, "scan"),
  renderScreenshot("android-phone-02-results.png", 1080, 1920, "results"),
  renderScreenshot("android-phone-03-report.png", 1080, 1920, "report"),
  renderScreenshot("android-tablet-01-scan.png", 1600, 2560, "scan"),
  renderScreenshot("android-tablet-02-results.png", 1600, 2560, "results"),
  renderScreenshot("android-tablet-03-report.png", 1600, 2560, "report")
]);

await Promise.all([
  copyAsset("store-assets/play-icon-512.png", "fastlane/metadata/android/ko-KR/images/icon.png"),
  copyAsset("store-assets/play-feature-graphic-1024x500.png", "fastlane/metadata/android/ko-KR/images/featureGraphic.png"),
  copyAsset("store-assets/screenshots/android-phone-01-scan.png", "fastlane/metadata/android/ko-KR/images/phoneScreenshots/01-scan.png"),
  copyAsset("store-assets/screenshots/android-phone-02-results.png", "fastlane/metadata/android/ko-KR/images/phoneScreenshots/02-results.png"),
  copyAsset("store-assets/screenshots/android-phone-03-report.png", "fastlane/metadata/android/ko-KR/images/phoneScreenshots/03-report.png"),
  copyAsset("store-assets/screenshots/android-tablet-01-scan.png", "fastlane/metadata/android/ko-KR/images/tenInchScreenshots/01-scan.png"),
  copyAsset("store-assets/screenshots/android-tablet-02-results.png", "fastlane/metadata/android/ko-KR/images/tenInchScreenshots/02-results.png"),
  copyAsset("store-assets/screenshots/android-tablet-03-report.png", "fastlane/metadata/android/ko-KR/images/tenInchScreenshots/03-report.png"),
  copyAsset("store-assets/screenshots/iphone-6.7-01-scan.png", "fastlane/screenshots/ko-KR/iPhone-6.7-01-scan.png"),
  copyAsset("store-assets/screenshots/iphone-6.7-02-results.png", "fastlane/screenshots/ko-KR/iPhone-6.7-02-results.png"),
  copyAsset("store-assets/screenshots/iphone-6.7-03-report.png", "fastlane/screenshots/ko-KR/iPhone-6.7-03-report.png"),
  copyAsset("store-assets/screenshots/ipad-12.9-01-scan.png", "fastlane/screenshots/ko-KR/iPad-12.9-01-scan.png"),
  copyAsset("store-assets/screenshots/ipad-12.9-02-results.png", "fastlane/screenshots/ko-KR/iPad-12.9-02-results.png"),
  copyAsset("store-assets/screenshots/ipad-12.9-03-report.png", "fastlane/screenshots/ko-KR/iPad-12.9-03-report.png")
]);

console.log("Generated PWA and store assets.");

async function renderIcon(fileName, size) {
  await sharp(iconSvgPath)
    .resize(size, size)
    .png()
    .toFile(path.join(publicIconsDir, fileName));
}

async function renderStoreIcon(fileName, size) {
  await sharp(iconSvgPath)
    .resize(size, size)
    .png()
    .toFile(path.join(storeDir, fileName));
}

async function renderScreenshot(fileName, width, height, screen) {
  await renderSvg(path.join("screenshots", fileName), screenshotSvg(width, height, screen), width, height);
}

async function renderSvg(fileName, svg, width, height) {
  const output = path.join(storeDir, fileName);
  await sharp(Buffer.from(svg))
    .resize(width, height)
    .png()
    .toFile(output);
}

async function copyAsset(from, to) {
  await mkdir(path.dirname(path.join(root, to)), { recursive: true });
  await copyFile(path.join(root, from), path.join(root, to));
}

function featureGraphicSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <style>${fontCss()} .title{font-size:66px;font-weight:800}.body{font-size:28px;font-weight:600}.small{font-size:20px}</style>
  <rect width="1024" height="500" fill="${colors.ink}"/>
  <circle cx="782" cy="250" r="180" fill="none" stroke="${colors.cyan}" stroke-width="20" opacity=".45"/>
  <circle cx="782" cy="250" r="110" fill="none" stroke="${colors.teal}" stroke-width="16" opacity=".72"/>
  <path d="M782 250 914 168" stroke="${colors.cyan}" stroke-width="20" stroke-linecap="round"/>
  <circle cx="782" cy="250" r="44" fill="${colors.cyan}"/>
  <circle cx="782" cy="250" r="22" fill="${colors.ink}"/>
  <text x="72" y="148" fill="${colors.white}" class="title">ID 도플갱어</text>
  <text x="74" y="208" fill="${colors.cyan}" class="body">내 아이디가 남은 곳 먼저 확인</text>
  <text x="74" y="276" fill="#D7E8FF" class="small">아이디가 남아 있는 공개 흔적, 잠긴 상세 URL, 정리 가이드를 한 번에 확인하세요.</text>
  <rect x="74" y="330" width="256" height="58" rx="20" fill="${colors.blue}"/>
  <text x="116" y="368" fill="${colors.white}" class="small">내 아이디 흔적 찾기</text>
</svg>`;
}

function screenshotSvg(width, height, screen) {
  const pad = Math.round(width * 0.07);
  const phoneWidth = Math.round(width * 0.78);
  const phoneX = Math.round((width - phoneWidth) / 2);
  const phoneY = Math.round(height * 0.16);
  const phoneHeight = Math.round(height * 0.68);
  const isTablet = width >= 1500;
  const title = screen === "scan" ? "내 아이디, 어디에 남아 있을까?" : screen === "results" ? "아이디가 남은 곳 확인" : "결제 후 원본 리포트 확인";
  const subtitle = screen === "scan" ? "실명·전화번호·이메일은 검색하지 않아요" : screen === "results" ? "플랫폼 카드와 잠긴 상세 URL이 첫 화면에 떠요" : "조치 가이드, 전체 URL, HTML/PDF 리포트를 한 화면에서 확인해요";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>${fontCss()} .headline{font-size:${Math.round(width * 0.064)}px;font-weight:800}.sub{font-size:${Math.round(width * 0.033)}px;font-weight:600}.phoneText{font-size:${Math.round(width * 0.028)}px}.label{font-size:${Math.round(width * 0.023)}px}.metric{font-size:${Math.round(width * 0.052)}px;font-weight:800}</style>
  <rect width="${width}" height="${height}" fill="${colors.ink}"/>
  <circle cx="${Math.round(width * 0.84)}" cy="${Math.round(height * 0.08)}" r="${Math.round(width * 0.22)}" fill="none" stroke="${colors.cyan}" stroke-width="${Math.round(width * 0.018)}" opacity=".24"/>
  <text x="${pad}" y="${Math.round(height * 0.075)}" fill="${colors.white}" class="headline">${escapeXml(title)}</text>
  <text x="${pad}" y="${Math.round(height * 0.125)}" fill="#B4D9FF" class="sub">${escapeXml(subtitle)}</text>
  <rect x="${phoneX}" y="${phoneY}" width="${phoneWidth}" height="${phoneHeight}" rx="${Math.round(width * 0.065)}" fill="#10131A" stroke="#2A3442" stroke-width="${Math.max(2, Math.round(width * 0.004))}"/>
  <rect x="${phoneX + Math.round(phoneWidth * 0.06)}" y="${phoneY + Math.round(phoneHeight * 0.05)}" width="${Math.round(phoneWidth * 0.88)}" height="${Math.round(phoneHeight * 0.90)}" rx="${Math.round(width * 0.04)}" fill="${screen === "scan" ? colors.ink : colors.pale}"/>
  ${screen === "scan" ? scanScreen(width, phoneX, phoneY, phoneWidth, phoneHeight) : screen === "results" ? resultScreen(width, phoneX, phoneY, phoneWidth, phoneHeight, isTablet) : reportScreen(width, phoneX, phoneY, phoneWidth, phoneHeight)}
</svg>`;
}

function scanScreen(width, x, y, w, h) {
  const left = x + Math.round(w * 0.12);
  const top = y + Math.round(h * 0.15);
  const inputY = top + Math.round(h * 0.2);
  const buttonY = inputY + Math.round(h * 0.13);
  return `
  <text x="${left}" y="${top}" fill="${colors.white}" class="phoneText" font-weight="800">내 아이디, 어디에 남아 있을까?</text>
  <text x="${left}" y="${top + Math.round(width * 0.055)}" fill="#B8C7D9" class="label">공개 프로필 흔적을 빠르게 점검해요.</text>
  <rect x="${left}" y="${inputY}" width="${Math.round(w * 0.76)}" height="${Math.round(h * 0.085)}" rx="${Math.round(width * 0.018)}" fill="#151A22" stroke="#334155"/>
  <text x="${left + Math.round(width * 0.03)}" y="${inputY + Math.round(h * 0.055)}" fill="#E5EAF2" class="phoneText">@brand_id</text>
  <rect x="${left}" y="${buttonY}" width="${Math.round(w * 0.76)}" height="${Math.round(h * 0.085)}" rx="${Math.round(width * 0.02)}" fill="${colors.blue}"/>
  <text x="${left + Math.round(w * 0.18)}" y="${buttonY + Math.round(h * 0.056)}" fill="${colors.white}" class="phoneText" font-weight="800">내 아이디 흔적 찾기</text>
  <rect x="${left}" y="${buttonY + Math.round(h * 0.15)}" width="${Math.round(w * 0.76)}" height="${Math.round(h * 0.18)}" rx="${Math.round(width * 0.025)}" fill="#151A22"/>
  <text x="${left + Math.round(width * 0.03)}" y="${buttonY + Math.round(h * 0.205)}" fill="${colors.cyan}" class="label">책임 있는 사용</text>
  <text x="${left + Math.round(width * 0.03)}" y="${buttonY + Math.round(h * 0.255)}" fill="#C8D2DE" class="label">실명·전화번호·이메일 검색은 지원하지 않아요.</text>`;
}

function resultScreen(width, x, y, w, h) {
  const left = x + Math.round(w * 0.11);
  const top = y + Math.round(h * 0.13);
  const resultCardW = Math.round(w * 0.78);
  const resultCardH = Math.round(h * 0.135);
  const rowGap = Math.round(h * 0.155);
  const scoreTop = top + Math.round(h * 0.64);
  return `
  <text x="${left}" y="${top}" fill="${colors.text}" class="phoneText" font-weight="800">아이디가 남은 곳</text>
  <text x="${left}" y="${top + Math.round(width * 0.05)}" fill="${colors.muted}" class="label">공개 흔적 12개 발견</text>
  ${resultCard(left, top + Math.round(h * 0.10), resultCardW, resultCardH, "Instagram", "SNS · 글로벌 · instagram.com", "주의", "#FFD1D1")}
  ${resultCard(left, top + Math.round(h * 0.10) + rowGap, resultCardW, resultCardH, "Naver Blog", "블로그 · 한국 · blog.naver.com", "확인 필요", "#FFE7B8")}
  ${resultCard(left, top + Math.round(h * 0.10) + rowGap * 2, resultCardW, resultCardH, "GitHub", "개발자 · 글로벌 · github.com", "확인 필요", "#FFE7B8")}
  <rect x="${left}" y="${top + Math.round(h * 0.52)}" width="${resultCardW}" height="${Math.round(h * 0.075)}" rx="${Math.round(width * 0.018)}" fill="#ECFFFB" stroke="#99F6E4" stroke-dasharray="8 8"/>
  <text x="${left + Math.round(width * 0.03)}" y="${top + Math.round(h * 0.567)}" fill="#0F766E" class="label" font-weight="800">상세 URL 잠김 · 전체 리포트에서 열림</text>
  <text x="${left}" y="${scoreTop}" fill="${colors.muted}" class="label">마지막 참고 점수</text>
  <text x="${left}" y="${scoreTop + Math.round(h * 0.082)}" fill="${colors.text}" class="metric">68점</text>
  ${scoreMini(left + Math.round(w * 0.34), scoreTop - Math.round(h * 0.025), "희소성", "22점")}
  ${scoreMini(left + Math.round(w * 0.58), scoreTop - Math.round(h * 0.025), "노출도", "68점")}`;
}

function reportScreen(width, x, y, w, h) {
  const left = x + Math.round(w * 0.11);
  const top = y + Math.round(h * 0.13);
  return `
  <text x="${left}" y="${top}" fill="${colors.text}" class="phoneText" font-weight="800">정밀 리포트</text>
  <text x="${left}" y="${top + Math.round(width * 0.05)}" fill="${colors.muted}" class="label">전체 URL, 위험도, 원본 HTML 리포트까지 확인하세요.</text>
  <rect x="${left}" y="${top + Math.round(h * 0.12)}" width="${Math.round(w * 0.78)}" height="${Math.round(h * 0.095)}" rx="${Math.round(width * 0.022)}" fill="${colors.blue}"/>
  <text x="${left + Math.round(w * 0.21)}" y="${top + Math.round(h * 0.182)}" fill="${colors.white}" class="phoneText" font-weight="800">PDF 리포트 다운로드</text>
  <rect x="${left}" y="${top + Math.round(h * 0.27)}" width="${Math.round(w * 0.78)}" height="${Math.round(h * 0.32)}" rx="${Math.round(width * 0.025)}" fill="${colors.white}" stroke="${colors.line}"/>
  <text x="${left + Math.round(width * 0.03)}" y="${top + Math.round(h * 0.335)}" fill="${colors.text}" class="phoneText" font-weight="800">발견된 공개 흔적</text>
  <text x="${left + Math.round(width * 0.03)}" y="${top + Math.round(h * 0.395)}" fill="${colors.muted}" class="label">결제 토큰으로만 접근 가능한 리포트</text>
  <line x1="${left + Math.round(width * 0.03)}" y1="${top + Math.round(h * 0.45)}" x2="${left + Math.round(w * 0.72)}" y2="${top + Math.round(h * 0.45)}" stroke="${colors.line}" stroke-width="2"/>
  <text x="${left + Math.round(width * 0.03)}" y="${top + Math.round(h * 0.515)}" fill="${colors.text}" class="label">전체 URL, 방치 계정 정리, 원본 HTML/PDF 저장</text>`;
}

function resultCard(x, y, w, h, name, meta, badge, badgeColor) {
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${colors.white}" stroke="${colors.line}"/>
  <rect x="${x + 18}" y="${y + 22}" width="58" height="58" rx="16" fill="#F7FBFF" stroke="#DBE2EA"/>
  <text x="${x + 39}" y="${y + 61}" fill="${colors.blue}" class="label" font-weight="800">${name.slice(0, 1)}</text>
  <text x="${x + 92}" y="${y + 45}" fill="${colors.text}" class="phoneText" font-weight="800">${name}</text>
  <text x="${x + 92}" y="${y + 88}" fill="${colors.muted}" class="label">${meta}</text>
  <rect x="${x + w - 142}" y="${y + 24}" width="104" height="38" rx="19" fill="${badgeColor}"/>
  <text x="${x + w - 116}" y="${y + 50}" fill="${badge === "주의" ? "#761818" : "#5A3900"}" class="label" font-weight="800">${badge}</text>`;
}

function scoreMini(x, y, label, value) {
  return `
  <text x="${x}" y="${y + 32}" fill="${colors.muted}" class="label">${label}</text>
  <text x="${x}" y="${y + 78}" fill="${colors.text}" class="phoneText" font-weight="800">${value}</text>`;
}

function fontCss() {
  return `text{font-family:"Malgun Gothic","Noto Sans CJK KR",Arial,sans-serif;letter-spacing:0}`;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
