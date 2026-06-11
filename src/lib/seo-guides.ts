export type SeoGuide = {
  slug: string;
  title: string;
  h1: string;
  description: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  scenario: string;
  resultCopy: string;
  safetyCopy: string;
  cta: string;
  comparison?: {
    competitorName: string;
    sourceUrl: string;
    competitorStrengths: string[];
    idDoppelgangerAdvantages: string[];
    bestForCompetitor: string;
    bestForIdDoppelganger: string;
    honestLimit: string;
  };
};

export const seoGuides = [
  {
    slug: "id-rarity-test",
    title: "아이디 희소성 테스트 | ID 도플갱어",
    h1: "내 아이디 희소성 테스트",
    description: "자주 쓰는 아이디가 전세계 공개 계정에서 얼마나 흔한지 점수로 확인하세요.",
    primaryKeyword: "아이디 희소성 테스트",
    secondaryKeywords: ["아이디 검색", "아이디 노출 확인", "디지털 풋프린트"],
    scenario: "게임, 커뮤니티, SNS에서 오래 써온 아이디가 얼마나 겹치는지 빠르게 점검합니다.",
    resultCopy: "무료 점검은 발견된 공개 계정 후보를 먼저 보여주고, 희소성 점수와 국가·카테고리 분포는 아래에 정리합니다.",
    safetyCopy: "실명이나 연락처가 아니라 사용자가 입력한 아이디 문자열만 확인합니다.",
    cta: "내 아이디 흔적 찾기"
  },
  {
    slug: "nickname-search",
    title: "닉네임 검색 | 공개 계정 후보 점검",
    h1: "새 닉네임 쓰기 전에 먼저 검색하세요",
    description: "활동명이나 닉네임 후보가 주요 플랫폼에서 이미 쓰이는지 공개 계정 후보를 점검하세요.",
    primaryKeyword: "닉네임 검색",
    secondaryKeywords: ["활동명 검색", "아이디 찾기", "계정 점검"],
    scenario: "크리에이터명, 게임 닉네임, 커뮤니티 활동명을 정하기 전에 중복 후보를 확인합니다.",
    resultCopy: "SNS, 블로그, 개발자, 커뮤니티 카테고리로 나눠 어떤 표면에서 겹치는지 보여줍니다.",
    safetyCopy: "결과는 동일인 판정이 아니라 공개 username 사용 여부에 대한 후보 신호입니다.",
    cta: "닉네임 후보 점검"
  },
  {
    slug: "old-account-check",
    title: "옛날 계정 찾기 | 방치 계정 노출 점검",
    h1: "10년 전 만든 계정, 아직 살아있을지도 모릅니다",
    description: "오래전에 쓰던 아이디로 남아 있는 공개 계정 후보와 방치 계정 위험을 확인하세요.",
    primaryKeyword: "옛날 계정 찾기",
    secondaryKeywords: ["방치 계정", "흑역사 계정", "계정 정리"],
    scenario: "예전에 쓰던 닉네임이나 아이디를 입력해 블로그, 포럼, 프로필성 사이트 후보를 확인합니다.",
    resultCopy: "정밀 리포트는 전체 URL, 위험도, 방치 계정 정리 가이드를 제공합니다.",
    safetyCopy: "게시글 내용, 프로필 사진, 위치 정보는 수집하거나 요약하지 않습니다.",
    cta: "방치 계정 점검"
  },
  {
    slug: "brand-username-check",
    title: "브랜드명 계정 확인 | 사칭 후보 모니터링",
    h1: "브랜드명 계정 선점 상태를 확인하세요",
    description: "브랜드명, 서비스명, 프로젝트명이 주요 공개 플랫폼에서 사용 중인지 점검하세요.",
    primaryKeyword: "브랜드명 계정 확인",
    secondaryKeywords: ["브랜드 보호", "사칭 계정 확인", "계정 선점"],
    scenario: "출시 전 브랜드명이나 제품명을 입력해 공식 계정 선점이 필요한 플랫폼 후보를 정리합니다.",
    resultCopy: "국가·카테고리 분포와 사칭 가능성 점수로 우선 확인할 플랫폼을 좁힙니다.",
    safetyCopy: "브랜드 보호와 계정 선점 점검 목적에 맞춰 공개 계정 후보만 표시합니다.",
    cta: "브랜드명 점검"
  },
  {
    slug: "impersonation-check",
    title: "사칭 계정 확인 | 공개 아이디 노출 점검",
    h1: "내 활동명으로 보이는 계정 후보를 점검하세요",
    description: "활동명 또는 브랜드명과 같은 공개 username 후보를 확인하고 사칭 가능성 점수를 받아보세요.",
    primaryKeyword: "사칭 계정 확인",
    secondaryKeywords: ["아이디 노출 확인", "브랜드 보호", "공개 계정 검색"],
    scenario: "크리에이터, 소상공인, 팀 계정이 비슷한 username 후보를 빠르게 확인합니다.",
    resultCopy: "정밀 리포트는 발견 플랫폼, URL, 위험도, 신고 준비에 필요한 정리 가이드를 제공합니다.",
    safetyCopy: "발견된 계정들이 같은 사람이라는 의미가 아니며, 괴롭힘이나 추적 목적 사용을 금지합니다.",
    cta: "사칭 후보 점검"
  },
  {
    slug: "digital-footprint-check",
    title: "디지털 풋프린트 점검 | 아이디 노출 확인",
    h1: "인터넷은 네 아이디를 기억합니다",
    description: "하나의 아이디가 여러 공개 플랫폼에 남긴 사용 흔적 후보를 점수와 분포로 확인하세요.",
    primaryKeyword: "디지털 풋프린트 점검",
    secondaryKeywords: ["아이디 노출 확인", "계정 점검", "공개 계정 후보"],
    scenario: "아이디 재사용으로 공개 계정 후보가 연결될 수 있는지 보안 점검 관점에서 확인합니다.",
    resultCopy: "발견된 공개 흔적을 먼저 확인하고, 희소성·노출도·사칭 가능성·방치 계정 위험은 아래에서 비교합니다.",
    safetyCopy: "전화번호, 이메일, 주민번호, 위치 추정, 동일인 확률 계산은 지원하지 않습니다.",
    cta: "노출 후보 확인"
  },
  {
    slug: "namechk-alternative",
    title: "Namechk 대안 | 한국어 아이디 노출 점검",
    h1: "Namechk 대안: 가용성 확인을 넘어 노출 점수까지",
    description: "Namechk처럼 username 사용 여부를 확인하되, 한국어 결과 화면과 희소성·노출도 점수, 안전한 공유 카드를 함께 제공합니다.",
    primaryKeyword: "Namechk 대안",
    secondaryKeywords: ["Namechk alternative", "username checker", "아이디 중복 확인"],
    scenario: "브랜드명이나 닉네임이 이미 쓰이는지만 보는 단계에서, 공개 계정 후보가 어떤 위험 신호인지까지 정리하고 싶을 때 적합합니다.",
    resultCopy: "ID 도플갱어는 발견 후보 수, 한국 서비스 후보, 카테고리 분포, 희소성·노출도 점수를 먼저 보여주고 정밀 리포트로 이어집니다.",
    safetyCopy: "가용성 확인과 공개 username 후보 점검만 다루며, 실명·전화번호·이메일 검색이나 동일인 판정은 제공하지 않습니다.",
    cta: "내 아이디 흔적 찾기",
    comparison: {
      competitorName: "Namechk",
      sourceUrl: "https://namechk.com/",
      competitorStrengths: [
        "도메인과 소셜 username 가용성을 빠르게 확인하는 데 초점이 있습니다.",
        "브랜드명 선점이나 새 프로젝트 이름 검토처럼 availability 중심 작업에 적합합니다."
      ],
      idDoppelgangerAdvantages: [
        "한국어 사용자를 위한 결과 문장, 위험도 배지, 정리 가이드를 제공합니다.",
        "단순 사용 가능 여부가 아니라 희소성·노출도·사칭 가능성·방치 계정 위험을 점수화합니다.",
        "공유 카드에는 플랫폼 URL을 빼고 점수/후보 수만 담아 바이럴과 안전성을 같이 챙깁니다."
      ],
      bestForCompetitor: "도메인과 여러 소셜 핸들의 사용 가능 여부를 빠르게 확인하려는 브랜드 네이밍 작업",
      bestForIdDoppelganger: "한국어 사용자에게 결과를 보여주고, 공개 계정 후보를 점수·분포·정리 가이드로 설명해야 하는 경우",
      honestLimit: "도메인 구매 가능 여부 자체가 핵심이면 전문 도메인/가용성 체크 도구가 더 직접적입니다."
    }
  },
  {
    slug: "whatsmyname-alternative",
    title: "WhatsMyName 대안 | 공개 username 후보 리포트",
    h1: "WhatsMyName 대안: OSINT 목록을 소비자용 리포트로",
    description: "WhatsMyName류 username enumeration 흐름을 한국어 UX, 1회 무료 상세 결과, 안전한 paywall 리포트로 재구성합니다.",
    primaryKeyword: "WhatsMyName 대안",
    secondaryKeywords: ["WhatsMyName alternative", "username OSINT", "공개 계정 검색"],
    scenario: "보안/OSINT 도구의 raw hit list보다 일반 사용자가 이해할 수 있는 점수, 분포, 조치 가이드가 필요할 때 사용합니다.",
    resultCopy: "무료 화면에서 일부 후보를 먼저 보여주고, 전체 URL·위험도·HTML/PDF 리포트는 권한 확인 후 제공합니다.",
    safetyCopy: "공개 username 후보만 다루며, 발견된 계정들이 동일인이라는 뜻이 아니라고 모든 결과 표면에서 고지합니다.",
    cta: "공개 아이디 점검",
    comparison: {
      competitorName: "WhatsMyName",
      sourceUrl: "https://github.com/WebBreacher/WhatsMyName",
      competitorStrengths: [
        "다양한 웹사이트의 username 존재 여부 확인에 쓰이는 공개 데이터셋과 생태계가 있습니다.",
        "보안 분석가와 OSINT 사용자가 다른 도구에 통합하기 좋은 구조입니다."
      ],
      idDoppelgangerAdvantages: [
        "보안 전문가가 아닌 사용자도 이해할 수 있도록 결과를 한국어 카드와 점수로 번역합니다.",
        "1회 무료 상세 결과와 이후 blurred paywall로 소비자 결제 흐름을 제공합니다.",
        "실명·연락처·동일인 판정 금지 문구와 입력 차단을 기본 UX에 넣었습니다."
      ],
      bestForCompetitor: "OSINT 워크플로우나 자체 분석 도구에 username 사이트 데이터를 연결하려는 기술 사용자",
      bestForIdDoppelganger: "웹/토스/모바일에서 바로 결제 가능한 한국어 username 노출 점검 서비스를 운영하려는 경우",
      honestLimit: "원시 데이터셋을 직접 커스터마이징하거나 내부 OSINT 파이프라인에 붙이는 작업은 개발자용 도구가 더 유연합니다."
    }
  },
  {
    slug: "maigret-ios-alternative",
    title: "OSINT 아이디 스캔 대안 | 한국어 아이디 도플갱어 리포트",
    h1: "OSINT 아이디 스캔 대안: dossier보다 안전한 소비자 리포트",
    description: "폭넓은 username 검색을 한국어 안전 문구, 점수 카드, 결제 리포트, 공유 카드가 있는 서비스 UX로 감쌉니다.",
    primaryKeyword: "OSINT 아이디 스캔 대안",
    secondaryKeywords: ["username dossier", "아이디 리포트", "공개 계정 후보"],
    scenario: "폭넓은 검색 결과를 앱 심사와 한국어 사용자에게 맞는 보안 점검 경험으로 제공하고 싶을 때 적합합니다.",
    resultCopy: "원본 HTML 리포트도 권한 확인 후 열 수 있고, 프론트 화면에서는 플랫폼 아이콘과 프로필 fallback을 카드로 보여줍니다.",
    safetyCopy: "프로필 사진 원본 수집이나 게시글 요약 없이 공개 username 사용 현황만 표시하고 동일인 판정은 하지 않습니다.",
    cta: "공개 아이디 점검",
    comparison: {
      competitorName: "OSINT 스캔 앱",
      sourceUrl: "https://apps.apple.com/us/app/maigret-username-osint-tools/id6443857922",
      competitorStrengths: [
        "username으로 여러 웹사이트의 공개 흔적을 빠르게 모으는 OSINT 도구 포지션입니다.",
        "모바일에서 폭넓은 username 검색을 바로 실행하려는 사용자에게 익숙합니다."
      ],
      idDoppelgangerAdvantages: [
        "공개 스캔 결과를 한국어 리포트, 점수, 조치 가이드, HTML/PDF 저장으로 재가공합니다.",
        "웹, 토스 인앱, App Store, Play Store 제출 흐름을 모두 고려한 동일 제품 경험을 제공합니다.",
        "첫 상세 결과 무료와 이후 유료 리포트 전환으로 소비자 퍼널을 갖췄습니다."
      ],
      bestForCompetitor: "개인 기기에서 OSINT 도구 자체를 실행하고 dossier 형태의 raw 결과를 보고 싶은 사용자",
      bestForIdDoppelganger: "일반 사용자에게 더 안전한 한국어 결과 화면, 결제, 공유, 정기 모니터링까지 제공해야 하는 서비스",
      honestLimit: "고급 OSINT 사용자가 raw 옵션을 직접 조정하는 용도라면 CLI 도구가 더 직접적입니다."
    }
  },
  {
    slug: "apify-maigret-alternative",
    title: "Username 스캔 API 대안 | 한국어 username 노출 리포트",
    h1: "Username 스캔 API 대안: API형 결과를 바로 쓰는 소비자 서비스로",
    description: "대규모 username 검색과 exposure score 개념을 참고하되, 한국어 결과 UI와 결제 리포트로 전환합니다.",
    primaryKeyword: "Username 스캔 API 대안",
    secondaryKeywords: ["exposure score", "username OSINT API", "username 리포트"],
    scenario: "API/Actor 실행 결과를 그대로 쓰는 대신, 사용자에게 보여줄 프론트·리포트·paywall·토스 인앱까지 필요할 때 적합합니다.",
    resultCopy: "결과 화면은 발견 계정 후보를 맨 앞에 보여주고, 점수 분석과 분포는 아래에 배치해 사용자가 궁금한 것을 먼저 보게 합니다.",
    safetyCopy: "위험 신호는 참고 점수로만 표현하며, 이메일·전화번호·위치 추정·동일인 확률 계산은 제품 범위에서 제외합니다.",
    cta: "노출 후보 확인",
    comparison: {
      competitorName: "Username 스캔 API",
      sourceUrl: "https://apify.com/apivault_labs/maigret-username-osint",
      competitorStrengths: [
        "대규모 사이트 검색, exposure score, category breakdown 같은 API형 결과를 제공합니다.",
        "자동화 워크플로우에서 Actor 단위로 username 검색을 호출하기 좋습니다."
      ],
      idDoppelgangerAdvantages: [
        "API 결과가 아니라 사용자에게 바로 팔 수 있는 한국어 웹/앱 결과 경험을 제공합니다.",
        "결과 우선 UI, blurred locked rows, 1회 무료 상세 결과로 전환 흐름을 설계했습니다.",
        "App Store/Google Play/토스 제출용 정책 문구와 안전 고지를 제품에 포함했습니다."
      ],
      bestForCompetitor: "개발자가 대량 username 검색을 자동화하거나 자체 데이터 파이프라인에 넣어야 하는 경우",
      bestForIdDoppelganger: "한국 사용자에게 바로 서비스하고 결제·리포트·모니터링까지 운영하려는 경우",
      honestLimit: "대량 API 호출과 커스텀 자동화가 핵심이면 Apify Actor가 더 맞습니다."
    }
  },
  {
    slug: "footprintiq-alternative",
    title: "FootprintIQ 대안 | 아이디 노출 점검과 한국어 리포트",
    h1: "FootprintIQ 대안: 디지털 풋프린트 점검을 한국어 아이디 중심으로",
    description: "FootprintIQ처럼 노출 위험과 정리 가이드를 강조하되, ID 도플갱어는 아이디 문자열, 한국어 UX, 토스/앱 출시 흐름에 집중합니다.",
    primaryKeyword: "FootprintIQ 대안",
    secondaryKeywords: ["FootprintIQ alternative", "digital footprint checker", "아이디 노출 점검"],
    scenario: "디지털 풋프린트 전반이 아니라 username 재사용, 방치 계정, 사칭 후보를 한국어 서비스로 보여주고 싶을 때 사용합니다.",
    resultCopy: "무료 점검은 후보 수와 점수, 정밀 리포트는 전체 URL·정리 가이드·PDF/HTML 저장으로 나뉩니다.",
    safetyCopy: "아이디 문자열 외의 이메일·전화번호·실명 기반 탐색은 지원하지 않아 제품 범위를 username 공개 사용 현황으로 제한합니다.",
    cta: "아이디 노출 점검",
    comparison: {
      competitorName: "FootprintIQ",
      sourceUrl: "https://footprintiq.app/",
      competitorStrengths: [
        "디지털 풋프린트와 노출 위험, 정리 방법을 한 화면에서 설명하는 포지션이 강합니다.",
        "username뿐 아니라 이메일, phone, breach, data broker 같은 넓은 범위를 다루는 메시지를 사용합니다."
      ],
      idDoppelgangerAdvantages: [
        "범위를 아이디 문자열로 좁혀 한국어 사용자가 안전하게 테스트하고 공유할 수 있게 했습니다.",
        "토스 인앱과 국내 앱 심사 문구에 맞춘 순한맛 UX를 별도로 제공합니다.",
        "공유 카드는 URL 없는 점수 카드로 만들어 바이럴 노출과 악용 리스크를 동시에 낮춥니다."
      ],
      bestForCompetitor: "이메일 breach, data broker, phone lookup까지 포함한 넓은 디지털 풋프린트 점검을 원하는 경우",
      bestForIdDoppelganger: "아이디 재사용과 공개 계정 후보를 한국어 바이럴 테스트처럼 보여주고 싶은 경우",
      honestLimit: "이메일 유출, 데이터 브로커, 전화번호 lookup까지 필요한 보안 상품이라면 더 넓은 footprint 도구가 적합합니다."
    }
  }
] satisfies SeoGuide[];

export function getSeoGuide(slug: string) {
  return seoGuides.find((guide) => guide.slug === slug) ?? null;
}

export function getGuideUrl(slug: string) {
  return `/guides/${slug}`;
}
