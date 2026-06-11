import { NextResponse } from "next/server";
import type { ApiErrorBody } from "./types";
import { ValidationError } from "./validation";

export function jsonError(code: string, message: string, status: number, details?: unknown) {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      details
    }
  };

  return NextResponse.json(body, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ValidationError) {
    return jsonError(error.code, error.message, error.code === "DISALLOWED_SEARCH" ? 400 : 422, error.details);
  }

  return jsonError("INTERNAL_ERROR", "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("VALIDATION_ERROR", "JSON 요청 본문이 필요해요.");
  }
}
