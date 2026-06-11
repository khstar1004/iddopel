import type { PlatformDefinition } from "./types";

export const platformDefinitions: PlatformDefinition[] = [
  {
    id: "naver-blog",
    name: "Naver Blog",
    category: "BLOG",
    country: "KR",
    urlPattern: "https://blog.naver.com/{username}",
    freePreview: true,
    cleanupHint: "네이버 블로그 프로필과 공개 글 공개 범위를 확인하세요.",
    riskWeight: 8
  },
  {
    id: "tistory",
    name: "Tistory",
    category: "BLOG",
    country: "KR",
    urlPattern: "https://{username}.tistory.com",
    freePreview: true,
    cleanupHint: "오래된 블로그가 있다면 소개글과 글 공개 범위를 정리하세요.",
    riskWeight: 8
  },
  {
    id: "velog",
    name: "Velog",
    category: "DEVELOPER",
    country: "KR",
    urlPattern: "https://velog.io/@{username}",
    freePreview: true,
    cleanupHint: "개발자 프로필의 이메일, 이력 링크 노출 여부를 확인하세요.",
    riskWeight: 7
  },
  {
    id: "github",
    name: "GitHub",
    category: "DEVELOPER",
    country: "GLOBAL",
    urlPattern: "https://github.com/{username}",
    freePreview: true,
    cleanupHint: "README, pinned repo, 커밋 이메일 공개 설정을 확인하세요.",
    riskWeight: 9
  },
  {
    id: "x",
    name: "X",
    category: "SNS",
    country: "GLOBAL",
    urlPattern: "https://x.com/{username}",
    freePreview: true,
    cleanupHint: "프로필 소개, 링크, 오래된 공개 게시물 노출을 점검하세요.",
    riskWeight: 10
  },
  {
    id: "instagram",
    name: "Instagram",
    category: "SNS",
    country: "GLOBAL",
    urlPattern: "https://www.instagram.com/{username}",
    freePreview: true,
    cleanupHint: "사칭 방지를 위해 공식 계정 여부와 프로필 링크를 정리하세요.",
    riskWeight: 10
  },
  {
    id: "threads",
    name: "Threads",
    category: "SNS",
    country: "GLOBAL",
    urlPattern: "https://www.threads.net/@{username}",
    freePreview: false,
    cleanupHint: "SNS 간 동일 아이디 사용 여부를 확인하세요.",
    riskWeight: 7
  },
  {
    id: "youtube",
    name: "YouTube",
    category: "CREATOR",
    country: "GLOBAL",
    urlPattern: "https://www.youtube.com/@{username}",
    freePreview: true,
    cleanupHint: "채널 핸들, 설명, 외부 링크가 최신인지 확인하세요.",
    riskWeight: 8
  },
  {
    id: "twitch",
    name: "Twitch",
    category: "CREATOR",
    country: "GLOBAL",
    urlPattern: "https://www.twitch.tv/{username}",
    freePreview: false,
    cleanupHint: "방치된 스트리밍 프로필이면 소개 문구를 정리하세요.",
    riskWeight: 6
  },
  {
    id: "reddit",
    name: "Reddit",
    category: "COMMUNITY",
    country: "US",
    urlPattern: "https://www.reddit.com/user/{username}",
    freePreview: false,
    cleanupHint: "커뮤니티 프로필의 공개 활동 내역을 점검하세요.",
    riskWeight: 9
  },
  {
    id: "medium",
    name: "Medium",
    category: "BLOG",
    country: "GLOBAL",
    urlPattern: "https://medium.com/@{username}",
    freePreview: false,
    cleanupHint: "작성자 소개와 외부 링크 노출을 확인하세요.",
    riskWeight: 6
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    category: "GLOBAL",
    country: "GLOBAL",
    urlPattern: "https://www.linkedin.com/in/{username}",
    freePreview: false,
    cleanupHint: "업무용 프로필과 개인용 아이디 재사용을 분리하세요.",
    riskWeight: 8
  },
  {
    id: "facebook",
    name: "Facebook",
    category: "SNS",
    country: "GLOBAL",
    urlPattern: "https://www.facebook.com/{username}",
    freePreview: false,
    cleanupHint: "공개 프로필 URL과 검색 노출 설정을 점검하세요.",
    riskWeight: 7
  },
  {
    id: "pinterest",
    name: "Pinterest",
    category: "SNS",
    country: "GLOBAL",
    urlPattern: "https://www.pinterest.com/{username}",
    freePreview: false,
    cleanupHint: "컬렉션과 프로필 공개 범위를 확인하세요.",
    riskWeight: 5
  },
  {
    id: "soundcloud",
    name: "SoundCloud",
    category: "CREATOR",
    country: "GLOBAL",
    urlPattern: "https://soundcloud.com/{username}",
    freePreview: false,
    cleanupHint: "활동명과 연결된 외부 링크를 점검하세요.",
    riskWeight: 5
  },
  {
    id: "behance",
    name: "Behance",
    category: "CREATOR",
    country: "GLOBAL",
    urlPattern: "https://www.behance.net/{username}",
    freePreview: false,
    cleanupHint: "포트폴리오 연락처와 외부 링크 공개 여부를 확인하세요.",
    riskWeight: 6
  },
  {
    id: "dribbble",
    name: "Dribbble",
    category: "CREATOR",
    country: "GLOBAL",
    urlPattern: "https://dribbble.com/{username}",
    freePreview: false,
    cleanupHint: "디자인 포트폴리오의 연락처 노출을 점검하세요.",
    riskWeight: 6
  },
  {
    id: "npm",
    name: "npm",
    category: "DEVELOPER",
    country: "GLOBAL",
    urlPattern: "https://www.npmjs.com/~{username}",
    freePreview: false,
    cleanupHint: "패키지 메타데이터와 계정 복구 정보를 확인하세요.",
    riskWeight: 7
  },
  {
    id: "gitlab",
    name: "GitLab",
    category: "DEVELOPER",
    country: "GLOBAL",
    urlPattern: "https://gitlab.com/{username}",
    freePreview: false,
    cleanupHint: "공개 프로젝트와 프로필 링크 노출을 확인하세요.",
    riskWeight: 7
  },
  {
    id: "kakao-story",
    name: "KakaoStory",
    category: "SNS",
    country: "KR",
    urlPattern: "https://story.kakao.com/{username}",
    freePreview: true,
    cleanupHint: "오래된 공개 프로필과 게시물 노출 범위를 확인하세요.",
    riskWeight: 9
  },
  {
    id: "brunch",
    name: "Brunch",
    category: "BLOG",
    country: "KR",
    urlPattern: "https://brunch.co.kr/@{username}",
    freePreview: false,
    cleanupHint: "작가 프로필의 외부 링크와 소개 문구를 점검하세요.",
    riskWeight: 5
  },
  {
    id: "dcinside",
    name: "DCInside",
    category: "COMMUNITY",
    country: "KR",
    urlPattern: "https://gallog.dcinside.com/{username}",
    freePreview: false,
    cleanupHint: "커뮤니티 프로필 공개 범위와 별명 재사용을 확인하세요.",
    riskWeight: 10
  },
  {
    id: "okky",
    name: "OKKY",
    category: "COMMUNITY",
    country: "KR",
    urlPattern: "https://okky.kr/users/{username}",
    freePreview: false,
    cleanupHint: "개발 커뮤니티 계정과 업무용 프로필 연결을 점검하세요.",
    riskWeight: 6
  },
  {
    id: "domain-com",
    name: ".com Domain",
    category: "DOMAIN",
    country: "GLOBAL",
    urlPattern: "https://{username}.com",
    freePreview: false,
    cleanupHint: "브랜드명이라면 도메인 선점 여부를 별도로 확인하세요.",
    riskWeight: 5
  }
];
