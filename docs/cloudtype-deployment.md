# Cloudtype Deployment Notes

이 프로젝트를 Cloudtype 무료 플랜으로 시작할 때의 권장 구조입니다.

## 결론

- 웹/API: 가능. Maigret 런타임이 필요하므로 Cloudtype `Dockerfile` 템플릿으로 배포합니다.
- DB: 가능. Cloudtype PostgreSQL 서비스를 같은 프로젝트/배포환경에 만들고 앱 서비스의 `DATABASE_URL`에 내부 호스트명 기반 접속 문자열을 넣습니다.
- iOS/Android 앱: Cloudtype에 앱 파일을 올리는 방식이 아닙니다. Cloudtype에는 백엔드 웹/API만 올리고, App Store / Google Play 앱은 `MOBILE_APP_ORIGIN`을 Cloudtype HTTPS 도메인으로 설정해서 빌드/제출합니다.
- 무료 플랜: 초기 테스트와 소프트런칭에는 가능하지만, Cloudtype PostgreSQL은 동적 확장/자동 백업을 제공하는 매니지드 DB가 아니므로 실제 유료 사용자 데이터가 생기기 전 백업 절차나 외부 managed Postgres 이전 계획이 필요합니다.

## Cloudtype 서비스 구성

1. PostgreSQL 서비스
   - Cloudtype 대시보드에서 PostgreSQL 템플릿을 생성합니다.
   - 서비스 이름을 예: `id-doppelganger-db`로 둡니다.
   - 내부 통신용 호스트는 서비스 이름, 포트는 `5432`를 사용합니다.
   - 앱 환경변수 예:

```env
DATABASE_URL=postgres://id_doppelganger:YOUR_PASSWORD@id-doppelganger-db:5432/id_doppelganger
DATABASE_SSL=false
```

2. Web/API 서비스
   - Cloudtype `Dockerfile` 템플릿을 사용합니다.
   - Dockerfile 경로: `Dockerfile`
   - 포트: `3000`
   - 빌드 후 시작 명령은 Dockerfile의 `CMD`를 사용합니다.
   - 최소 리소스로 시작하되 Maigret 스캔은 외부 사이트를 많이 확인하므로, 타임아웃이 잦으면 메모리/CPU를 올리거나 `MAIGRET_TOP_SITES_QUICK` 값을 낮춥니다.

## 필수 환경변수

Cloudtype 앱 서비스에 아래 값을 설정합니다.

```env
NODE_ENV=production
SITE_URL=https://YOUR_CLOUDTYPE_OR_CUSTOM_DOMAIN
PRODUCTION_BASE_URL=https://YOUR_CLOUDTYPE_OR_CUSTOM_DOMAIN
SMOKE_BASE_URL=https://YOUR_CLOUDTYPE_OR_CUSTOM_DOMAIN

DATABASE_URL=postgres://id_doppelganger:YOUR_PASSWORD@id-doppelganger-db:5432/id_doppelganger
DATABASE_SSL=false
CRON_SECRET=YOUR_32_PLUS_CHARACTER_RANDOM_SECRET
REPORT_TOKEN_SECRET=YOUR_32_PLUS_CHARACTER_RANDOM_REPORT_TOKEN_SECRET
FIRST_FREE_FINGERPRINT_SECRET=YOUR_32_PLUS_CHARACTER_RANDOM_FINGERPRINT_SECRET

SCAN_PROVIDER=maigret
MAIGRET_BIN=maigret
MAIGRET_TOP_SITES_QUICK=35
MAIGRET_TOP_SITES_DEEP=150
MAIGRET_DEEP_ALL=false
MAIGRET_SITE_TIMEOUT_SECONDS=6
MAIGRET_RETRIES=1
MAIGRET_PROCESS_TIMEOUT_MS=58000
MAIGRET_MAX_CONNECTIONS=20
MAIGRET_PRIORITY_SITES=Instagram,Twitter,Threads,TikTok,YouTube,Facebook,LinkedIn,Naver,GitHub,GitHubGist,Reddit
MAIGRET_BOOST_TAGS=kr:30,social:35,photo:16,video:16,blog:20,coding:20,music:10,design:10,streaming:8,messaging:8
MAIGRET_EXCLUDED_SITES=Geeksfor Geeks
MAIGRET_SITE_CAP_QUICK=155
MAIGRET_SITE_CAP_DEEP=260
# Optional when cloud/datacenter IPs miss large SNS results:
# MAIGRET_PROXY_URL=http://user:pass@residential-proxy:port

PAYMENT_PROVIDER=toss
ENABLE_MOCK_PAYMENTS=false
WEB_DETAILED_REPORT_PAYWALL_ENABLED=true
MONITORING_PAYWALL_ENABLED=true
TOSS_CLIENT_KEY=YOUR_TOSS_LIVE_CLIENT_KEY
TOSS_SECRET_KEY=YOUR_TOSS_LIVE_SECRET_KEY
TOSS_SECURITY_KEY=YOUR_TOSS_SECURITY_KEY
POLAR_ACCESS_TOKEN=YOUR_POLAR_ACCESS_TOKEN
POLAR_PRODUCT_ID=YOUR_POLAR_PRODUCT_ID
POLAR_MONTHLY_MONITORING_PRODUCT_ID=YOUR_POLAR_MONTHLY_MONITORING_PRODUCT_ID
POLAR_WEBHOOK_SECRET=YOUR_POLAR_WEBHOOK_SECRET
POLAR_SERVER=production
TOSS_CONSOLE_API_KEY=YOUR_TOSS_CONSOLE_API_KEY
TOSS_CONSOLE_APP_ID=YOUR_TOSS_CONSOLE_APP_ID
TOSS_MINI_APP_NAME=YOUR_TOSS_MINI_APP_NAME
TOSS_ALLOWED_ORIGINS=https://YOUR_TOSS_APP_NAME.apps.tossmini.com,https://YOUR_TOSS_APP_NAME.private-apps.tossmini.com

ALERT_WEBHOOK_URL=https://YOUR_ALERT_WEBHOOK
ALERT_WEBHOOK_PROVIDER=slack
ALERT_WEBHOOK_TIMEOUT_MS=1500
ALERT_RUNBOOK_URL=https://YOUR_CLOUDTYPE_OR_CUSTOM_DOMAIN/responsible-use

STORE_PRODUCTION_ORIGIN=https://YOUR_CLOUDTYPE_OR_CUSTOM_DOMAIN
STORE_SUPPORT_EMAIL=support@YOUR_DOMAIN
MOBILE_APP_ORIGIN=https://YOUR_CLOUDTYPE_OR_CUSTOM_DOMAIN
MOBILE_PAYMENTS_ENABLED=true

APPLE_BUNDLE_ID=com.iddoppelganger.app
APPLE_DETAILED_REPORT_PRODUCT_ID=detailed_report
APPLE_ENVIRONMENT=production
APPLE_KEY_ID=YOUR_APPLE_KEY_ID
APPLE_ISSUER_ID=YOUR_APPLE_ISSUER_ID
APPLE_PRIVATE_KEY=YOUR_APP_STORE_CONNECT_PRIVATE_KEY_P8
APPLE_APP_APPLE_ID=YOUR_APP_APPLE_ID
GOOGLE_PLAY_PACKAGE_NAME=com.iddoppelganger.app
GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID=detailed_report
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=YOUR_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
GOOGLE_PLAY_UPLOAD_KEYSTORE_BASE64=YOUR_GOOGLE_PLAY_UPLOAD_KEYSTORE_BASE64
GOOGLE_PLAY_UPLOAD_KEYSTORE_PASSWORD=YOUR_GOOGLE_PLAY_UPLOAD_KEYSTORE_PASSWORD
GOOGLE_PLAY_UPLOAD_KEY_ALIAS=upload
GOOGLE_PLAY_UPLOAD_KEY_PASSWORD=YOUR_GOOGLE_PLAY_UPLOAD_KEY_PASSWORD
```

## 배포 전 로컬 검증

```bash
npm run release:local
```

Cloudtype 환경변수를 채운 뒤에는 로컬에서 같은 값으로 production preparation을 먼저 검증합니다.

```bash
PREPARE_RELEASE_DRY_RUN=true npm run release:prepare
```

## Cloudtype 배포 후 검증

```bash
PRODUCTION_BASE_URL="https://YOUR_CLOUDTYPE_OR_CUSTOM_DOMAIN" npm run verify:production
SMOKE_BASE_URL="https://YOUR_CLOUDTYPE_OR_CUSTOM_DOMAIN" SMOKE_CONFIRM_PAYMENT=skip npm run smoke:release
TOSS_RELEASE_CHECK=true SITE_URL="https://YOUR_CLOUDTYPE_OR_CUSTOM_DOMAIN" npm run toss:verify
STORE_RELEASE_CHECK=true STORE_PRODUCTION_ORIGIN="https://YOUR_CLOUDTYPE_OR_CUSTOM_DOMAIN" npm run store:verify
MOBILE_RELEASE_CHECK=true MOBILE_APP_ORIGIN="https://YOUR_CLOUDTYPE_OR_CUSTOM_DOMAIN" MOBILE_PAYMENTS_ENABLED=true npm run mobile:verify
```

## 앱 출시 흐름

1. Cloudtype 웹/API URL을 확정합니다.
2. `MOBILE_APP_ORIGIN`을 그 URL로 설정합니다.
3. `npm run mobile:configure`로 native shell 설정을 갱신합니다.
4. App Store Connect와 Google Play Console에서 `detailed_report` 상품을 생성합니다.
5. `npm run android:bundle` 및 iOS archive를 생성합니다.
6. Fastlane 또는 각 콘솔에서 심사 제출합니다.

Cloudtype은 백엔드 실행과 DB 호스팅까지 담당하고, 네이티브 앱의 서명/심사/스토어 배포는 App Store Connect, Google Play Console, Fastlane/GitHub Actions 쪽에서 처리합니다.

## 운영 주의점

- Cloudtype PostgreSQL은 편하지만 자동 백업/동적 확장을 전제로 한 managed DB가 아닙니다. 운영 첫날부터 최소 1일 1회 `pg_dump` 백업을 잡거나 외부 managed Postgres로 이전할 시점을 정합니다.
- 무료 플랜에서는 Maigret의 동시 스캔을 크게 늘리지 않습니다. 초기값은 `MAIGRET_TOP_SITES_QUICK=35`, 태그 부스트 cap `MAIGRET_SITE_CAP_QUICK=155`, 앱 replica 1개로 시작합니다. 타임아웃이 잦으면 `MAIGRET_BOOST_TAGS` limit 또는 `MAIGRET_SITE_CAP_QUICK`을 먼저 낮춥니다.
- 무료 도메인으로 시작해도 스토어 심사 전에는 가능하면 커스텀 도메인을 붙입니다. 정책 URL, 개인정보처리방침 URL, 앱 내 API origin이 모두 같은 최종 도메인을 바라보게 해야 합니다.
