"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  isMonthlyMonitoringPayment,
  registerPaidMonitoringFromPayment,
  storePaidReportAccess,
  type PaymentAccessResponse
} from "./paid-monitoring-client";

export function PaymentSuccessClient() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("결제를 승인하고 있어요.");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const provider = searchParams.get("provider");
    if (provider === "polar") {
      const checkoutId = searchParams.get("checkout_id");
      const orderId = searchParams.get("orderId");

      fetch("/api/payments/polar/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutId, orderId })
      })
        .then(async (response) => {
          const body = (await response.json()) as PaymentAccessResponse & { error?: { message?: string } };
          if (!response.ok) throw new Error(body?.error?.message ?? "결제 완료 정보를 확인하지 못했어요.");

          if (isMonthlyMonitoringPayment(body)) {
            setMessage("월간 모니터링을 등록하고 있어요.");
            await registerPaidMonitoringFromPayment(body);
            setMessage("월간 모니터링으로 이동하고 있어요.");
            window.location.href = "/#monitoring-status-title";
            return;
          }

          if (!body.reportUrl) throw new Error("결제 리포트 주소가 응답에 없어요.");
          storePaidReportAccess(body);
          setMessage("정밀 리포트로 이동하고 있어요.");
          window.location.href = body.reportUrl;
        })
        .catch((confirmError) => {
          setError(confirmError instanceof Error ? confirmError.message : "결제 완료 정보를 확인하지 못했어요.");
        });
      return;
    }

    if (provider === "portone") {
      const paymentId = searchParams.get("paymentId");
      const orderId = searchParams.get("orderId");

      fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "portone", paymentId, orderId })
      })
        .then(async (response) => {
          const body = (await response.json()) as PaymentAccessResponse & { error?: { message?: string } };
          if (!response.ok) throw new Error(body?.error?.message ?? "결제 완료 정보를 확인하지 못했어요.");

          if (isMonthlyMonitoringPayment(body)) {
            setMessage("월간 모니터링을 등록하고 있어요.");
            await registerPaidMonitoringFromPayment(body);
            setMessage("월간 모니터링으로 이동하고 있어요.");
            window.location.href = "/#monitoring-status-title";
            return;
          }

          if (!body.reportUrl) throw new Error("결제 리포트 주소가 응답에 없어요.");
          storePaidReportAccess(body);
          setMessage("정밀 리포트로 이동하고 있어요.");
          window.location.href = body.reportUrl;
        })
        .catch((confirmError) => {
          setError(confirmError instanceof Error ? confirmError.message : "결제 완료 정보를 확인하지 못했어요.");
        });
      return;
    }

    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");

    fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) })
    })
      .then(async (response) => {
        const body = (await response.json()) as PaymentAccessResponse & { error?: { message?: string } };
        if (!response.ok) throw new Error(body?.error?.message ?? "결제 승인을 완료하지 못했어요.");

        if (isMonthlyMonitoringPayment(body)) {
          setMessage("월간 모니터링을 등록하고 있어요.");
          await registerPaidMonitoringFromPayment(body);
          setMessage("월간 모니터링으로 이동하고 있어요.");
          window.location.href = "/#monitoring-status-title";
          return;
        }

        if (!body.reportUrl) throw new Error("결제 리포트 주소가 응답에 없어요.");
        storePaidReportAccess(body);
        setMessage("정밀 리포트로 이동하고 있어요.");
        window.location.href = body.reportUrl;
      })
      .catch((confirmError) => {
        setError(confirmError instanceof Error ? confirmError.message : "결제 승인을 완료하지 못했어요.");
      });
  }, [searchParams]);

  return <PaymentShell ok={!error} title={error ? "결제 승인을 완료하지 못했어요" : "결제 완료 처리 중"} message={error ?? message} />;
}

export function PaymentFailClient() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "PAYMENT_FAILED";
  const message = searchParams.get("message") ?? "결제가 취소되었거나 실패했어요.";

  return <PaymentShell ok={false} title="결제가 완료되지 않았어요" message={`${message} (${code})`} />;
}

function PaymentShell({ ok, title, message }: { ok: boolean; title: string; message: string }) {
  return (
    <main className="toss-shell">
      <div className="toss-frame">
        <div className="toss-card" style={{ marginTop: 80, textAlign: "center" }}>
          {ok ? <CheckCircle2 size={42} color="#00C896" /> : <AlertTriangle size={42} color="#F04452" />}
          <h1 style={{ margin: "18px 0 8px" }}>{title}</h1>
          <p style={{ color: "#6b7684", lineHeight: 1.55 }}>{message}</p>
          {!ok ? (
            <Link className="toss-button" href="/" style={{ marginTop: 14, textDecoration: "none" }}>
              다시 점검하기
            </Link>
          ) : (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#6b7684" }}>
              <Loader2 size={18} aria-hidden />
              처리 중
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
