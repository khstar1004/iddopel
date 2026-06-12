import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { getBetaScanSettingsStore } from "@/lib/beta-scan-quota";
import { isDevAdminRequest } from "@/lib/dev-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isDevAdminRequest(request)) {
    return jsonError("UNAUTHORIZED", "관리자 로그인이 필요해요.", 401);
  }

  const settings = await getBetaScanSettingsStore().get();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  if (!isDevAdminRequest(request)) {
    return jsonError("UNAUTHORIZED", "관리자 로그인이 필요해요.", 401);
  }

  const body = (await readJson(request)) as Record<string, unknown>;
  const freeScanLimit = typeof body.freeScanLimit === "number" ? body.freeScanLimit : Number.NaN;

  if (!Number.isInteger(freeScanLimit) || freeScanLimit < 0 || freeScanLimit > 1000) {
    return jsonError("VALIDATION_ERROR", "무료검색 한도는 0부터 1000 사이의 정수로 입력해 주세요.", 422);
  }

  const settings = await getBetaScanSettingsStore().update({ freeScanLimit });
  return NextResponse.json({ settings });
}
