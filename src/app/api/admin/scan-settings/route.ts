import { NextResponse } from "next/server";
import { AdminAuditChanges, recordAdminAuditEvent } from "@/lib/admin-audit-log";
import { adminRuntimeStatus } from "@/lib/admin-runtime";
import { jsonError, readJson } from "@/lib/api";
import { BetaScanQuotaSettings, BetaScanSettingsUpdate, getBetaScanSettingsStore } from "@/lib/beta-scan-quota";
import { devAdminUsername, isDevAdminRequest } from "@/lib/dev-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isDevAdminRequest(request)) {
    return jsonError("UNAUTHORIZED", "관리자 로그인이 필요해요.", 401);
  }

  const settings = await getBetaScanSettingsStore().get();
  return NextResponse.json({ settings, runtime: adminRuntimeStatus(request) });
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

  const store = getBetaScanSettingsStore();
  const previousSettings = await store.get();
  const settings = await store.update(input);
  await recordAdminAuditEvent(request, {
    action: "scan_settings.update",
    actor: devAdminUsername(),
    changes: betaScanSettingsChanges(previousSettings, settings)
  });
  return NextResponse.json({ settings, runtime: adminRuntimeStatus(request) });
}

function betaScanSettingsChanges(before: BetaScanQuotaSettings, after: BetaScanQuotaSettings): AdminAuditChanges {
  const fields = [
    "publicScanEnabled",
    "freeScanLimit",
    "windowHours",
    "maxConcurrentScans",
    "busyRetryAfterSeconds",
    "scanLeaseTtlSeconds"
  ] as const;
  const changes: AdminAuditChanges = {};

  for (const field of fields) {
    if (before[field] === after[field]) continue;
    changes[field] = {
      before: before[field],
      after: after[field]
    };
  }

  return changes;
}
