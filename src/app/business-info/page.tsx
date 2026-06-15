import type { Metadata } from "next";
import { BusinessInfo } from "@/components/BusinessInfo";
import { PolicyPage } from "@/components/PolicyPage";
import { businessInfo } from "@/lib/business-info";

export const metadata: Metadata = {
  title: "사업자 정보 | ID 도플갱어",
  robots: {
    index: false,
    follow: false
  }
};

export default function BusinessInfoPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: businessInfo.serviceName,
    legalName: businessInfo.legalName,
    taxID: businessInfo.businessRegistrationNumber,
    email: businessInfo.supportEmail,
    telephone: businessInfo.phone,
    founder: {
      "@type": "Person",
      name: businessInfo.representative
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: businessInfo.address,
      addressCountry: "KR"
    }
  };

  return (
    <PolicyPage title="사업자 정보">
      <section>
        <h2>운영자 정보</h2>
        <BusinessInfo />
      </section>
      <section>
        <h2>서비스 제공 방식</h2>
        <p>{businessInfo.serviceDelivery}</p>
      </section>
      <section>
        <h2>서비스 제공기간</h2>
        <p>{businessInfo.servicePeriod}</p>
      </section>
      <section>
        <h2>취소/환불 규정</h2>
        <p>{businessInfo.refundPolicy}</p>
      </section>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </PolicyPage>
  );
}
