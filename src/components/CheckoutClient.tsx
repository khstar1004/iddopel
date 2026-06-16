"use client";

import { AlertTriangle, ArrowLeft, CreditCard, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import * as PortOne from "@portone/browser-sdk/v2";
import { BrandIcon } from "./BrandIcon";
import {
  isMonthlyMonitoringPayment,
  registerPaidMonitoringFromPayment,
  storePaidReportAccess,
  type PaymentAccessResponse
} from "./paid-monitoring-client";
import { defaultRefundPolicy, defaultServicePeriod } from "@/lib/service-policy";

interface PublicOrder {
  orderId: string;
  scanId: string;
  productId: "DETAILED_REPORT" | "MONTHLY_MONITORING";
  amount: number;
  currency: "KRW";
  orderName: string;
  provider: "MOCK" | "TOSS" | "POLAR" | "PORTONE" | "INICIS" | "APP_STORE" | "GOOGLE_PLAY";
  status: "READY" | "PAID" | "FAILED" | "CANCELED";
  checkoutUrl: string | null;
  createdAt: string;
  paidAt: string | null;
}

interface InicisPaymentRequest {
  scriptUrl: string;
  formId: string;
  fields: Record<string, string>;
}

declare global {
  interface Window {
    INIStdPay?: {
      pay: (formId: string) => void;
    };
  }
}

export function CheckoutClient() {
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [isPreparingInicis, setIsPreparingInicis] = useState(false);
  const [inicisScriptReady, setInicisScriptReady] = useState(false);
  const [inicisRequest, setInicisRequest] = useState<InicisPaymentRequest | null>(null);
  const preparedInicisOrderRef = useRef<string | null>(null);

  useEffect(() => {
    fetch(`/api/orders/${params.orderId}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error?.message ?? "주문을 불러오지 못했어요.");
        setOrder(body as PublicOrder);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "주문을 불러오지 못했어요."));
  }, [params.orderId]);

  useEffect(() => {
    if (!order || order.provider !== "INICIS" || preparedInicisOrderRef.current === order.orderId) return;

    let cancelled = false;
    preparedInicisOrderRef.current = order.orderId;
    setIsPreparingInicis(true);
    setError(null);

    fetch("/api/payments/inicis/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.orderId })
    })
      .then(async (response) => {
        const body = (await response.json()) as InicisPaymentRequest & { error?: { message?: string } };
        if (!response.ok) throw new Error(body?.error?.message ?? "KG이니시스 결제창을 준비하지 못했어요.");
        if (!body.formId || !body.fields) throw new Error("KG이니시스 결제 요청 정보가 올바르지 않아요.");
        if (!cancelled) setInicisRequest(body);
      })
      .catch((paymentError) => {
        if (cancelled) return;
        preparedInicisOrderRef.current = null;
        setError(paymentError instanceof Error ? paymentError.message : "KG이니시스 결제창을 준비하지 못했어요.");
      })
      .finally(() => {
        if (!cancelled) setIsPreparingInicis(false);
      });

    return () => {
      cancelled = true;
    };
  }, [order]);

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
      storePaidReportAccess(body);
      window.location.href = body.reportUrl;
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "테스트 결제를 완료하지 못했어요.");
    } finally {
      setIsPaying(false);
    }
  }

  async function payWithPortOne() {
    if (!order) return;
    setIsPaying(true);
    setError(null);

    try {
      const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
      const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
      if (!storeId || !channelKey) {
        throw new Error("PortOne Store ID 또는 Channel Key가 설정되어 있지 않아요.");
      }

      const response = await PortOne.requestPayment({
        storeId,
        channelKey,
        paymentId: order.orderId,
        orderName: order.orderName,
        totalAmount: order.amount,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        redirectUrl: `${window.location.origin}/payment/success?provider=portone&orderId=${encodeURIComponent(order.orderId)}`,
        forceRedirect: false
      });

      if (response?.code) {
        throw new Error(response.message ?? "결제가 완료되지 않았어요.");
      }

      const paymentId = response?.paymentId ?? order.orderId;
      const confirmResponse = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "portone", orderId: order.orderId, paymentId })
      });
      const body = (await confirmResponse.json()) as PaymentAccessResponse & { error?: { message?: string } };
      if (!confirmResponse.ok) throw new Error(body?.error?.message ?? "결제 완료 정보를 확인하지 못했어요.");
      if (isMonthlyMonitoringPayment(body)) {
        await registerPaidMonitoringFromPayment(body);
        window.location.href = "/#monitoring-status-title";
        return;
      }
      if (!body.reportUrl) throw new Error("결제 리포트 주소가 응답에 없어요.");
      storePaidReportAccess(body);
      window.location.href = body.reportUrl;
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "PortOne 결제를 완료하지 못했어요.");
    } finally {
      setIsPaying(false);
    }
  }

  function payWithInicis() {
    if (!order) return;
    setError(null);

    try {
      if (!inicisRequest) throw new Error("KG이니시스 결제창이 아직 준비 중이에요. 잠시 후 다시 눌러 주세요.");
      if (!inicisScriptReady || !window.INIStdPay) throw new Error("KG이니시스 결제창 스크립트를 불러오지 못했어요.");
      setIsPaying(true);
      window.INIStdPay.pay(inicisRequest.formId);
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "KG이니시스 결제창을 준비하지 못했어요.");
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
  const readiness = getCheckoutReadiness(order);
  const hostedCheckout = isHostedCheckoutProvider(order.provider);
  const mockCheckout = order.provider === "MOCK";
  const portOneCheckout = order.provider === "PORTONE";
  const inicisCheckout = order.provider === "INICIS";
  const canOpenHostedCheckout = hostedCheckout && Boolean(order.checkoutUrl);
  const inicisReadyToOpen = inicisCheckout && inicisScriptReady && Boolean(inicisRequest) && !isPreparingInicis;

  return (
    <CheckoutShell title={copy.title} description={copy.description}>
      {inicisCheckout ? (
        <Script
          src="https://stdpay.inicis.com/stdjs/INIStdPay.js"
          strategy="afterInteractive"
          onLoad={() => setInicisScriptReady(true)}
          onError={() => setError("KG이니시스 결제창 스크립트를 불러오지 못했어요.")}
        />
      ) : null}
      {inicisCheckout && inicisRequest ? (
        <form id={inicisRequest.formId} method="POST" acceptCharset="UTF-8" style={{ display: "none" }}>
          {Object.entries(inicisRequest.fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} readOnly />
          ))}
        </form>
      ) : null}
      <section className="toss-card" style={{ display: "grid", gap: 14 }}>
        <div>
          <span style={{ color: "#6b7684", fontSize: 13 }}>주문명</span>
          <strong style={{ display: "block", marginTop: 4 }}>{order.orderName}</strong>
        </div>
        <div>
          <span style={{ color: "#6b7684", fontSize: 13 }}>결제 금액</span>
          <strong style={{ display: "block", marginTop: 4, fontSize: 28 }}>{order.amount.toLocaleString("ko-KR")}원</strong>
        </div>
        <div className="checkout-readiness-panel" data-status={readiness.status}>
          {readiness.status === "ready" ? <ShieldCheck size={18} aria-hidden /> : <AlertTriangle size={18} aria-hidden />}
          <div>
            <strong>{readiness.title}</strong>
            <p>{readiness.description}</p>
          </div>
        </div>
        <div className="checkout-policy-grid" aria-label="무료와 유료 제공 기준">
          <div>
            <span>무료</span>
            <strong>상위 5개 링크</strong>
            <p>무료 화면에서 보이는 링크는 결제 없이 직접 열 수 있어요.</p>
          </div>
          <div>
            <span>정밀 리포트</span>
            <strong>전체 URL + 조치 가이드</strong>
            <p>잠긴 후보, 위험도, HTML/PDF 저장용 자료가 열려요.</p>
          </div>
          <div>
            <span>월간 추적</span>
            <strong>대시보드 기반</strong>
            <p>현재는 메일 발송이 아니라 월 1회 재점검 결과를 화면에서 확인해요.</p>
          </div>
          <div>
            <span>제공기간</span>
            <strong>결제 즉시, 30일</strong>
            <p>{defaultServicePeriod}</p>
          </div>
          <div>
            <span>취소/환불</span>
            <strong>미사용 7일 이내</strong>
            <p>{defaultRefundPolicy}</p>
          </div>
        </div>
        {inicisCheckout ? (
          <button className="toss-button" type="button" onClick={payWithInicis} disabled={isPaying || !inicisReadyToOpen}>
            {isPaying ? <Loader2 size={18} aria-hidden /> : <CreditCard size={18} aria-hidden />}
            {isPaying
              ? "KG이니시스 결제창을 열고 있어요."
              : !inicisRequest || isPreparingInicis
                ? "KG이니시스 결제창 준비 중"
                : !inicisScriptReady
                  ? "KG이니시스 스크립트 로딩 중"
                  : "KG이니시스 결제창 열기"}
          </button>
        ) : portOneCheckout ? (
          <button className="toss-button" type="button" onClick={payWithPortOne} disabled={isPaying}>
            {isPaying ? <Loader2 size={18} aria-hidden /> : <CreditCard size={18} aria-hidden />}
            {isPaying ? copy.loading : copy.cta}
          </button>
        ) : hostedCheckout ? (
          <div className="checkout-action-stack">
            {canOpenHostedCheckout ? (
              <a className="toss-button" href={order.checkoutUrl ?? "#"} style={{ textDecoration: "none" }}>
                <ExternalLink size={18} aria-hidden />
                {copy.cta}
              </a>
            ) : (
              <button className="toss-button" type="button" disabled>
                <AlertTriangle size={18} aria-hidden />
                결제창 준비 안 됨
              </button>
            )}
            <p>결제창에서 테스트 모드나 결제 불가 문구가 보이면 실제 결제는 진행되지 않아요.</p>
          </div>
        ) : mockCheckout ? (
          <button className="toss-button" type="button" onClick={payWithMock} disabled={isPaying}>
            {isPaying ? <Loader2 size={18} aria-hidden /> : <CreditCard size={18} aria-hidden />}
            {isPaying ? copy.loading : "테스트 결제 승인"}
          </button>
        ) : (
          <button className="toss-button" type="button" disabled>
            <AlertTriangle size={18} aria-hidden />
            앱 결제에서 처리
          </button>
        )}
        <p style={{ color: "#6b7684", fontSize: 13, lineHeight: 1.55, margin: 0 }}>
          실제 결제 환경에서는 결제 완료 후 선택한 상품 권한이 자동으로 적용돼요.
        </p>
        <Link className="checkout-secondary-link" href="/">
          <ArrowLeft size={15} aria-hidden />
          점검 화면으로 돌아가기
        </Link>
      </section>
    </CheckoutShell>
  );
}

function isHostedCheckoutProvider(provider: PublicOrder["provider"]) {
  return provider === "TOSS" || provider === "POLAR";
}

function getCheckoutReadiness(order: PublicOrder) {
  if (order.status === "PAID") {
    return {
      status: "ready",
      title: "이미 결제 완료된 주문",
      description: "권한이 적용된 주문이에요. 결제 결과 화면에서 리포트로 이동할 수 있어요."
    };
  }

  if (isHostedCheckoutProvider(order.provider) && !order.checkoutUrl) {
    return {
      status: "blocked",
      title: "결제창 주소가 아직 없어요",
      description: "운영 결제 키나 상품 ID가 준비되지 않으면 사용자에게 결제 버튼을 열지 않습니다."
    };
  }

  if (order.provider === "MOCK") {
    return {
      status: "test",
      title: "테스트 결제 모드",
      description: "로컬/E2E 확인용 주문이에요. 실제 카드 결제처럼 사용자에게 노출하면 안 됩니다."
    };
  }

  if (order.provider === "APP_STORE" || order.provider === "GOOGLE_PLAY") {
    return {
      status: "blocked",
      title: "웹 결제 대상 주문이 아니에요",
      description: "앱 스토어 결제는 네이티브 앱의 인앱 구매 승인과 영수증 검증에서 처리해야 해요."
    };
  }

  return {
    status: "ready",
    title: `${providerLabel(order.provider)} 결제 준비됨`,
    description: "외부 결제창에서 금액과 상품명을 다시 확인한 뒤 결제를 진행해요."
  };
}

function providerLabel(provider: PublicOrder["provider"]) {
  if (provider === "TOSS") return "Toss";
  if (provider === "POLAR") return "Polar";
  if (provider === "PORTONE") return "PortOne";
  if (provider === "INICIS") return "KG이니시스";
  if (provider === "APP_STORE") return "App Store";
  if (provider === "GOOGLE_PLAY") return "Google Play";
  return "Mock";
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
