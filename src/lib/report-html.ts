import { categoryLabels, countryLabels, riskLabels } from "./labels";
import type { RiskLevel, ScanJob, ScanResult } from "./types";

const riskOrder: RiskLevel[] = ["HIGH", "MEDIUM", "LOW"];
const riskWeight: Record<RiskLevel, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

export function buildHtmlReport(scan: ScanJob, results: ScanResult[]) {
  const total = Math.max(1, results.length);
  const riskCounts = countBy(results.map((result) => result.riskLevel));
  const riskCards = riskOrder
    .map((risk) => metricCard(riskLabels[risk], `${riskCounts[risk] ?? 0}개`, percent(riskCounts[risk] ?? 0, total)))
    .join("");
  const categoryBars = distributionBars(
    countBy(results.map((result) => result.category)),
    total,
    (key) => categoryLabels[key as keyof typeof categoryLabels] ?? key
  );
  const countryBars = distributionBars(
    countBy(results.map((result) => result.country)),
    total,
    (key) => countryLabels[key] ?? key
  );
  const priorityItems = [...results]
    .sort((left, right) => {
      if (riskWeight[left.riskLevel] !== riskWeight[right.riskLevel]) {
        return riskWeight[right.riskLevel] - riskWeight[left.riskLevel];
      }
      return left.platform.localeCompare(right.platform);
    })
    .slice(0, 5)
    .map(
      (result) => `<li>
        <strong>${escapeHtml(result.platform)}</strong>
        <span>${escapeHtml(riskLabels[result.riskLevel])} · ${escapeHtml(result.cleanupHint)}</span>
      </li>`
    )
    .join("");
  const actionPlan = buildActionPlan(results)
    .map(
      (step) => `<div class="plan-step">
        <span>${escapeHtml(step.phase)}</span>
        <strong>${escapeHtml(step.label)}</strong>
        <p>${escapeHtml(step.description)}</p>
        <small>${escapeHtml(step.platforms.length > 0 ? step.platforms.join(" · ") : "대상 플랫폼 없음")}</small>
      </div>`
    )
    .join("");
  const reuseMap = buildReuseMap(results)
    .map(
      (row) => `<div class="reuse-row ${row.riskLevel.toLowerCase()}">
        <div><strong>${escapeHtml(row.label)}</strong><span>${row.platforms.length}개 플랫폼</span></div>
        <p>${escapeHtml(row.platforms.join(" · "))}</p>
      </div>`
    )
    .join("");
  const executiveBriefing = buildExecutiveBriefing(scan, results);
  const monthlyDigest = buildMonthlyDigest(scan, results)
    .map(
      (signal) => `<div class="digest-card">
        <span>${escapeHtml(signal.label)}</span>
        <strong>${escapeHtml(signal.value)}</strong>
        <p>${escapeHtml(signal.detail)}</p>
      </div>`
    )
    .join("");
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
    .analysis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 24px 0; }
    .analysis-card { border: 1px solid #dbe2ea; border-radius: 8px; padding: 14px; break-inside: avoid; }
    .analysis-card h2 { margin: 0 0 12px; font-size: 18px; }
    .bar-row { margin: 10px 0; }
    .bar-row div:first-child { display: flex; justify-content: space-between; gap: 12px; color: #4e5968; font-size: 13px; font-weight: 700; }
    .bar-track { height: 9px; overflow: hidden; border-radius: 999px; background: #edf2f7; }
    .bar-track span { display: block; height: 100%; border-radius: inherit; background: #0f766e; }
    .priority { margin: 0; padding-left: 20px; }
    .priority li { margin: 8px 0; }
    .priority strong, .priority span { display: block; }
    .priority span { color: #4e5968; font-size: 13px; }
    .briefing { border: 1px solid #ccefe9; border-radius: 8px; padding: 16px; background: #f8fffd; margin: 24px 0; }
    .briefing h2 { margin: 0 0 8px; font-size: 20px; }
    .briefing p { margin: 0; color: #4e5968; }
    .digest { border: 1px solid #bfe9e3; border-radius: 8px; padding: 16px; background: #f8fffd; margin: 24px 0; }
    .digest h2 { margin: 0 0 8px; font-size: 20px; }
    .digest > p { margin: 0 0 14px; color: #4e5968; }
    .digest-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .digest-card { border: 1px solid #dbe2ea; border-radius: 8px; padding: 12px; background: #ffffff; break-inside: avoid; }
    .digest-card span { display: block; color: #0f766e; font-size: 12px; font-weight: 800; }
    .digest-card strong { display: block; margin-top: 6px; font-size: 24px; }
    .digest-card p { margin: 8px 0 0; color: #4e5968; font-size: 13px; }
    .plan { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 24px 0; }
    .plan-step { border: 1px solid #dbe2ea; border-radius: 8px; padding: 12px; background: #f8fafc; break-inside: avoid; }
    .plan-step > span { display: inline-block; border-radius: 999px; padding: 3px 8px; color: #0f766e; background: #d7fff6; font-size: 12px; font-weight: 800; }
    .plan-step strong, .plan-step small { display: block; }
    .plan-step strong { margin-top: 8px; }
    .plan-step p, .plan-step small { color: #4e5968; font-size: 13px; }
    .reuse { display: grid; gap: 8px; margin: 24px 0; }
    .reuse-row { border: 1px solid #dbe2ea; border-left-width: 5px; border-radius: 8px; padding: 10px; }
    .reuse-row.high { border-left-color: #ef4444; }
    .reuse-row.medium { border-left-color: #f59e0b; }
    .reuse-row.low { border-left-color: #14b8a6; }
    .reuse-row div { display: flex; justify-content: space-between; gap: 12px; }
    .reuse-row p, .reuse-row span { color: #4e5968; font-size: 13px; }
    .reuse-row p { margin: 6px 0 0; }
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
    <div class="metric"><span>공개 흔적</span><strong>${scan.foundCount}개</strong></div>
    <div class="metric"><span>희소성</span><strong>${scan.rarityScore}점</strong></div>
    <div class="metric"><span>노출도</span><strong>${scan.exposureScore}점</strong></div>
    <div class="metric"><span>사칭 가능성</span><strong>${scan.impersonationScore}점</strong></div>
  </section>
  <section class="briefing" aria-label="공유용 브리핑">
    <h2>공유용 브리핑</h2>
    <p>${escapeHtml(executiveBriefing)}</p>
  </section>
  <section class="digest" aria-label="월간 추적 리포트 미리보기">
    <h2>월간 추적 리포트 미리보기</h2>
    <p>현재 월간추적은 대시보드 기반으로 작동하며, 이 블록은 이후 이메일 발송 기능에 재사용할 수 있는 유료 요약입니다.</p>
    <div class="digest-grid">${monthlyDigest}</div>
  </section>
  <section class="analysis" aria-label="유료 분석 보드">
    <div class="analysis-card">
      <h2>위험도 분포</h2>
      ${riskCards}
    </div>
    <div class="analysis-card">
      <h2>플랫폼 성격</h2>
      ${categoryBars}
    </div>
    <div class="analysis-card">
      <h2>국가/권역</h2>
      ${countryBars}
    </div>
    <div class="analysis-card">
      <h2>정리 우선순위</h2>
      <ol class="priority">${priorityItems}</ol>
    </div>
  </section>
  <section aria-label="7일 정리 플랜">
    <h2>7일 정리 플랜</h2>
    <div class="plan">${actionPlan}</div>
  </section>
  <section aria-label="아이디 재사용 지도">
    <h2>아이디 재사용 지도</h2>
    <div class="reuse">${reuseMap}</div>
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

function buildMonthlyDigest(scan: ScanJob, results: ScanResult[]) {
  const highCount = results.filter((result) => result.riskLevel === "HIGH").length;
  const reviewCount = Math.min(results.length, Math.max(3, highCount || 1));
  const platformCount = new Set(results.map((result) => result.platform)).size;
  const topRisk = highestRisk(results);

  return [
    {
      label: "이번 달 발견",
      value: `${results.length}개`,
      detail:
        results.length > 0
          ? `${platformCount}개 플랫폼에서 ${scan.username} 공개 아이디 흔적이 확인됐습니다.`
          : "이번 달 새로 확인된 공개 흔적은 없습니다."
    },
    {
      label: "우선 조치",
      value: `${reviewCount}개`,
      detail:
        highCount > 0
          ? "주의 등급 항목부터 공개 범위, 소개 문구, 외부 링크를 정리하세요."
          : "높은 위험이 없어도 오래된 프로필과 중복 핸들은 정리 후보입니다."
    },
    {
      label: "다음 비교 기준",
      value: `${scan.exposureScore}점`,
      detail: `${riskLabels[topRisk]} 기준으로 다음 월간 재점검 때 위험도 변화를 비교합니다.`
    }
  ];
}

function buildExecutiveBriefing(scan: ScanJob, results: ScanResult[]) {
  const highCount = results.filter((result) => result.riskLevel === "HIGH").length;
  const mediumCount = results.filter((result) => result.riskLevel === "MEDIUM").length;
  const priority = [...results]
    .sort((left, right) => riskWeight[right.riskLevel] - riskWeight[left.riskLevel] || left.platform.localeCompare(right.platform))
    .slice(0, 3)
    .map((result) => `${result.platform}(${riskLabels[result.riskLevel]})`)
    .join(", ");

  return `${scan.username} 아이디는 ${scan.checkedCount}곳 중 ${results.length}개 공개 흔적이 확인됐습니다. 주의 ${highCount}개, 확인 필요 ${mediumCount}개이며, 우선 정리 후보는 ${priority || "없음"}입니다.`;
}

function buildActionPlan(results: ScanResult[]) {
  const highRisk = results.filter((result) => result.riskLevel === "HIGH").slice(0, 3);
  const reviewRisk = results.filter((result) => result.riskLevel === "MEDIUM").slice(0, 3);
  const lowRisk = results.filter((result) => result.riskLevel === "LOW").slice(0, 3);

  return [
    {
      phase: "Day 1",
      label: "공개 URL과 프로필 소개 정리",
      description: "주의 등급 플랫폼부터 프로필 소개, 외부 링크, 공개 활동 노출을 확인하세요.",
      platforms: highRisk.map((result) => result.platform)
    },
    {
      phase: "Day 2-3",
      label: "브랜드/개인 아이디 분리",
      description: "업무용, 크리에이터용, 개인용으로 같은 아이디가 섞인 지점을 분리하세요.",
      platforms: reviewRisk.map((result) => result.platform)
    },
    {
      phase: "Day 4-7",
      label: "증거 보관 후 재점검",
      description: "리포트를 저장하고 변경한 플랫폼을 다음 월간 재점검에서 비교하세요.",
      platforms: lowRisk.map((result) => result.platform)
    }
  ];
}

function buildReuseMap(results: ScanResult[]) {
  const grouped = results.reduce<Record<string, ScanResult[]>>((accumulator, result) => {
    accumulator[result.category] = [...(accumulator[result.category] ?? []), result];
    return accumulator;
  }, {});

  return Object.entries(grouped)
    .map(([category, categoryResults]) => ({
      label: categoryLabels[category as keyof typeof categoryLabels] ?? category,
      platforms: categoryResults.map((result) => result.platform).sort((left, right) => left.localeCompare(right)),
      riskLevel: highestRisk(categoryResults)
    }))
    .sort((left, right) => right.platforms.length - left.platforms.length || riskWeight[right.riskLevel] - riskWeight[left.riskLevel])
    .slice(0, 6);
}

function highestRisk(results: ScanResult[]): RiskLevel {
  return results.reduce<RiskLevel>((highest, result) => {
    return riskWeight[result.riskLevel] > riskWeight[highest] ? result.riskLevel : highest;
  }, "LOW");
}

function metricCard(label: string, value: string, percentage: number) {
  return `<div class="bar-row">
    <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
    <div class="bar-track" aria-hidden="true"><span style="width:${percentage}%"></span></div>
  </div>`;
}

function distributionBars(values: Record<string, number>, total: number, labelFor: (key: string) => string) {
  const rows = Object.entries(values)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5);

  if (rows.length === 0) return `<p class="notice">분포 데이터가 아직 없어요.</p>`;

  return rows.map(([key, value]) => metricCard(labelFor(key), `${value}개`, percent(value, total))).join("");
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}

function percent(value: number, total: number) {
  return Math.round((value / total) * 100);
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
