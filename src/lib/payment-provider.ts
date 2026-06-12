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

interface PolarCheckoutResponse {
  id?: string;
  url?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  product_id?: string | null;
  productId?: string | null;
  currency?: string | null;
  message?: string;
  detail?: string;
}

export async function attachCheckoutUrl(order: ReportOrder, origin: string): Promise<ReportOrder> {
  if (order.provider === "POLAR") {
    return attachPolarCheckoutUrl(order, origin);
  }

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

export async function attachPolarCheckoutUrl(order: ReportOrder, origin: string): Promise<ReportOrder> {
  if (order.provider !== "POLAR") {
    throw new Error("Polar 주문이 아니에요.");
  }

  const productId = requirePolarProductId();
  const response = await fetch(`${polarApiBaseUrl()}/v1/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requirePolarAccessToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      products: [productId],
      success_url: `${origin}/payment/success?provider=polar&orderId=${encodeURIComponent(order.orderId)}&checkout_id={CHECKOUT_ID}`,
      return_url: `${origin}/checkout/${encodeURIComponent(order.orderId)}`,
      locale: "ko",
      currency: "krw",
      metadata: {
        orderId: order.orderId,
        scanId: order.scanId,
        productId: order.productId
      }
    })
  });

  const body = (await response.json().catch(() => ({}))) as PolarCheckoutResponse;

  if (!response.ok || !body.id || !body.url) {
    throw new Error(body.message ?? body.detail ?? "Polar 결제창을 만들지 못했어요.");
  }

  return {
    ...order,
    checkoutUrl: body.url,
    paymentKey: polarPaymentKey(body.id)
  };
}

export async function confirmPolarCheckout(order: ReportOrder, checkoutId: string) {
  if (order.provider !== "POLAR") {
    throw new Error("Polar 주문이 아니에요.");
  }

  const checkout = await getPolarCheckout(checkoutId);
  if (checkout.status !== "succeeded") {
    throw new Error("Polar 결제가 아직 완료되지 않았어요.");
  }

  validatePolarCheckoutForOrder(order, checkout);
  return checkout;
}

export async function getPolarCheckout(checkoutId: string) {
  const safeCheckoutId = checkoutId.trim();
  if (!safeCheckoutId) {
    throw new Error("Polar 체크아웃 ID가 필요해요.");
  }

  const response = await fetch(`${polarApiBaseUrl()}/v1/checkouts/${encodeURIComponent(safeCheckoutId)}`, {
    headers: {
      Authorization: `Bearer ${requirePolarAccessToken()}`
    },
    cache: "no-store"
  });
  const body = (await response.json().catch(() => ({}))) as PolarCheckoutResponse;

  if (!response.ok) {
    throw new Error(body.message ?? body.detail ?? "Polar 결제 정보를 확인하지 못했어요.");
  }

  return body;
}

export function validatePolarCheckoutForOrder(order: ReportOrder, checkout: PolarCheckoutResponse) {
  const metadataOrderId = stringMetadata(checkout.metadata, "orderId");
  if (metadataOrderId !== order.orderId) {
    throw new Error("Polar 결제 정보가 주문과 일치하지 않아요.");
  }

  const metadataScanId = stringMetadata(checkout.metadata, "scanId");
  if (metadataScanId !== order.scanId) {
    throw new Error("Polar 결제 정보가 점검 기록과 일치하지 않아요.");
  }

  const metadataProductId = stringMetadata(checkout.metadata, "productId");
  if (metadataProductId !== order.productId) {
    throw new Error("Polar 결제 상품이 정밀 리포트 상품이 아니에요.");
  }

  const checkoutProductId = checkout.product_id ?? checkout.productId;
  const expectedProductId = process.env.POLAR_PRODUCT_ID?.trim();
  if (expectedProductId && checkoutProductId && checkoutProductId !== expectedProductId) {
    throw new Error("Polar 상품 ID가 설정값과 일치하지 않아요.");
  }

  if (checkout.currency && checkout.currency.toUpperCase() !== order.currency) {
    throw new Error("Polar 결제 통화가 주문 통화와 일치하지 않아요.");
  }
}

export function polarPaymentKey(checkoutId: string) {
  return `polar_checkout:${checkoutId}`;
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

function requirePolarAccessToken() {
  const accessToken = process.env.POLAR_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error("POLAR_ACCESS_TOKEN이 설정되어 있지 않아요.");
  }

  return accessToken;
}

function requirePolarProductId() {
  const productId = process.env.POLAR_PRODUCT_ID?.trim();
  if (!productId) {
    throw new Error("POLAR_PRODUCT_ID가 설정되어 있지 않아요.");
  }

  return productId;
}

function polarApiBaseUrl() {
  return process.env.POLAR_SERVER === "sandbox" ? "https://sandbox-api.polar.sh" : "https://api.polar.sh";
}

function stringMetadata(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}
