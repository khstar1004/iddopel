"use client";

import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandIcon } from "./BrandIcon";
import {
  isMonthlyMonitoringPayment,
  registerPaidMonitoringFromPayment,
  type PaymentAccessResponse
} from "./paid-monitoring-client";

interface PublicOrder {
  orderId: string;
  scanId: string;
  productId: "DETAILED_REPORT" | "MONTHLY_MONITORING";
  amount: number;
  currency: "KRW";
  orderName: string;
  provider: "MOCK" | "TOSS" | "POLAR";
  status: "READY" | "PAID" | "FAILED" | "CANCELED";
  checkoutUrl: string | null;
  createdAt: string;
  paidAt: string | null;
}

export function CheckoutClient() {
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    fetch(`/api/orders/${params.orderId}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error?.message ?? "주문을 불러오지 못했어요.");
        setOrder(body as PublicOrder);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "주문을 불러오지 못했어요."));
  }, [params.orderId]);

  async function payWithMock() {
    if (!order) return;
    setIsPaying(true);
    setError(null);

    try {
      const response = await fetch("/api/payments/mock/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId })
      });
      const body = (await response.json()) as PaymentAccessResponse & { error?: { message?: string } };
      if (!response.ok) throw new Error(body?.error?.message ?? "테스트 결제를 완료하지 못했어요.");
      if (isMonthlyMonitoringPayment(body)) {
        await registerPaidMonitoringFromPayment(body);
        window.location.href = "/#monitoring-status-title";
        return;
      }
      if (!body.reportUrl) throw new Error("결제 리포트 주소가 응답에 없어요.");
      window.location.href = body.reportUrl;
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "테스트 결제를 완료하지 못했어요.");
    } finally {
      setIsPaying(false);
    }
  }

  if (error) {
    return <CheckoutShell title="결제를 준비하지 못했어요" description={error} />;
  }

  if (!order) {
    return <CheckoutShell title="주문을 불러오고 있어요" description="정밀 리포트 결제 정보를 확인하고 있어요." loading />;
  }

  const copy =
    order.productId === "MONTHLY_MONITORING"
      ? {
          title: "월간 모니터링 결제",
          description: "월 1회 자동 재점검, 새 흔적 알림, 아이디 3개 모니터링을 시작해요.",
          cta: "결제하고 월간 모니터링 시작",
          loading: "월간 모니터링을 등록하고 있어요."
        }
      : {
          title: "정밀 리포트 결제",
          description: "전체 URL, 위험도 분석, 조치 가이드, HTML 리포트를 이용할 수 있어요.",
          cta: "결제하고 전체 리포트 보기",
          loading: "승인하고 있어요"
        };

  return (
    <CheckoutShell title={copy.title} description={copy.description}>
      <section className="toss-card" style={{ display: "grid", gap: 14 }}>
        <div>
          <span style={{ color: "#6b7684", fontSize: 13 }}>주문명</span>
          <strong style={{ display: "block", marginTop: 4 }}>{order.orderName}</strong>
        </div>
        <div>
          <span style={{ color: "#6b7684", fontSize: 13 }}>결제 금액</span>
          <strong style={{ display: "block", marginTop: 4, fontSize: 28 }}>{order.amount.toLocaleString("ko-KR")}원</strong>
        </div>
        {order.provider === "TOSS" || order.provider === "POLAR" ? (
          <a className="toss-button" href={order.checkoutUrl ?? "#"} style={{ textDecoration: "none" }}>
            <ExternalLink size={18} aria-hidden />
            {copy.cta}
          </a>
        ) : (
          <button className="toss-button" type="button" onClick={payWithMock} disabled={isPaying}>
            {isPaying ? <Loader2 size={18} aria-hidden /> : <CreditCard size={18} aria-hidden />}
            {isPaying ? copy.loading : "테스트 결제 승인"}
          </button>
        )}
        <p style={{ color: "#6b7684", fontSize: 13, lineHeight: 1.55, margin: 0 }}>
          실제 결제 환경에서는 결제 완료 후 선택한 상품 권한이 자동으로 적용돼요.
        </p>
      </section>
    </CheckoutShell>
  );
}

function CheckoutShell({
  title,
  description,
  loading = false,
  children
}: {
  title: string;
  description: string;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <main className="toss-shell">
      <div className="toss-frame">
        <header className="brand-mark" style={{ color: "#191f28" }}>
          <BrandIcon />
          <Link href="/">ID 도플갱어</Link>
        </header>
        {loading ? (
          <div className="brand-loading" aria-hidden>
            <Loader2 size={16} />
          </div>
        ) : null}
        <h1 className="toss-title">{title}</h1>
        <p className="toss-subtitle">{description}</p>
        {children}
      </div>
    </main>
  );
}
