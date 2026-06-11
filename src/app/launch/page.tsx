import type { Metadata } from "next";
import { LaunchConsole } from "@/components/LaunchConsole";

export const metadata: Metadata = {
  title: "출시 콘솔 | ID 도플갱어",
  description: "ID 도플갱어 로컬 운영자 출시 콘솔",
  robots: {
    index: false,
    follow: false
  }
};

export default function LaunchPage() {
  return <LaunchConsole />;
}
