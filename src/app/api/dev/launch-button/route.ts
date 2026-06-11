import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { devAdminUsername, isDevAdminRequest } from "@/lib/dev-admin";
import {
  createLaunchEnvStatus,
  isLaunchConsoleAvailable,
  isLaunchConsoleExecutionEnabled,
  launchConfirmPhrase,
  mergeLaunchEnvValues,
  parseLaunchConsoleOptions,
  renderLaunchEnvFile,
  sanitizeLaunchEnvUpdates,
  validateLaunchEnvValues,
  type LaunchConsoleOptions
} from "@/lib/launch-console";
// @ts-ignore - The launch CLI is an ESM Node script reused by this localhost-only route.
import { buildLaunchButtonPlan, buildLaunchEnvironment, createPublicLaunchReport, defaultLaunchEnvFile, parseEnvText, runLaunchButtonPlan } from "../../../../../scripts/launch-button.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return handleLaunchConsoleRequest(request, {
    ship: url.searchParams.get("ship") === "true",
    localGate: url.searchParams.get("localGate") === "true",
    execute: false,
    saveEnv: false,
    confirm: ""
  });
}

export async function POST(request: Request) {
  const body = (await readJson(request)) as Record<string, unknown>;
  return handleLaunchConsoleRequest(request, parseLaunchConsoleOptions(body), body);
}

async function handleLaunchConsoleRequest(request: Request, options: LaunchConsoleOptions, body: Record<string, unknown> = {}) {
  if (!isLaunchConsoleAvailable(request)) {
    return jsonError("NOT_FOUND", "출시 콘솔은 로컬 운영자 환경에서만 열 수 있어요.", 404);
  }

  if (!isDevAdminRequest(request)) {
    return jsonError("UNAUTHORIZED", "개발자 테스트 로그인이 필요해요.", 401);
  }

  const state = await buildLaunchConsoleState(options);
  const executeEnabled = isLaunchConsoleExecutionEnabled(request);
  const baseResponse = {
    ok: state.plan.ready,
    authenticated: true,
    username: devAdminUsername(),
    executeEnabled,
    confirmPhrase: launchConfirmPhrase,
    envFileExists: state.envFileExists,
    envStatus: state.envStatus,
    report: state.report
  };

  if (options.saveEnv) {
    const updates = sanitizeLaunchEnvUpdates((body.envValues || {}) as Record<string, unknown>);
    const mergedValues = mergeLaunchEnvValues(state.fileEnv, updates);
    const validationErrors = validateLaunchEnvValues(mergedValues);
    if (Object.keys(validationErrors).length > 0) {
      const rejectedStatus = createLaunchEnvStatus(mergedValues);
      return NextResponse.json(
        {
          ...baseResponse,
          ok: false,
          envStatus: rejectedStatus,
          saved: false,
          savedKeys: [],
          error: {
            code: "INVALID_LAUNCH_VALUES",
            message: "출시 환경값 형식을 확인해 주세요.",
            details: validationErrors
          }
        }
      );
    }

    await writeFile(defaultLaunchEnvFile, renderLaunchEnvFile(mergedValues), "utf-8");
    const nextState = await buildLaunchConsoleState(options);
    return NextResponse.json({
      ...baseResponse,
      ok: nextState.plan.ready,
      envFileExists: nextState.envFileExists,
      envStatus: nextState.envStatus,
      report: nextState.report,
      saved: true,
      savedKeys: Object.keys(updates)
    });
  }

  if (!options.execute) {
    return NextResponse.json(baseResponse);
  }

  if (!executeEnabled) {
    return NextResponse.json(
      {
        ...baseResponse,
        ok: false,
        error: {
          code: "EXECUTION_DISABLED",
          message: "ENABLE_LAUNCH_CONSOLE=true 환경에서만 출시 명령을 실행할 수 있어요."
        }
      },
      { status: 403 }
    );
  }

  if (options.confirm !== launchConfirmPhrase) {
    return NextResponse.json(
      {
        ...baseResponse,
        ok: false,
        error: {
          code: "CONFIRMATION_REQUIRED",
          message: `${launchConfirmPhrase} 확인 문구가 필요해요.`
        }
      },
      { status: 422 }
    );
  }

  if (!state.plan.ready) {
    return NextResponse.json(
      {
        ...baseResponse,
        ok: false,
        error: {
          code: "MISSING_LAUNCH_VALUES",
          message: "출시 실행에 필요한 값이 아직 부족해요."
        }
      },
      { status: 409 }
    );
  }

  const result = runLaunchButtonPlan(state.plan, { env: state.launchEnv });
  return NextResponse.json({ ...baseResponse, ok: result.ok, result }, { status: result.ok ? 200 : 500 });
}

async function buildLaunchConsoleState(options: LaunchConsoleOptions) {
  const envFileExists = existsSync(defaultLaunchEnvFile);
  const fileEnv = envFileExists ? parseEnvText(await readFile(defaultLaunchEnvFile, "utf-8")) : {};
  const launchEnv = buildLaunchEnvironment({ fileEnv, env: process.env });
  const plan = buildLaunchButtonPlan({
    env: launchEnv,
    envFile: defaultLaunchEnvFile,
    ship: options.ship,
    localGate: options.localGate
  });
  const report = createPublicLaunchReport(plan);

  return {
    envFileExists,
    fileEnv,
    envStatus: createLaunchEnvStatus(launchEnv),
    launchEnv,
    plan,
    report
  };
}
