# Launch Kit

Last updated: 2026-06-11

## Core Message

**Main tagline:** 내 아이디, 전세계에서 나만 쓰는 줄 알았어?

**Plain tagline:** 내 아이디, 어디에 남아 있을까?

**Brand/creator tagline:** 활동명 쓰기 전, 겹치는 공개 흔적부터 확인하세요.

**Safety tagline:** 사람 찾기가 아니라, username 문자열 점검입니다.

## Homepage Copy Variants

### Variant A: Consumer Privacy

Headline: 내 아이디, 어디까지 남아 있을까?

Subheadline: 자주 쓰는 아이디를 입력하면 어느 플랫폼에 흔적이 남아 있는지 카드로 먼저 보여주고, 점수는 마지막 참고 분석으로 정리합니다.

CTA: 내 아이디 흔적 찾기

### Variant B: Creator

Headline: 새 활동명 쓰기 전에 먼저 점검하세요

Subheadline: SNS, 블로그, 커뮤니티에서 같은 username 흔적이 보이는지 확인하고 사칭 가능성 신호와 계정 선점 우선순위를 정리하세요.

CTA: 활동명 겹침 확인

### Variant C: Brand

Headline: 브랜드명 계정, 출시 전에 선점하세요

Subheadline: 서비스명이나 브랜드명이 주요 공개 플랫폼에서 이미 쓰이는지 확인하고 공식 계정 확보가 필요한 표면을 좁혀보세요.

CTA: 브랜드명 점검

## Product Hunt Draft

**Name:** ID Doppelganger

**Tagline:** Check public username exposure before it surprises you

**Description:** ID Doppelganger is a Korean-first username risk checker. Enter a username, nickname, creator handle, or brand name to see public account candidate cards first, then review rarity, exposure, impersonation-candidate signals, and abandoned-account risk. It is not a people-search tool and does not prove identity.

**Maker first comment:**

Hi Product Hunt. I built ID Doppelganger because username reuse is a messy problem: people want to know where an ID appears publicly, but most tools either feel too technical or drift into unsafe people-search territory.

This product is intentionally narrower. It checks a username string, shows public candidate cards first, then scores the public candidate surface while keeping the boundary clear: no real names, phone numbers, emails, profile photos, location inference, post-content search, or same-person probability.

The first version is Korean-first and works as a web/PWA flow, with app-store-ready mobile shells. I would value feedback on the positioning: does "username-string risk check" feel clear enough, or would you frame it differently for creators and small brands?

**Gallery image sequence:**

1. Enter username and legitimate purpose.
2. Review public candidate cards first.
3. Use rarity/exposure/impersonation/abandoned-account scores as the final interpretation layer.
4. Unlock detailed report with full URLs and action guide.
5. Safety boundary: not people search.

## Korean Community Post

제목: 내 아이디가 어디에 남아 있는지 보여주는 한국어 서비스를 만들었습니다

본문:

오래 쓰던 아이디나 새로 정한 닉네임이 다른 공개 플랫폼에서 얼마나 겹치는지 궁금할 때가 있습니다. 그래서 `ID 도플갱어`를 만들었습니다.

아이디 문자열을 입력하면 공개 흔적 카드가 먼저 뜨고, 희소성·노출도·사칭 가능성·방치 계정 위험 점수는 마지막 참고 분석으로 정리됩니다.

중요한 제한도 분명히 두었습니다.

- 실명/전화번호/이메일 검색은 지원하지 않습니다.
- 발견된 계정이 같은 사람이라는 뜻이 아닙니다.
- 위치, 사진, 게시글 내용, 동일인 확률은 다루지 않습니다.
- 본인 아이디, 브랜드명, 활동명, 사용 예정 닉네임 같은 정당한 목적에 맞춘 점검 도구입니다.

출시 전 피드백을 받고 싶습니다. 특히 "사람 찾기"로 오해되지 않으면서도 기능이 한 번에 이해되는 표현인지 봐주시면 좋겠습니다.

CTA: 내 아이디 흔적 찾기

## LinkedIn Posts

### Founder Build Post

I built a Korean-first username exposure checker with one hard boundary: it is not people search.

The problem is real. People reuse handles across communities, creators need to protect activity names, and small brands often forget to claim key usernames before launch.

But the unsafe version of this category is obvious too. So ID Doppelganger only checks public username-string candidates. No real names. No phone or email search. No location inference. No profile photo analysis. No same-person probability.

The first flow shows public candidate cards first, then rarity, exposure, impersonation-candidate signals, abandoned-account risk, and a report users can act on.

I am testing positioning now: "public username exposure check" vs. "digital footprint check" vs. "brand username protection." If one feels clearer, I would value the read.

### Creator-Focused Post

Before you commit to a creator handle, check whether the username already has public account candidates.

ID Doppelganger helps creators and small teams answer:

- Is this handle rare or already common?
- Which platforms should I claim first?
- Are there impersonation-candidate accounts worth reviewing?
- Are old username traces still visible?

It does not identify people. It checks username strings and keeps the result framed as candidates, not identity proof.

## X / Threads Drafts

1. Built a small Korean-first tool for a common anxiety: "where else is this username public?" It shows public candidate cards first, then scores rarity/exposure/risk without people-search claims.

2. New product rule I care about: if a feature can be used for privacy-invasive behavior, the marketing copy has to constrain it as much as the code does.

3. For creators: picking a handle is easy. Checking whether it is already exposed, duplicated, or worth claiming across platforms is the part people skip.

4. "사람 찾기"가 아니라 "아이디 문자열 점검"이라는 포지셔닝을 끝까지 지키는 게 이 제품의 핵심 제약이다.

## Press Blurb

ID 도플갱어는 아이디 문자열의 공개 사용 현황을 점검하는 한국어 웹/앱 서비스다. 사용자가 입력한 아이디, 닉네임, 활동명, 브랜드명의 공개 흔적을 먼저 보여주고, 희소성·노출도·사칭 가능성·방치 계정 위험은 마지막 참고 분석으로 정리한다. 서비스는 실명, 전화번호, 이메일, 위치, 사진, 게시글 내용, 동일인 확률을 다루지 않으며, 결과를 공개 username 사용 흔적으로만 해석하도록 설계됐다.

## Store Listing Improvements

Apple subtitle candidate, 30 chars max:

- 공개 흔적 점검
- 닉네임 겹침·사칭 신호 점검
- 공개 흔적 점검

Google short description candidate, 80 chars max:

- 아이디 하나로 남아 있는 공개 흔적을 먼저 확인하세요.

Screenshot captions:

1. 아이디 입력 후 정당한 목적 확인
2. 공개 흔적 카드와 잠긴 상세 URL
3. 전체 URL과 조치 가이드는 정밀 리포트에서
4. 실명·전화번호·이메일 검색은 지원하지 않음

## Launch Day Checklist

- Product works in incognito on production domain.
- `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/pricing.md` return 200.
- Search console properties verified.
- Support email works.
- Demo video uploaded.
- Store screenshots finalized.
- Announcement copy reviewed for safety language.
- Product Hunt first comment ready, if using PH.
- Founder/community posts scheduled manually.
- Monitoring dashboard open for errors and conversion events.
