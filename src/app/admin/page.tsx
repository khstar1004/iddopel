import type { Metadata } from "next";
import { AdminConsole } from "@/components/AdminConsole";

export const metadata: Metadata = {
  title: "관리자 | ID 도플갱어",
  description: "ID 도플갱어 베타 운영 설정"
};

export default function AdminPage() {
  return <AdminConsole />;
}
