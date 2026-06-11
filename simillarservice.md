서비스 | 유사도 | 현재 포지션 | 우리가 흡수할 요소
--- | --- | --- | ---
Namechk | 높음 | username/domain availability를 여러 소셜 플랫폼과 도메인에서 확인. 단순 검색창과 채널별 상태 타일이 핵심. | 첫 화면 입력을 아주 단순하게 유지하고, 결과는 플랫폼 카드로 즉시 보여준다.
WhatsMyName.io | 매우 높음 | public username footprint 확인. 결과는 identity proof가 아니라 manual review lead라고 명확히 설명. | 모든 결과 표면에서 "공개 계정 후보"와 "동일인 판정 아님"을 반복한다.
Maigret iOS 앱 | 매우 높음 | username으로 수천 사이트의 dossier를 빠르게 수집하는 모바일 OSINT 도구 포지션. | Maigret 원본 리포트를 화면 안에서 바로 열 수 있게 하되, 앱 심사 리스크가 있는 사람 찾기 카피는 제거한다.
Apify Maigret Actor | 매우 높음 | Maigret 기반 3000개+ 사이트 username 검색, dossier, exposure score, category breakdown을 판매. | 실제 Maigret 스캔, 노출도/카테고리 breakdown, HTML/PDF 리포트를 적극 활용한다.
FootprintIQ | 매우 높음 | 500개+ 공개 소스 기반 digital footprint scanner. 결과를 risk/category와 action plan으로 정리. | 결과 카드를 위험도와 조치 가이드 중심으로 구성하고, 방치 계정 정리/사칭 신고 다음 행동을 제공한다.

## 반영한 제품 원칙

- 사용자가 제일 궁금해하는 것은 점수가 아니라 "어디에 후보가 잡혔는지"이므로 결과 카드가 먼저 나온다.
- 점수는 바이럴과 해석을 위한 보조 장치로 마지막에 둔다.
- 무료는 일부 후보를 충분히 보여주고, 나머지 상세 URL은 모자이크/잠금으로 유료 전환한다.
- Maigret HTML 리포트는 다운로드 전용이 아니라 프론트 화면에서도 바로 볼 수 있어야 한다.
- 안전 문구는 제품 생존 조건이다. 동일인, 사람 찾기, 추적, 신상털이 뉘앙스를 피한다.

## 확인한 소스

- https://namechk.com/
- https://whatsmyname.io/
- https://apps.apple.com/in/app/maigret-username-osint-tools/id6443857922
- https://apify.com/apivault_labs/maigret-username-osint/input-schema
- https://footprintiq.app/digital-footprint-scanner
