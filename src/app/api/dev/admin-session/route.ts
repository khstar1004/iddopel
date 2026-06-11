import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import {
  createDevAdminToken,
  devAdminUsername,
  isDevAdminEnabled,
  isDevAdminRequest,
  verifyDevAdminCredentials
} from "@/lib/dev-admin";

export async function GET(request: Request) {
  const enabled = isDevAdminEnabled(request);
  return NextResponse.json({
    enabled,
    authenticated: enabled && isDevAdminRequest(request),
    username: enabled ? devAdminUsername() : null
  });
}

export async function POST(request: Request) {
  if (!isDevAdminEnabled(request)) {
    return jsonError("NOT_FOUND", "개발자 테스트 로그인이 비활성화되어 있어요.", 404);
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
