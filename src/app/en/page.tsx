import type { Metadata } from "next";
import { ScanExperience } from "@/components/ScanExperience";

export const metadata: Metadata = {
  title: "ID Doppelganger | Public Username Exposure Check",
  description: "Check where a public username appears and review exposure signals without identity matching.",
  alternates: {
    canonical: "/en",
    languages: {
      "ko-KR": "/",
      en: "/en"
    }
  },
  openGraph: {
    title: "ID Doppelganger",
    description: "Check public username candidates without real-name search or identity matching.",
    locale: "en_US",
    type: "website",
    url: "/en"
  }
};

export default function EnglishHomePage() {
  return <ScanExperience initialLocale="en" />;
}
