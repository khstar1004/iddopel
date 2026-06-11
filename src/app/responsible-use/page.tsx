import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "책임 있는 사용 | ID 도플갱어"
};

export default function ResponsibleUsePage() {
  return (
    <PolicyPage title="책임 있는 사용 정책">
      <section>
        <h2>지원하는 사용</h2>
        <p>
          본인 아이디 노출 점검, 브랜드명·활동명 선점 확인, 새 닉네임 겹침 확인, 방치 계정 정리, 사칭 계정 모니터링을
          지원합니다.
        </p>
      </section>
      <section>
        <h2>지원하지 않는 사용</h2>
        <p>
          실명 검색, 전화번호 검색, 이메일 검색, 위치·직장·학교 추정, 프로필 사진 수집, 게시글 내용 수집/요약, 동일인 확률
          계산, 전 연인·지인 추적 목적의 사용은 지원하지 않습니다.
        </p>
      </section>
      <section>
        <h2>고정 고지</h2>
        <p>
          이 결과는 아이디 문자열의 공개 사용 현황이며, 발견된 계정들이 동일인이라는 뜻은 아니에요.
        </p>
      </section>
      <section>
        <h2>삭제와 신고</h2>
        <p>
          사용자는 검색 기록과 리포트 삭제를 요청할 수 있습니다. 서비스 악용, 권리 침해, 노출 신고는 고객지원 채널로 접수하며
          확인 후 제한 또는 삭제 조치를 진행합니다.
        </p>
      </section>
    </PolicyPage>
  );
}
