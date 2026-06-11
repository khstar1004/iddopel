# SEO And Viral Landing Package

The launch build includes static guide pages for the first web acquisition loop. Each page targets a safe username-string use case from `plan.md` and links back to the scan form.

## Published Guide Routes
| Route | Primary keyword | Positioning |
| --- | --- | --- |
| `/guides/id-rarity-test` | 아이디 희소성 테스트 | Check how rare a repeated username is |
| `/guides/nickname-search` | 닉네임 검색 | Check creator/activity nickname candidates before use |
| `/guides/old-account-check` | 옛날 계정 찾기 | Find abandoned public account candidates for an old username |
| `/guides/brand-username-check` | 브랜드명 계정 확인 | Check brand/service username availability and impersonation candidates |
| `/guides/impersonation-check` | 사칭 계정 확인 | Check public username candidates for creator or brand protection |
| `/guides/digital-footprint-check` | 디지털 풋프린트 점검 | Explain username reuse exposure and footprint risk |

## Safety Constraints
Every guide must keep this product position:

- username string usage check, not people search
- no same-person probability or identity proof
- no real name, phone number, email, resident-number-like value, location, post content, or profile photo search
- CTA routes users back to the legitimate-purpose scan form

The source data is `src/lib/seo-guides.ts`, and `src/lib/seo-guides.test.ts` locks the safe positioning.

## Search Metadata
- `src/app/guides/[slug]/page.tsx` exports per-page metadata and FAQ JSON-LD.
- `src/app/sitemap.ts` includes home, policy, Toss, and all guide routes.
- `src/app/robots.ts` allows public marketing routes and disallows `/api/`, `/checkout/`, and `/reports/`.

## Verification
```bash
npm run test -- src/lib/seo-guides.test.ts
npm run verify
```

After production deploy:

```bash
curl -sS https://YOUR_PRODUCTION_DOMAIN/sitemap.xml
curl -sS https://YOUR_PRODUCTION_DOMAIN/robots.txt
```

## Sources
- Next.js sitemap metadata file convention: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
- Next.js robots metadata file convention: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
- Next.js static and generated metadata: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
