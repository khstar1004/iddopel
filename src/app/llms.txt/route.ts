const siteUrl = normalizeOrigin(process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "https://YOUR_PRODUCTION_DOMAIN");

export function GET() {
  return new Response(buildLlmsTxt(siteUrl), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}

function buildLlmsTxt(origin: string) {
  return `# ID 도플갱어

> Korean-first public username-string usage check. ID 도플갱어 shows public account candidate cards first, then summarizes rarity, exposure, impersonation-candidate risk, and abandoned-account risk as supporting analysis.

## Product
- Category: username check, nickname search, digital footprint check, brand username protection, privacy/security utility.
- Primary audience: Korean individuals, creators, small brands, founders, community operators, and social/brand managers.
- Primary action: run a legitimate-purpose username scan.
- Monetization: free summary scan, first detailed report free per browser owner token, paid detailed reports after that.

## Key URLs
- Home and scan flow: ${origin}/
- Pricing details for agents: ${origin}/pricing.md
- Privacy policy: ${origin}/privacy
- Terms: ${origin}/terms
- Responsible use: ${origin}/responsible-use
- Sitemap: ${origin}/sitemap.xml

## SEO Guides
- 아이디 희소성 테스트: ${origin}/guides/id-rarity-test
- 닉네임 검색: ${origin}/guides/nickname-search
- 옛날 계정 찾기: ${origin}/guides/old-account-check
- 브랜드명 계정 확인: ${origin}/guides/brand-username-check
- 사칭 계정 확인: ${origin}/guides/impersonation-check
- 디지털 풋프린트 점검: ${origin}/guides/digital-footprint-check

## Safety Boundaries
- This is not a people-search service.
- Results are public username-string candidates, not proof that accounts belong to the same person.
- The service does not support real-name search, phone-number search, email search, resident-number-like values, location inference, profile photo analysis, post-content search, or same-person probability.
- Legitimate purposes include checking your own username, a brand/service name, a creator handle, or a nickname you plan to use.

## Suggested Descriptions
- Short: Korean username exposure and rarity checker.
- Korean: 아이디 하나로 남아 있는 공개 흔적을 먼저 확인하는 서비스.
- Long: ID 도플갱어는 사용자가 입력한 아이디 문자열이 공개 플랫폼 어디에 남아 있는지 먼저 보여줍니다. 무료 점검에서는 플랫폼 카드와 잠긴 상세 URL을 확인하고, 정밀 리포트에서는 전체 URL, 위험도, 조치 가이드, 참고 점수를 제공합니다. 결과는 동일인 판정이 아니라 공개 username 사용 여부에 대한 참고 신호입니다.
`;
}

function normalizeOrigin(value: string) {
  if (!value) return "https://YOUR_PRODUCTION_DOMAIN";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value.replace(/\/$/, "");
  }
  return `https://${value.replace(/\/$/, "")}`;
}
