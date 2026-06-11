import type { Metadata } from "next";
import { ReportPageClient } from "@/components/ReportPageClient";

export const metadata: Metadata = {
  title: "정밀 리포트 | ID 도플갱어"
};

export default function ReportPage() {
  return <ReportPageClient />;
}
