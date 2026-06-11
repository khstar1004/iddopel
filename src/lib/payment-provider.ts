import { createHash } from "node:crypto";
import type { ReportOrder } from "./types";

interface TossPaymentResponse {
  checkout?: {
    url?: string;
  };
}

interface TossConfirmResponse {
  paymentKey?: string;
  status?: string;
}

export async function attachCheckoutUrl(order: ReportOrder, origin: string): Promise<ReportOrder> {
  if (order.provider !== "TOSS") {
    return {
      ...order,
      checkoutUrl: `${origin}/checkout/${order.orderId}`
    };
  }

  const secretKey = requireTossSecretKey();
  const response = await fetch("https://api.tosspayments.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: tossBasicAuth(secretKey),
      "Content-Type": "application/json",
      "Idempotency-Key": order.orderId
    },
    body: JSON.stringify({
      method: "CARD",
      amount: order.amount,
      currency: order.currency,
      orderId: order.orderId,
      orderName: order.orderName,
      successUrl: `${origin}/payment/success`,
      failUrl: `${origin}/payment/fail`
    })
  });

  const body = (await response.json()) as TossPaymentResponse & { message?: string };

  if (!response.ok || !body.checkout?.url) {
    throw new Error(body.message ?? "토스페이먼츠 결제창을 만들지 못했어요.");
  }

  return {
    ...order,
    checkoutUrl: body.checkout.url
  };
}

export async function confirmTossPayment(order: ReportOrder, paymentKey: string, amount: number) {
  if (order.provider !== "TOSS") {
    throw new Error("토스페이먼츠 주문이 아니에요.");
  }

  if (order.amount !== amount) {
    throw new Error("결제 금액이 주문 금액과 일치하지 않아요.");
  }

  const secretKey = requireTossSecretKey();
  const response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: tossBasicAuth(secretKey),
      "Content-Type": "application/json",
      "Idempotency-Key": createHash("sha256").update(`${order.orderId}:${paymentKey}`).digest("hex")
    },
    body: JSON.stringify({
      paymentKey,
      orderId: order.orderId,
      amount
    })
  });

  const body = (await response.json()) as TossConfirmResponse & { message?: string };

  if (!response.ok) {
    throw new Error(body.message ?? "결제 승인을 완료하지 못했어요.");
  }

  return body;
}

function requireTossSecretKey() {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    throw new Error("TOSS_SECRET_KEY가 설정되어 있지 않아요.");
  }

  return secretKey;
}

function tossBasicAuth(secretKey: string) {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}
