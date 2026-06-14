import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { ClientTelemetry } from "@/components/ClientTelemetry";
import "./globals.css";

const siteUrl = normalizeOrigin(process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "https://YOUR_PRODUCTION_DOMAIN");
const adsensePublisherId = "ca-pub-5490654987125120";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ID 도플갱어 | 내 아이디 흔적 점검",
  description: "자주 쓰는 아이디가 어디에 공개로 남아 있는지 빠르게 확인하세요.",
  applicationName: "ID 도플갱어",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/id-doppelganger-mark.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  openGraph: {
    title: "ID 도플갱어",
    description: "내 아이디가 어디에 공개로 남아 있는지 바로 확인하세요.",
    type: "website",
    locale: "ko_KR",
    url: siteUrl
  },
  other: {
    "google-adsense-account": adsensePublisherId
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090A0F"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jsonLd = buildJsonLd(siteUrl);

  return (
    <html lang="ko">
      <body>
        {children}
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsensePublisherId}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <ClientTelemetry />
      </body>
    </html>
  );
}

function buildJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: "ID 도플갱어",
        url: origin,
        logo: `${origin}/brand/id-doppelganger-mark.png`
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: "ID 도플갱어",
        url: origin,
        inLanguage: "ko-KR",
        publisher: { "@id": `${origin}/#organization` }
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${origin}/#software`,
        name: "ID 도플갱어",
        url: origin,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Web, Android, iOS",
        inLanguage: "ko-KR",
        description: "아이디 문자열이 공개 플랫폼 어디에 남아 있는지 빠르게 확인하는 한국어 서비스입니다.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "KRW",
          description: "무료 요약 점검을 제공하며 정밀 리포트는 별도 결제로 제공됩니다."
        },
        publisher: { "@id": `${origin}/#organization` }
      }
    ]
  };
}

function normalizeOrigin(value: string) {
  if (!value) return "https://YOUR_PRODUCTION_DOMAIN";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value.replace(/\/$/, "");
  }
  return `https://${value.replace(/\/$/, "")}`;
}
