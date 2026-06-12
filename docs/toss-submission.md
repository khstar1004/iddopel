# Toss In-App Submission Draft

## Service Name
ID 도플갱어

## Positioning
내 아이디 노출 점검과 공개 흔적 확인. 토스 인앱에서는 보안 점검 톤으로 표현한다.

## Home Copy
내 아이디, 어디에 남아 있을까?

발견된 공개 흔적을 먼저 보고 방치 계정과 사칭 가능성은 아래에서 확인해요.

## Primary CTA
내 아이디 흔적 찾기

## Purpose Selection
- 내 아이디 점검
- 브랜드/활동명 점검
- 새 닉네임 겹침 확인

## Required Policy Links
- 개인정보처리방침: `/privacy`
- 이용약관: `/terms`
- 책임 있는 사용 정책: `/responsible-use`

## Safety Copy
실명, 전화번호, 이메일 검색은 지원하지 않아요. 입력한 아이디의 공개 사용 현황만 점검해요.

이 결과는 아이디 문자열의 공개 사용 현황이며, 발견된 계정들이 동일인이라는 뜻은 아니에요.

## Technical Notes
- WebView route: `/toss`
- Login: optional in MVP, Toss Login later
- Payment: web checkout route `/checkout/{orderId}`, using `PAYMENT_PROVIDER=toss` or `PAYMENT_PROVIDER=polar`
- API: `/api/scans`
- Cross-origin API allowlist: configure `TOSS_MINI_APP_NAME` or `TOSS_ALLOWED_ORIGINS` for `https://<appName>.apps.tossmini.com` and `https://<appName>.private-apps.tossmini.com`
- mTLS and partner API credentials must be configured after Toss console registration.

## Required Before Actual Submission
- Toss developer console app id
- Web checkout provider keys: Toss Payments client/secret/security keys when `PAYMENT_PROVIDER=toss`, or Polar access token, detailed-report product id, monthly-monitoring product id, and webhook secret when `PAYMENT_PROVIDER=polar`
- Business registration and partner review status
- Registered service terms and privacy consent text
- Production domain allowlist
- Apps in Toss console API key for AX/console release automation
- mTLS certificate setup for Toss partner APIs
- Toss review test account or review scenario

## MCP-Assisted Review Setup
Use the MCP setup before changing Toss-specific surfaces, checkout behavior, review copy, or AppsInToss release settings.

1. Install AppsInToss AX.
   - Windows: `scoop bucket add toss https://github.com/toss/scoop-bucket`, then `scoop install ax`
   - macOS/Linux: `brew tap toss/tap`, then `brew install ax`
2. Copy `.cursor/mcp.example.json` to `.cursor/mcp.json` for Cursor, or merge the same `mcpServers` block into `claude_desktop_config.json`.
3. Confirm the AppsInToss MCP server starts with `ax mcp start`.
4. Use `apps-in-toss-ax` for AppsInToss docs, TDS Web/RN docs, and mini-app examples.
5. Use `@tosspayments/integration-guide-mcp` for Toss Payments checkout/API documentation.

Expected MCP servers:

```json
{
  "mcpServers": {
    "apps-in-toss": {
      "command": "ax",
      "args": ["mcp", "start"]
    },
    "tosspayments-integration-guide": {
      "command": "npx",
      "args": ["-y", "@tosspayments/integration-guide-mcp@latest"]
    }
  }
}
```

## Verification
```bash
npm run toss:verify
TOSS_RELEASE_CHECK=true npm run toss:verify
```

Local verification checks the `/toss` route, review-safe copy, policy links, CORS allowlist implementation, checkout CSP hosts, and environment template. Release verification additionally requires the Toss console API key, console app id, mini-app name, production HTTPS `SITE_URL`, a live `PAYMENT_PROVIDER`, and review scenario values. Toss Payments live keys, `live_ck_...` and `live_sk_...`, are required only when `PAYMENT_PROVIDER=toss`; with `PAYMENT_PROVIDER=polar`, confirm the external checkout policy during Toss review.

## Sources
- App-in-Toss SDK overview: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%8B%9C%EC%9E%91%ED%95%98%EA%B8%B0/intro.html
- App-in-Toss Toss app testing and QR/private origins: https://developers-apps-in-toss.toss.im/development/test/toss.html
- App-in-Toss service caution guide: https://developers-apps-in-toss.toss.im/intro/caution.html
- App-in-Toss UX writing guide: https://developers-apps-in-toss.toss.im/design/ux-writing.html
- App-in-Toss login agreement setup: https://developers-apps-in-toss.toss.im/login/intro.html
- Toss Payments payment window integration: https://docs.tosspayments.com/guides/v2/payment-window/integration
- AppsInToss AX MCP: https://github.com/toss/apps-in-toss-ax
- Toss Payments integration guide MCP: https://www.npmjs.com/package/@tosspayments/integration-guide-mcp
