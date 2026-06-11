import type { Metadata, Viewport } from "next";
import { TossMiniApp } from "@/components/TossMiniApp";

export const metadata: Metadata = {
  title: "ID 도플갱어 | 토스 인앱",
  description: "내 아이디가 어디에 공개로 남아 있는지 토스 인앱 톤으로 확인하세요."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7F8FA"
};

export default function TossPage() {
  return <TossMiniApp />;
}
