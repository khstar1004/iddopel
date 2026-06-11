import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentFailClient } from "@/components/PaymentResultClient";

export const metadata: Metadata = {
  title: "결제 실패 | ID 도플갱어"
};

export default function PaymentFailPage() {
  return (
    <Suspense fallback={null}>
      <PaymentFailClient />
    </Suspense>
  );
}
