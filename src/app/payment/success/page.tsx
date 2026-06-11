import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentSuccessClient } from "@/components/PaymentResultClient";

export const metadata: Metadata = {
  title: "결제 완료 | ID 도플갱어"
};

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={null}>
      <PaymentSuccessClient />
    </Suspense>
  );
}
