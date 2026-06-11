import type { Metadata } from "next";
import { ScanExperience } from "@/components/ScanExperience";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    languages: {
      "ko-KR": "/",
      en: "/en"
    }
  }
};

export default function HomePage() {
  return <ScanExperience />;
}
