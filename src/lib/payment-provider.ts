import { createHash } from "node:crypto";
import type { ReportOrder } from "./types";

export class PaymentProviderError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
  }
}

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

interface PortOnePaymentResponse {
  id?: string;
  status?: string;
  amount?: {
    total?: number;
  };
  currency?: string;
  orderName?: string;
}

interface InicisAuthForm {
  resultCode?: string;
  resultMsg?: string;
  mid?: string;
  orderNumber?: string;
  authToken?: string;
  authUrl?: string;
  netCancelUrl?: string;
  idc_name?: string;
  charset?: string;
  merchantData?: string;
}

interface InicisApprovalResponse {
  resultCode?: string;
  resultMsg?: string;
  tid?: string;
  mid?: string;
  MOID?: string;
  TotPrice?: string;
  goodName?: string;
  payMethod?: string;
}

export interface InicisPaymentRequest {
  scriptUrl: string;
  formId: string;
  fields: Record<string, string>;
}

export async function attachCheckoutUrl(order: ReportOrder, origin: string): Promise<ReportOrder> {
  if (order.provider === "POLAR") {
    return attachPolarCheckoutUrl(order, origin);
  }

  if (order.provider === "INICIS") {
    requireInicisConfig();
    return {
      ...order,
      checkoutUrl: `${origin}/checkout/${order.orderId}`
    };
  }

  if (order.provider === "PORTONE") {
    requirePortOnePublicConfig();
    return {
      ...order,
      checkoutUrl: `${origin}/checkout/${order.orderId}`
    };
  }

  if (order.provider !== "TOSS") {
    requireMockPaymentsEnabled();
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

  const body = (await response.json().catch(() => ({}))) as TossPaymentResponse & { message?: string };

  if (!response.ok || !body.checkout?.url) {
    throw new PaymentProviderError("PAYMENT_REQUEST_REJECTED", body.message ?? "토스페이먼츠 결제창을 만들지 못했어요.", response.ok ? 502 : response.status);
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

  const productId = requirePolarProductId(order.productId);
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
    throw polarCheckoutError(response.status, body);
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
    throw polarRequestError(response.status, body, "Polar 결제 정보를 확인하지 못했어요.");
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
    throw new Error("Polar 결제 상품이 요청한 상품과 일치하지 않아요.");
  }

  const checkoutProductId = checkout.product_id ?? checkout.productId;
  const expectedProductId = polarProductIdFor(order.productId);
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

export async function confirmPortOnePayment(order: ReportOrder, paymentId: string) {
  if (order.provider !== "PORTONE") {
    throw new Error("PortOne 주문이 아니에요.");
  }

  if (!paymentId || paymentId !== order.orderId) {
    throw new Error("PortOne 결제 ID가 주문과 일치하지 않아요.");
  }

  const payment = await getPortOnePayment(paymentId);
  if (payment.status !== "PAID") {
    throw new Error("PortOne 결제가 아직 완료되지 않았어요.");
  }

  if (payment.amount?.total !== order.amount) {
    throw new Error("PortOne 결제 금액이 주문 금액과 일치하지 않아요.");
  }

  if (payment.currency && normalizePortOneCurrency(payment.currency) !== order.currency) {
    throw new Error("PortOne 결제 통화가 주문 통화와 일치하지 않아요.");
  }

  return payment;
}

export function portOnePaymentKey(paymentId: string) {
  return `portone_payment:${paymentId}`;
}

export function createInicisPaymentRequest(order: ReportOrder, origin: string, timestampValue = Date.now()): InicisPaymentRequest {
  if (order.provider !== "INICIS") {
    throw new Error("KG이니시스 주문이 아니에요.");
  }

  const { mid, signKey } = requireInicisConfig();
  const timestamp = String(timestampValue);
  const price = String(order.amount);
  const safeOrigin = origin.replace(/\/$/, "");
  const buyer = inicisBuyerConfig();

  return {
    scriptUrl: "https://stdpay.inicis.com/stdjs/INIStdPay.js",
    formId: "inicisPayForm",
    fields: {
      version: "1.0",
      gopaymethod: "Card",
      mid,
      oid: order.orderId,
      price,
      timestamp,
      use_chkfake: "Y",
      signature: sha256(`oid=${order.orderId}&price=${price}&timestamp=${timestamp}`),
      verification: sha256(`oid=${order.orderId}&price=${price}&signKey=${signKey}&timestamp=${timestamp}`),
      mKey: sha256(signKey),
      currency: "WON",
      goodname: inicisGoodName(order),
      buyername: buyer.name,
      buyertel: buyer.tel,
      buyeremail: buyer.email,
      returnUrl: `${safeOrigin}/api/payments/inicis/return`,
      closeUrl: `${safeOrigin}/payment/fail?provider=inicis&orderId=${encodeURIComponent(order.orderId)}`,
      acceptmethod: "centerCd(Y)",
      charset: "UTF-8",
      payViewType: "overlay",
      languageView: "ko",
      merchantData: order.orderId
    }
  };
}

export async function confirmInicisPayment(order: ReportOrder, authForm: InicisAuthForm) {
  if (order.provider !== "INICIS") {
    throw new Error("KG이니시스 주문이 아니에요.");
  }

  if (authForm.resultCode !== "0000") {
    throw new Error(authForm.resultMsg || "KG이니시스 인증이 완료되지 않았어요.");
  }

  const orderNumber = authForm.orderNumber || authForm.merchantData || "";
  if (orderNumber !== order.orderId) {
    throw new Error("KG이니시스 인증 주문번호가 주문과 일치하지 않아요.");
  }

  const { mid, signKey } = requireInicisConfig();
  if (authForm.mid !== mid) {
    throw new Error("KG이니시스 MID가 주문 설정과 일치하지 않아요.");
  }

  const authToken = authForm.authToken?.trim();
  const authUrl = authForm.authUrl?.trim();
  if (!authToken || !authUrl) {
    throw new Error("KG이니시스 승인 정보가 올바르지 않아요.");
  }

  assertInicisAuthUrl(authUrl, authForm.idc_name);

  const timestamp = String(Date.now());
  const body = new URLSearchParams({
    mid,
    authToken,
    timestamp,
    signature: sha256(`authToken=${authToken}&timestamp=${timestamp}`),
    verification: sha256(`authToken=${authToken}&signKey=${signKey}&timestamp=${timestamp}`),
    charset: "UTF-8",
    format: "JSON",
    price: String(order.amount)
  });

  const response = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body,
    cache: "no-store"
  });
  const approval = (await response.json().catch(() => ({}))) as InicisApprovalResponse;

  if (!response.ok || approval.resultCode !== "0000") {
    throw new PaymentProviderError(
      "PAYMENT_REQUEST_REJECTED",
      approval.resultMsg || "KG이니시스 결제 승인을 완료하지 못했어요.",
      response.ok ? 400 : response.status,
      { status: response.status }
    );
  }

  validateInicisApproval(order, approval, mid);
  return approval;
}

export function inicisPaymentKey(transactionId: string) {
  return `inicis_tid:${transactionId}`;
}

export function publicPortOneConfig() {
  return requirePortOnePublicConfig();
}

function requireTossSecretKey() {
  const secretKey = process.env.TOSS_SECRET_KEY?.trim();
  if (!isUsableCredential(secretKey)) {
    throw new PaymentProviderError("PAYMENT_CONFIG_MISSING", "TOSS_SECRET_KEY가 실제 결제 키로 설정되어 있지 않아요.", 503);
  }

  return secretKey;
}

function requirePortOnePublicConfig() {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID?.trim() || process.env.PORTONE_STORE_ID?.trim();
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY?.trim() || process.env.PORTONE_CHANNEL_KEY?.trim();
  if (!isUsableCredential(storeId)) {
    throw new PaymentProviderError("PAYMENT_CONFIG_MISSING", "PORTONE_STORE_ID가 설정되어 있지 않아요.", 503);
  }
  if (!isUsableCredential(channelKey)) {
    throw new PaymentProviderError("PAYMENT_CONFIG_MISSING", "PORTONE_CHANNEL_KEY가 설정되어 있지 않아요.", 503);
  }

  return { storeId, channelKey };
}

function requirePortOneApiSecret() {
  const apiSecret = process.env.PORTONE_API_SECRET?.trim();
  if (!isUsableCredential(apiSecret)) {
    throw new PaymentProviderError("PAYMENT_CONFIG_MISSING", "PORTONE_API_SECRET이 설정되어 있지 않아요.", 503);
  }

  return apiSecret;
}

function requireInicisConfig() {
  const mid = process.env.INICIS_MID?.trim();
  const signKey = process.env.INICIS_SIGN_KEY?.trim();
  if (!isUsableCredential(mid)) {
    throw new PaymentProviderError("PAYMENT_CONFIG_MISSING", "INICIS_MID가 설정되어 있지 않아요.", 503);
  }
  if (!isUsableCredential(signKey)) {
    throw new PaymentProviderError("PAYMENT_CONFIG_MISSING", "INICIS_SIGN_KEY가 설정되어 있지 않아요.", 503);
  }

  return { mid, signKey };
}

async function getPortOnePayment(paymentId: string) {
  const response = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `PortOne ${requirePortOneApiSecret()}`
    },
    cache: "no-store"
  });
  const body = (await response.json().catch(() => ({}))) as PortOnePaymentResponse & { message?: string };

  if (!response.ok) {
    throw new PaymentProviderError(
      response.status === 401 || response.status === 403 ? "PAYMENT_CONFIG_INVALID" : "PAYMENT_REQUEST_REJECTED",
      body.message ?? "PortOne 결제 정보를 확인하지 못했어요.",
      response.status === 401 || response.status === 403 ? 503 : 400,
      { status: response.status }
    );
  }

  return body;
}

function inicisBuyerConfig() {
  return {
    name: process.env.INICIS_BUYER_NAME?.trim() || "ID도플갱어고객",
    tel: process.env.INICIS_BUYER_TEL?.trim() || "010-0000-0000",
    email: process.env.INICIS_BUYER_EMAIL?.trim() || process.env.BUSINESS_SUPPORT_EMAIL?.trim() || "azicteam@gmail.com"
  };
}

function inicisGoodName(order: ReportOrder) {
  return order.productId === "MONTHLY_MONITORING" ? "ID 도플갱어 월간 모니터링" : "ID 도플갱어 정밀 리포트";
}

function assertInicisAuthUrl(rawAuthUrl: string, idcName: string | undefined) {
  const authUrl = new URL(rawAuthUrl);
  if (authUrl.protocol !== "https:") {
    throw new Error("KG이니시스 승인 URL은 HTTPS여야 해요.");
  }

  const allowedHosts = new Map([
    ["stg", "stgstdpay.inicis.com"],
    ["fc", "fcstdpay.inicis.com"],
    ["ks", "ksstdpay.inicis.com"]
  ]);
  const expectedHost = allowedHosts.get((idcName || "").toLowerCase());
  if (!expectedHost || authUrl.hostname !== expectedHost) {
    throw new Error("KG이니시스 승인 URL과 IDC 코드가 일치하지 않아요.");
  }
}

function validateInicisApproval(order: ReportOrder, approval: InicisApprovalResponse, mid: string) {
  if (approval.mid !== mid) {
    throw new Error("KG이니시스 승인 MID가 주문 설정과 일치하지 않아요.");
  }
  if (approval.MOID !== order.orderId) {
    throw new Error("KG이니시스 승인 주문번호가 주문과 일치하지 않아요.");
  }
  if (Number(approval.TotPrice) !== order.amount) {
    throw new Error("KG이니시스 승인 금액이 주문 금액과 일치하지 않아요.");
  }
  if (!approval.tid) {
    throw new Error("KG이니시스 거래번호가 응답에 없어요.");
  }
}

function normalizePortOneCurrency(currency: string) {
  return currency.replace(/^CURRENCY_/, "").toUpperCase();
}

function requireMockPaymentsEnabled() {
  if (process.env.ENABLE_MOCK_PAYMENTS !== "true") {
    throw new PaymentProviderError(
      "PAYMENT_CONFIG_MISSING",
      "테스트 결제는 로컬/E2E 환경에서만 사용할 수 있어요. 운영 결제 Provider를 설정해 주세요.",
      503
    );
  }
}

function tossBasicAuth(secretKey: string) {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function requirePolarAccessToken() {
  const accessToken = process.env.POLAR_ACCESS_TOKEN?.trim();
  if (!isUsableCredential(accessToken)) {
    throw new PaymentProviderError("PAYMENT_CONFIG_MISSING", "POLAR_ACCESS_TOKEN이 실제 결제 토큰으로 설정되어 있지 않아요.", 503);
  }

  return accessToken;
}

function requirePolarProductId(productId: ReportOrder["productId"]) {
  const productIdValue = polarProductIdFor(productId);
  if (!isUsableCredential(productIdValue)) {
    throw new PaymentProviderError(
      "PAYMENT_CONFIG_MISSING",
      `${polarProductEnvKey(productId)}가 실제 상품 ID로 설정되어 있지 않아요.`,
      503
    );
  }

  return productIdValue;
}

function polarProductIdFor(productId: ReportOrder["productId"]) {
  const productIdValue = process.env[polarProductEnvKey(productId)]?.trim();
  return productIdValue || null;
}

function polarProductEnvKey(productId: ReportOrder["productId"]) {
  return productId === "MONTHLY_MONITORING" ? "POLAR_MONTHLY_MONITORING_PRODUCT_ID" : "POLAR_PRODUCT_ID";
}

function isUsableCredential(value: string | null | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;

  return ![
    "your_",
    "replace-with",
    "placeholder",
    "change_me",
    "dummy",
    "example"
  ].some((marker) => normalized.includes(marker));
}

function polarApiBaseUrl() {
  return process.env.POLAR_SERVER === "sandbox" ? "https://sandbox-api.polar.sh" : "https://api.polar.sh";
}

function stringMetadata(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function polarCheckoutError(status: number, body: PolarCheckoutResponse) {
  return polarRequestError(status, body, "Polar 결제창을 만들지 못했어요.");
}

function polarRequestError(status: number, body: PolarCheckoutResponse, fallbackMessage: string) {
  const message = body.message ?? body.detail ?? fallbackMessage;

  if (status === 401 || status === 403) {
    return new PaymentProviderError("PAYMENT_CONFIG_INVALID", "Polar 인증이 실패했어요. Access Token을 확인해 주세요.", 503, {
      status,
      providerMessage: message
    });
  }

  if (status === 400) {
    return new PaymentProviderError("PAYMENT_REQUEST_REJECTED", message, 400, {
      status,
      providerMessage: message
    });
  }

  if (status >= 500) {
    return new PaymentProviderError("PAYMENT_PROVIDER_UNAVAILABLE", "Polar API 호출에 실패했어요.", 502, {
      status,
      providerMessage: message
    });
  }

  return new PaymentProviderError("PAYMENT_REQUEST_REJECTED", message, 400, {
    status,
    providerMessage: message
  });
}
