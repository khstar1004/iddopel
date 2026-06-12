import { NextResponse } from "next/server";
import { listAdminAuditEvents } from "@/lib/admin-audit-log";
import { adminRuntimeStatus } from "@/lib/admin-runtime";
import { jsonError } from "@/lib/api";
import { BetaScanQuotaSettings, getBetaScanSettingsStore } from "@/lib/beta-scan-quota";
import { isDevAdminRequest } from "@/lib/dev-admin";
import { buildHealthStatus, HealthStatus } from "@/lib/health";

export const runtime = "nodejs";

type AdminRuntime = ReturnType<typeof adminRuntimeStatus>;

interface AdminRecommendation {
  level: "critical" | "warning" | "info" | "ok";
  title: string;
  detail: string;
}

export async function GET(request: Request) {
  if (!isDevAdminRequest(request)) {
    return jsonError("UNAUTHORIZED", "관리자 로그인이 필요해요.", 401);
  }

  const [settings, recentAuditEvents] = await Promise.all([
    getBetaScanSettingsStore().get(),
    listAdminAuditEvents(8)
  ]);
  const runtimeStatus = adminRuntimeStatus(request);
  const health = buildHealthStatus(process.env);

  return NextResponse.json({
    settings,
    runtime: runtimeStatus,
    health,
    recommendations: adminRecommendations(runtimeStatus, settings, health),
    recentAuditEvents
  });
}

function adminRecommendations(
  runtimeStatus: AdminRuntime,
  settings: BetaScanQuotaSettings,
  health: HealthStatus
): AdminRecommendation[] {
  const recommendations: AdminRecommendation[] = [];

  if (!runtimeStatus.loginConfigured) {
    recommendations.push({
      level: "critical",
      title: "관리자 로그인 잠김",
      detail: "공개 배포에서 DEV_ADMIN_PASSWORD가 없으면 관리자 설정 변경이 막힙니다."
    });
  }

  if (!runtimeStatus.secretConfigured) {
    recommendations.push({
      level: "warning",
      title: "관리자 토큰 비밀키 필요",
      detail: "DEV_ADMIN_SECRET을 고정해야 재배포 뒤에도 관리자 토큰 검증이 안정적입니다."
    });
  }

  if (health.scanProvider !== "maigret") {
    recommendations.push({
      level: "critical",
      title: "Maigret 스캐너 확인",
      detail: "SCAN_PROVIDER가 maigret이 아닙니다. 실제 검색 품질을 위해 Maigret CLI 경로를 확인하세요."
    });
  }

  if (health.storage === "file") {
    recommendations.push({
      level: runtimeStatus.local ? "info" : "warning",
      title: "파일 저장소 사용 중",
      detail: "Vercel 운영에서는 파일 저장소가 영구 저장소가 아니므로 Postgres 연결을 권장합니다."
    });
  }

  if (health.paymentProvider === "mock") {
    recommendations.push({
      level: "warning",
      title: "결제 모의 모드",
      detail: "유료 리포트 판매 전 PAYMENT_PROVIDER와 결제 키를 운영값으로 전환해야 합니다."
    });
  }

  if (!settings.publicScanEnabled) {
    recommendations.push({
      level: "info",
      title: "공개 검색 차단 중",
      detail: "베타 검색 요청은 503으로 막히며 관리자 토큰 요청만 통과합니다."
    });
  }

  if (settings.maxConcurrentScans <= 1 && settings.publicScanEnabled) {
    recommendations.push({
      level: "warning",
      title: "동시 검색 상한 낮음",
      detail: "공개 검색이 켜진 상태에서 동시 검색 1개는 대기 오류가 자주 발생할 수 있습니다."
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      level: "ok",
      title: "운영 기본값 정상",
      detail: "관리자 로그인, 스캐너, 저장소, 결제 모드가 출시 기준을 통과했습니다."
    });
  }

  return recommendations;
}
