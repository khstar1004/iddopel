import { NextResponse } from "next/server";
import { getCommerceRepository } from "@/lib/commerce-repository";
import { grantReportAccess } from "@/lib/entitlements";
import { confirmInicisPayment, inicisPaymentKey } from "@/lib/payment-provider";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = Object.fromEntries((await request.formData()).entries());
  const orderId = stringField(form.orderNumber) || stringField(form.merchantData);
  const failUrl = paymentFailUrl(request, orderId);

  try {
    if (!orderId) {
      return NextResponse.redirect(withFailReason(failUrl, "VALIDATION_ERROR", "주문번호가 올바르지 않아요."), 303);
    }

    const order = await getCommerceRepository().get(orderId);
    if (!order) {
      return NextResponse.redirect(withFailReason(failUrl, "NOT_FOUND", "주문을 찾을 수 없어요."), 303);
    }

    const approval = await confirmInicisPayment(order, {
      resultCode: stringField(form.resultCode),
      resultMsg: stringField(form.resultMsg),
      mid: stringField(form.mid),
      orderNumber: stringField(form.orderNumber),
      authToken: stringField(form.authToken),
      authUrl: stringField(form.authUrl),
      netCancelUrl: stringField(form.netCancelUrl),
      idc_name: stringField(form.idc_name),
      charset: stringField(form.charset),
      merchantData: stringField(form.merchantData)
    });
    const { token } = await grantReportAccess(order, inicisPaymentKey(approval.tid || order.orderId));

    if (order.productId === "MONTHLY_MONITORING") {
      const doneUrl = new URL("/", request.url);
      doneUrl.hash = "monitoring-status-title";
      return NextResponse.redirect(doneUrl, 303);
    }

    return NextResponse.redirect(new URL(`/reports/${encodeURIComponent(order.scanId)}?token=${encodeURIComponent(token)}`, request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "KG이니시스 결제 승인을 완료하지 못했어요.";
    return NextResponse.redirect(withFailReason(failUrl, "PAYMENT_FAILED", message), 303);
  }
}

function stringField(value: FormDataEntryValue | undefined) {
  return typeof value === "string" ? value : "";
}

function paymentFailUrl(request: Request, orderId: string) {
  const url = new URL("/payment/fail", request.url);
  url.searchParams.set("provider", "inicis");
  if (orderId) url.searchParams.set("orderId", orderId);
  return url;
}

function withFailReason(url: URL, code: string, message: string) {
  const nextUrl = new URL(url);
  nextUrl.searchParams.set("code", code);
  nextUrl.searchParams.set("message", message);
  return nextUrl;
}
