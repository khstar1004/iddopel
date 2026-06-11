import { categoryLabels, countryLabels, riskLabels } from "./labels";
import type { ScanJob, ScanResult } from "./types";

export function buildHtmlReport(scan: ScanJob, results: ScanResult[]) {
  const rows = results
    .map(
      (result) => `<tr>
        <td>${escapeHtml(result.platform)}</td>
        <td><a href="${escapeAttribute(result.url)}">${escapeHtml(result.url)}</a></td>
        <td>${escapeHtml(categoryLabels[result.category])}</td>
        <td>${escapeHtml(countryLabels[result.country] ?? result.country)}</td>
        <td>${escapeHtml(riskLabels[result.riskLevel])}</td>
        <td>${escapeHtml(result.cleanupHint)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(scan.username)} ID 도플갱어 리포트</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #191f28; line-height: 1.6; margin: 32px; }
    h1 { margin-bottom: 8px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0; }
    .metric { border: 1px solid #e5e8eb; border-radius: 8px; padding: 12px; }
    .metric span { display: block; color: #6b7684; font-size: 13px; }
    .metric strong { font-size: 24px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #e5e8eb; padding: 10px; text-align: left; vertical-align: top; }
    th { background: #f7f8fa; }
    .notice { color: #4e5968; }
  </style>
</head>
<body>
  <h1>${escapeHtml(scan.username)} ID 도플갱어 리포트</h1>
  <p class="notice">이 결과는 아이디 문자열의 공개 사용 현황이며, 발견된 계정들이 동일인이라는 뜻은 아니에요.</p>
  <section class="summary">
    <div class="metric"><span>공개 계정 후보</span><strong>${scan.foundCount}개</strong></div>
    <div class="metric"><span>희소성</span><strong>${scan.rarityScore}점</strong></div>
    <div class="metric"><span>노출도</span><strong>${scan.exposureScore}점</strong></div>
    <div class="metric"><span>사칭 가능성</span><strong>${scan.impersonationScore}점</strong></div>
  </section>
  <table>
    <thead>
      <tr><th>플랫폼</th><th>URL</th><th>카테고리</th><th>국가</th><th>위험도</th><th>조치 가이드</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
