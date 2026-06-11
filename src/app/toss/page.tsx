import type { Metadata, Viewport } from "next";
import { TossMiniApp } from "@/components/TossMiniApp";

export const metadata: Metadata = {
  title: "ID 도플갱어 | 토스 인앱",
  description: "내 아이디 노출 점검과 공개 플랫폼 후보를 토스 인앱 톤으로 확인하세요."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7F8FA"
};

export default function TossPage() {
  return <TossMiniApp />;
}
