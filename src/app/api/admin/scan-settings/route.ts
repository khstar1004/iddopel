import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { BetaScanSettingsUpdate, getBetaScanSettingsStore } from "@/lib/beta-scan-quota";
import { devAdminRuntimeStatus, isDevAdminRequest } from "@/lib/dev-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isDevAdminRequest(request)) {
    return jsonError("UNAUTHORIZED", "관리자 로그인이 필요해요.", 401);
  }

  const settings = await getBetaScanSettingsStore().get();
  return NextResponse.json({ settings, runtime: runtimeStatus(request) });
}

export async function PATCH(request: Request) {
  if (!isDevAdminRequest(request)) {
    return jsonError("UNAUTHORIZED", "관리자 로그인이 필요해요.", 401);
  }

  const body = (await readJson(request)) as Record<string, unknown>;
  const input: BetaScanSettingsUpdate = {};

  if ("publicScanEnabled" in body) {
    if (typeof body.publicScanEnabled !== "boolean") {
      return jsonError("VALIDATION_ERROR", "공개 검색 사용 여부를 확인해 주세요.", 422);
    }
    input.publicScanEnabled = body.publicScanEnabled;
  }

  const numberFields = [
    ["freeScanLimit", "무료검색 한도", 0, 1000],
    ["windowHours", "무료검색 기준 시간", 1, 24 * 30],
    ["maxConcurrentScans", "동시 검색 상한", 1, 50],
    ["busyRetryAfterSeconds", "바쁠 때 재시도 시간", 1, 3600],
    ["scanLeaseTtlSeconds", "스캔 슬롯 TTL", 10, 600]
  ] as const;

  for (const [field, label, min, max] of numberFields) {
    if (!(field in body)) continue;
    const value = body[field];
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
      return jsonError("VALIDATION_ERROR", `${label}은 ${min}부터 ${max} 사이의 정수로 입력해 주세요.`, 422);
    }
    input[field] = value;
  }

  const settings = await getBetaScanSettingsStore().update(input);
  return NextResponse.json({ settings, runtime: runtimeStatus(request) });
}

function runtimeStatus(request: Request) {
  return {
    ...devAdminRuntimeStatus(request),
    scanProvider: process.env.SCAN_PROVIDER ?? "maigret",
    storage: process.env.DATABASE_URL?.startsWith("postgres") ? "postgres" : "file"
  };
}
