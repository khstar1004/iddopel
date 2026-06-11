import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "이용약관 | ID 도플갱어"
};

export default function TermsPage() {
  return (
    <PolicyPage title="이용약관">
      <section>
        <h2>1. 서비스 목적</h2>
        <p>
          ID 도플갱어는 사용자가 입력한 아이디 문자열의 공개 계정 후보를 먼저 보여주고 참고 점수와 정리 가이드를 제공하는
          아이디 보안·브랜드 점검 서비스입니다. 결과는 동일인 여부를 의미하지 않습니다.
        </p>
      </section>
      <section>
        <h2>2. 금지 행위</h2>
        <p>
          특정인 추적, 괴롭힘, 스토킹, 신상털이, 실명·전화번호·이메일 검색, 자동화 대량 검색, 결과의 동일인 단정,
          제3자 권리 침해 목적으로 서비스를 이용할 수 없습니다.
        </p>
      </section>
      <section>
        <h2>3. 결과의 성격</h2>
        <p>
          검색 결과는 공개 URL 패턴과 공개 계정 후보에 기반한 참고 정보입니다. 플랫폼 정책 변경, 접근 제한, 네트워크 상태에
          따라 누락 또는 오탐이 있을 수 있습니다.
        </p>
      </section>
      <section>
        <h2>4. 유료 리포트</h2>
        <p>
          유료 리포트는 전체 결과, 위험도 분석, 정리 가이드, 다운로드 기능을 제공합니다. 결제, 환불, 구독 조건은 결제 화면에
          표시되는 정책을 따릅니다.
        </p>
      </section>
      <section>
        <h2>5. 책임 제한</h2>
        <p>
          서비스는 공개 정보 점검 도구이며 법률, 보안 사고 대응, 플랫폼 신고 결과를 보장하지 않습니다. 중요한 조치는 각 플랫폼
          공식 절차와 전문가 검토를 병행해야 합니다.
        </p>
      </section>
    </PolicyPage>
  );
}
