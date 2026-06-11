import { createHmac } from "node:crypto";
import { getCommerceRepository } from "./commerce-repository";
import { createOrder } from "./commerce";
import { isDevAdminRequest } from "./dev-admin";
import { rateLimitKey } from "./rate-limit";
import { expiresAtForPaidReport } from "./retention";
import { createFirstFreeReportToken, createReportToken, hashReportToken, verifyReportToken } from "./report-access";
import { extendStoredScanExpiration } from "./scan-store";
import type { ReportOrder, ScanJob } from "./types";

export class FirstFreeReportError extends Error {
  constructor(
    public readonly code: "FIRST_FREE_USED" | "FIRST_FREE_UNAVAILABLE",
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export async function grantReportAccess(order: ReportOrder, paymentKey: string | null, token = createReportToken()) {
  const paidOrder: ReportOrder = {
    ...order,
    status: "PAID",
    paymentKey,
    reportTokenHash: hashReportToken(token),
    paidAt: new Date().toISOString()
  };

  await getCommerceRepository().update(paidOrder);
  await extendStoredScanExpiration(order.scanId, expiresAtForPaidReport(new Date()));

  return {
    order: paidOrder,
    token
  };
}

export async function grantFirstFreeReportAccess(scan: ScanJob, ownerToken: string | null, requestFingerprint: string | null = null) {
  const nextOwnerToken = ownerToken || createReportToken();
  const entitlementKeys = uniqueKeys([requestFingerprint, `owner:${nextOwnerToken}`]);
  const repository = getCommerceRepository();

  for (const entitlementKey of entitlementKeys) {
    const existing = await repository.findPaidOrderByPaymentKey("MOCK", firstFreePaymentKey(entitlementKey));
    if (!existing) continue;

    if (existing.scanId !== scan.scanId) {
      throw new FirstFreeReportError("FIRST_FREE_USED", "1회 무료 상세 결과를 이미 사용했어요.", 409);
    }

    return {
      ownerToken: nextOwnerToken,
      token: createFirstFreeReportToken(scan.scanId, entitlementKey),
      order: existing,
      reused: true
    };
  }

  const primaryEntitlementKey = entitlementKeys[0] ?? `owner:${nextOwnerToken}`;
  const token = createFirstFreeReportToken(scan.scanId, primaryEntitlementKey);
  const paymentKey = firstFreePaymentKey(primaryEntitlementKey);
  const order = await repository.create(createOrder(scan, "MOCK"));
  const { order: paidOrder } = await grantReportAccess(order, paymentKey, token);
  await createFirstFreeAliases(scan, paidOrder, entitlementKeys.slice(1));

  return {
    ownerToken: nextOwnerToken,
    token,
    order: paidOrder,
    reused: false
  };
}

export function firstFreeRequestFingerprint(request: Request) {
  if (process.env.DISABLE_FIRST_FREE_FINGERPRINT === "true") return null;

  const ip = rateLimitKey(request, "").trim();
  const userAgent = normalizeHeader(request.headers.get("user-agent"));
  const acceptLanguage = normalizeHeader(request.headers.get("accept-language")).slice(0, 80);

  if (!ip || !userAgent) return null;

  const digest = createHmac("sha256", firstFreeFingerprintSecret())
    .update(`${ip}\n${userAgent}\n${acceptLanguage}`)
    .digest("hex");

  return `request:${digest}`;
}

export async function canAccessFullReport(scanId: string, token: string | null, request?: Request) {
  if (request && isDevAdminRequest(request)) return true;
  if (!token) return false;

  const hash = hashReportToken(token);
  const order = await getCommerceRepository().findPaidOrderByTokenHash(scanId, hash);
  return Boolean(order && verifyReportToken(token, order.reportTokenHash));
}

function firstFreePaymentKey(ownerToken: string) {
  return `first_free:${hashReportToken(ownerToken)}`;
}

async function createFirstFreeAliases(scan: ScanJob, sourceOrder: ReportOrder, entitlementKeys: string[]) {
  const repository = getCommerceRepository();

  for (const entitlementKey of entitlementKeys) {
    const aliasOrder: ReportOrder = {
      ...createOrder(scan, "MOCK"),
      status: "PAID",
      paymentKey: firstFreePaymentKey(entitlementKey),
      reportTokenHash: hashReportToken(createFirstFreeReportToken(scan.scanId, entitlementKey)),
      paidAt: sourceOrder.paidAt,
      checkoutUrl: sourceOrder.checkoutUrl
    };
    await repository.create(aliasOrder);
  }
}

function uniqueKeys(keys: Array<string | null | undefined>) {
  return [...new Set(keys.filter((key): key is string => Boolean(key)))];
}

function normalizeHeader(value: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function firstFreeFingerprintSecret() {
  return process.env.FIRST_FREE_FINGERPRINT_SECRET || process.env.REPORT_TOKEN_SECRET || process.env.DEV_ADMIN_SECRET || "local-first-free-fingerprint-secret";
}
