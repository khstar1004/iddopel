import sharp from "sharp";
import { categoryLabels, countryLabels } from "./labels";
import type { ScanSummary } from "./types";

const cardWidth = 1200;
const cardHeight = 630;

interface ShareCardOptions {
  origin?: string;
}

export function buildShareCardSvg(summary: ScanSummary, options: ShareCardOptions = {}) {
  const host = hostFromOrigin(options.origin);
  const topCountries = topDistribution(summary.countryDistribution, countryLabels);
  const topCategories = topDistribution(summary.categoryDistribution, categoryLabels);
  const rarityCopy = summary.rarityScore >= 75 ? "꽤 희귀한 아이디" : summary.rarityScore >= 45 ? "어느 정도 쓰이는 아이디" : "이미 많이 쓰이는 아이디";
  const sourceCopy = "아이디 흔적 결과";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}">
  <desc>${escapeXml(`${summary.username}의 ID 도플갱어 점수 ${summary.doppelgangerScore}점, 공개 흔적 ${summary.foundCount}개`)}</desc>
  <rect width="${cardWidth}" height="${cardHeight}" fill="#090A0F"/>
  <rect x="54" y="50" width="1092" height="530" rx="28" fill="#111821" stroke="#243244" stroke-width="2"/>
  <path d="M88 536 H1112" stroke="#1E2B38" stroke-width="2"/>
  <path d="M86 140 H1114" stroke="#1E2B38" stroke-width="2"/>
  <circle cx="1018" cy="153" r="94" fill="#0F2632" stroke="#00D4FF" stroke-opacity="0.55" stroke-width="2"/>
  <circle cx="1018" cy="153" r="58" fill="none" stroke="#2DD4BF" stroke-opacity="0.65" stroke-width="2"/>
  <path d="M1018 153 L1088 121" stroke="#00D4FF" stroke-width="4" stroke-linecap="round"/>
  <text x="86" y="102" fill="#FFFFFF" font-family="Pretendard, Inter, Arial, sans-serif" font-size="32" font-weight="800">ID 도플갱어</text>
  <text x="86" y="130" fill="#8B95A1" font-family="Pretendard, Inter, Arial, sans-serif" font-size="18" font-weight="700">${escapeXml(sourceCopy)}</text>
  <text x="86" y="214" fill="#FFFFFF" font-family="Pretendard, Inter, Arial, sans-serif" font-size="60" font-weight="900">${escapeXml(summary.username)}</text>
  <text x="86" y="262" fill="#A7AAB8" font-family="Pretendard, Inter, Arial, sans-serif" font-size="24" font-weight="700">내 아이디, 전세계에서 나만 쓰는 줄 알았어?</text>
  <g transform="translate(86 310)">
    ${metricCard(0, "ID 도플갱어 점수", `${summary.doppelgangerScore}점`, "#00D4FF")}
    ${metricCard(272, "공개 흔적", `${summary.foundCount}개`, "#2DD4BF")}
    ${metricCard(544, "희소성", `${summary.rarityScore}점`, "#FFB020")}
  </g>
  <g transform="translate(86 460)">
    ${pill(0, `검사 플랫폼 ${summary.checkedCount}개`)}
    ${pill(230, `국가 ${escapeXml(topCountries)}`)}
    ${pill(500, `카테고리 ${escapeXml(topCategories)}`)}
  </g>
  <text x="86" y="558" fill="#D9E2EF" font-family="Pretendard, Inter, Arial, sans-serif" font-size="23" font-weight="800">${escapeXml(rarityCopy)} · 동일인 판정이 아닌 공개 username 흔적</text>
  <text x="1114" y="558" text-anchor="end" fill="#8B95A1" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="800">${escapeXml(host)}</text>
</svg>`;
}

export async function buildShareCardPng(summary: ScanSummary, options: ShareCardOptions = {}) {
  return sharp(Buffer.from(buildShareCardSvg(summary, options))).png().toBuffer();
}

function metricCard(x: number, label: string, value: string, color: string) {
  return `<g transform="translate(${x} 0)">
    <rect width="244" height="116" rx="18" fill="#F7F8FA"/>
    <text x="24" y="38" fill="#4E5968" font-family="Pretendard, Inter, Arial, sans-serif" font-size="19" font-weight="800">${escapeXml(label)}</text>
    <text x="24" y="88" fill="#061015" font-family="Pretendard, Inter, Arial, sans-serif" font-size="44" font-weight="900">${escapeXml(value)}</text>
    <circle cx="214" cy="30" r="10" fill="${color}"/>
  </g>`;
}

function pill(x: number, label: string) {
  return `<g transform="translate(${x} 0)">
    <rect width="206" height="46" rx="23" fill="#1B2733" stroke="#334456"/>
    <text x="103" y="30" text-anchor="middle" fill="#E5EAF0" font-family="Pretendard, Inter, Arial, sans-serif" font-size="17" font-weight="800">${escapeXml(label)}</text>
  </g>`;
}

function topDistribution(distribution: Record<string, number>, labels: Record<string, string>) {
  const [key, value] =
    Object.entries(distribution)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])[0] ?? [];

  if (!key || !value) return "없음";
  return `${labels[key] ?? key} ${value}개`;
}

function hostFromOrigin(origin?: string) {
  if (!origin) return "id-doppelganger";
  try {
    return new URL(origin).hostname.replace(/^www\./, "");
  } catch {
    return origin.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || "id-doppelganger";
  }
}

function escapeXml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
