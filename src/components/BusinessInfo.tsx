import { businessInfo } from "@/lib/business-info";

export function BusinessInfo({ compact = false }: { compact?: boolean }) {
  return (
    <address className={compact ? "business-info business-info-compact" : "business-info"}>
      <span>
        <strong>상호</strong> {businessInfo.legalName}
      </span>
      <span>
        <strong>대표자명</strong> {businessInfo.representative}
      </span>
      <span>
        <strong>사업자등록번호</strong> {businessInfo.businessRegistrationNumber}
      </span>
      <span>
        <strong>주소</strong> {businessInfo.address}
      </span>
      <span>
        <strong>전화번호</strong> {businessInfo.phone}
      </span>
      <span>
        <strong>고객센터</strong>{" "}
        <a href={`mailto:${businessInfo.supportEmail}`}>{businessInfo.supportEmail}</a>
      </span>
    </address>
  );
}
