import { createHash } from "node:crypto";
import {
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload
} from "@apple/app-store-server-library";
import { google } from "googleapis";
import { createOrder } from "./commerce";
import { getCommerceRepository } from "./commerce-repository";
import { grantReportAccess } from "./entitlements";
import { getStoredScan } from "./scan-store";
import type { ProductId, ReportOrder } from "./types";

export type NativeStoreProvider = "APP_STORE" | "GOOGLE_PLAY";

export interface VerifiedNativePurchase {
  provider: NativeStoreProvider;
  productId: ProductId;
  externalPurchaseId: string;
  storeProductId: string;
}

export class NativePurchaseError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 422
  ) {
    super(message);
  }
}

export async function redeemVerifiedNativePurchase(scanId: string, purchase: VerifiedNativePurchase) {
  const scan = await getStoredScan(scanId);
  if (!scan) {
    throw new NativePurchaseError("NOT_FOUND", "점검 기록을 찾을 수 없어요.", 404);
  }

  const paymentKey = nativePaymentKey(purchase.provider, purchase.externalPurchaseId);
  const repository = getCommerceRepository();
  const existing = await repository.findPaidOrderByPaymentKey(purchase.provider, paymentKey);

  if (existing && existing.scanId !== scanId) {
    throw new NativePurchaseError("PURCHASE_ALREADY_USED", "이미 다른 점검 리포트에 사용된 구매예요.", 409);
  }

  const order = existing ?? (await repository.create(createOrder(scan, purchase.provider)));
  const { token } = await grantReportAccess(order, paymentKey);

  return {
    scanId,
    orderId: order.orderId,
    reportToken: token,
    reportUrl: `/reports/${scanId}?token=${encodeURIComponent(token)}`
  };
}

export function nativePaymentKey(provider: NativeStoreProvider, externalPurchaseId: string) {
  return `${provider}:${createHash("sha256").update(externalPurchaseId).digest("hex")}`;
}

export async function verifyApplePurchase(input: {
  transactionId: string;
  env?: Record<string, string | undefined>;
}): Promise<VerifiedNativePurchase> {
  const env = input.env ?? process.env;
  const transactionId = requireNonEmpty(input.transactionId, "transactionId");
  const bundleId = requireEnv(env, "APPLE_BUNDLE_ID");
  const storeProductId = env.APPLE_DETAILED_REPORT_PRODUCT_ID || "detailed_report";
  const client = new AppStoreServerAPIClient(
    normalizePrivateKey(requireEnv(env, "APPLE_PRIVATE_KEY")),
    requireEnv(env, "APPLE_KEY_ID"),
    requireEnv(env, "APPLE_ISSUER_ID"),
    bundleId,
    parseAppleEnvironment(env.APPLE_ENVIRONMENT)
  );

  const response = await client.getTransactionInfo(transactionId);
  if (!response.signedTransactionInfo) {
    throw new NativePurchaseError("INVALID_PURCHASE", "App Store 거래 정보를 확인하지 못했어요.");
  }

  const payload = await decodeOrVerifyAppleTransaction(response.signedTransactionInfo, env, bundleId, parseAppleEnvironment(env.APPLE_ENVIRONMENT));
  return validateAppleTransactionPayload(payload, {
    transactionId,
    bundleId,
    storeProductId
  });
}

export function validateAppleTransactionPayload(
  payload: Partial<JWSTransactionDecodedPayload>,
  expected: { transactionId: string; bundleId: string; storeProductId: string }
): VerifiedNativePurchase {
  if (payload.transactionId && payload.transactionId !== expected.transactionId) {
    throw new NativePurchaseError("INVALID_PURCHASE", "App Store 거래 ID가 일치하지 않아요.");
  }

  if (payload.bundleId !== expected.bundleId) {
    throw new NativePurchaseError("INVALID_PURCHASE", "앱 번들 ID가 일치하지 않아요.");
  }

  if (payload.productId !== expected.storeProductId) {
    throw new NativePurchaseError("INVALID_PURCHASE", "구매 상품이 정밀 리포트 상품이 아니에요.");
  }

  if (payload.revocationDate) {
    throw new NativePurchaseError("PURCHASE_REVOKED", "환불 또는 취소된 구매예요.", 409);
  }

  const transactionId = payload.transactionId ?? expected.transactionId;
  return {
    provider: "APP_STORE",
    productId: "DETAILED_REPORT",
    externalPurchaseId: transactionId,
    storeProductId: expected.storeProductId
  };
}

export async function verifyGooglePlayPurchase(input: {
  productId: string;
  purchaseToken: string;
  env?: Record<string, string | undefined>;
}): Promise<VerifiedNativePurchase> {
  const env = input.env ?? process.env;
  const productId = requireNonEmpty(input.productId, "productId");
  const purchaseToken = requireNonEmpty(input.purchaseToken, "purchaseToken");
  const packageName = requireEnv(env, "GOOGLE_PLAY_PACKAGE_NAME");
  const storeProductId = env.GOOGLE_PLAY_DETAILED_REPORT_PRODUCT_ID || "detailed_report";

  if (productId !== storeProductId) {
    throw new NativePurchaseError("INVALID_PURCHASE", "구매 상품이 정밀 리포트 상품이 아니에요.");
  }

  const credentials = JSON.parse(requireEnv(env, "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON")) as object;
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"]
  });
  const androidpublisher = google.androidpublisher({ version: "v3", auth });
  const response = await androidpublisher.purchases.products.get({
    packageName,
    productId,
    token: purchaseToken
  });

  return validateGoogleProductPurchase(response.data, {
    purchaseToken,
    storeProductId
  });
}

export function validateGoogleProductPurchase(
  purchase: { purchaseState?: number | null; orderId?: string | null },
  expected: { purchaseToken: string; storeProductId: string }
): VerifiedNativePurchase {
  if (purchase.purchaseState !== 0) {
    throw new NativePurchaseError("INVALID_PURCHASE", "완료되지 않은 Google Play 구매예요.");
  }

  return {
    provider: "GOOGLE_PLAY",
    productId: "DETAILED_REPORT",
    externalPurchaseId: purchase.orderId || expected.purchaseToken,
    storeProductId: expected.storeProductId
  };
}

function decodeJwsPayload<T>(jws: string): T {
  const [, payload] = jws.split(".");
  if (!payload) {
    throw new NativePurchaseError("INVALID_PURCHASE", "App Store 거래 서명이 올바르지 않아요.");
  }
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as T;
}

async function decodeOrVerifyAppleTransaction(
  signedTransactionInfo: string,
  env: Record<string, string | undefined>,
  bundleId: string,
  environment: Environment
) {
  const certificateValue = env.APPLE_ROOT_CERTIFICATES_BASE64?.trim();

  if (!certificateValue) {
    if (env.APPLE_REQUIRE_JWS_VERIFICATION === "true") {
      throw new NativePurchaseError("STORE_NOT_CONFIGURED", "APPLE_ROOT_CERTIFICATES_BASE64 환경변수가 필요해요.", 500);
    }
    return decodeJwsPayload<JWSTransactionDecodedPayload>(signedTransactionInfo);
  }

  const rootCertificates = certificateValue.split(",").map((certificate) => Buffer.from(certificate.trim(), "base64"));
  const appAppleId = env.APPLE_APP_APPLE_ID ? Number(env.APPLE_APP_APPLE_ID) : undefined;
  const verifier = new SignedDataVerifier(
    rootCertificates,
    true,
    environment,
    bundleId,
    Number.isFinite(appAppleId) ? appAppleId : undefined
  );
  return verifier.verifyAndDecodeTransaction(signedTransactionInfo);
}

function parseAppleEnvironment(value: string | undefined) {
  if (value === "production") return Environment.PRODUCTION;
  if (value === "xcode") return Environment.XCODE;
  if (value === "local_testing") return Environment.LOCAL_TESTING;
  return Environment.SANDBOX;
}

function normalizePrivateKey(value: string) {
  return value.includes("\\n") ? value.replaceAll("\\n", "\n") : value;
}

function requireEnv(env: Record<string, string | undefined>, key: string) {
  const value = env[key]?.trim();
  if (!value) {
    throw new NativePurchaseError("STORE_NOT_CONFIGURED", `${key} 환경변수가 필요해요.`, 500);
  }
  return value;
}

function requireNonEmpty(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new NativePurchaseError("VALIDATION_ERROR", `${field} 값이 필요해요.`, 422);
  }
  return normalized;
}
