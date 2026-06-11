import type { Metadata } from "next";
import { CheckoutClient } from "@/components/CheckoutClient";

export const metadata: Metadata = {
  title: "정밀 리포트 결제 | ID 도플갱어"
};

export default function CheckoutPage() {
  return <CheckoutClient />;
}
