import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import {
  createDevAdminToken,
  devAdminRuntimeStatus,
  devAdminUsername,
  isDevAdminEnabled,
  isDevAdminLoginConfigured,
  isDevAdminRequest,
  verifyDevAdminCredentials
} from "@/lib/dev-admin";

export async function GET(request: Request) {
  const status = devAdminRuntimeStatus(request);
  return NextResponse.json({
    ...status,
    authenticated: status.loginConfigured && isDevAdminRequest(request),
    username: status.enabled ? devAdminUsername() : null
  });
}

export async function POST(request: Request) {
  if (!isDevAdminEnabled(request)) {
    return jsonError("NOT_FOUND", "개발자 테스트 로그인이 비활성화되어 있어요.", 404);
  }
  if (!isDevAdminLoginConfigured(request)) {
    return jsonError("DEV_ADMIN_SETUP_REQUIRED", "관리자 비밀번호 환경변수를 먼저 설정해 주세요.", 409);
  }

  const body = (await readJson(request)) as Record<string, unknown>;
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!verifyDevAdminCredentials(request, username, password)) {
    return jsonError("UNAUTHORIZED", "개발자 테스트 계정 정보를 확인해 주세요.", 401);
  }

  const token = createDevAdminToken(request, username);
  return NextResponse.json({
    ok: true,
    username,
    token
  });
}
