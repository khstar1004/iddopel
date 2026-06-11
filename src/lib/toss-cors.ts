import { NextResponse } from "next/server";

type EnvLike = Record<string, string | undefined>;

interface CorsEvaluation {
  allowed: boolean;
  origin: string | null;
}

const defaultAllowedHeaders = ["Content-Type", "Authorization"];

export function getTossAllowedOrigins(env: EnvLike = process.env) {
  const origins = new Set<string>();
  const miniAppName = env.TOSS_MINI_APP_NAME?.trim();

  if (miniAppName && /^[a-z0-9-]+$/.test(miniAppName)) {
    origins.add(`https://${miniAppName}.apps.tossmini.com`);
    origins.add(`https://${miniAppName}.private-apps.tossmini.com`);
  }

  for (const origin of parseOrigins(env.TOSS_ALLOWED_ORIGINS ?? "")) {
    origins.add(origin);
  }

  return [...origins];
}

export function evaluateTossCors(request: Request, env: EnvLike = process.env): CorsEvaluation {
  const origin = normalizeOrigin(request.headers.get("origin"));
  if (!origin) return { allowed: true, origin: null };

  const requestOrigin = new URL(request.url).origin;
  if (origin === requestOrigin || isEquivalentLoopbackOrigin(origin, requestOrigin)) {
    return { allowed: true, origin: null };
  }

  if (getTossAllowedOrigins(env).includes(origin)) {
    return { allowed: true, origin };
  }

  return { allowed: false, origin };
}

export function rejectDisallowedTossCors(request: Request, env: EnvLike = process.env) {
  const evaluation = evaluateTossCors(request, env);
  if (evaluation.allowed) return null;

  return NextResponse.json(
    {
      error: {
        code: "FORBIDDEN_ORIGIN",
        message: "허용된 토스 미니앱 출처에서만 요청할 수 있어요."
      }
    },
    { status: 403 }
  );
}

export function withTossCors<T extends Response>(request: Request, response: T, env: EnvLike = process.env): T {
  const evaluation = evaluateTossCors(request, env);
  if (!evaluation.allowed || !evaluation.origin) return response;

  for (const [key, value] of tossCorsHeaders(evaluation.origin, ["GET", "POST"])) {
    response.headers.set(key, value);
  }

  return response;
}

export function createTossPreflightResponse(request: Request, methods: string[], env: EnvLike = process.env) {
  const evaluation = evaluateTossCors(request, env);
  if (!evaluation.allowed) {
    return rejectDisallowedTossCors(request, env) ?? new NextResponse(null, { status: 403 });
  }

  const headers = evaluation.origin ? tossCorsHeaders(evaluation.origin, methods) : new Headers();
  return new NextResponse(null, { status: 204, headers });
}

function tossCorsHeaders(origin: string, methods: string[]) {
  const normalizedMethods = [...new Set([...methods, "OPTIONS"])].join(", ");
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": normalizedMethods,
    "Access-Control-Allow-Headers": defaultAllowedHeaders.join(", "),
    "Access-Control-Max-Age": "600",
    Vary: "Origin"
  });
}

function parseOrigins(value: string) {
  return value
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));
}

function normalizeOrigin(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isEquivalentLoopbackOrigin(origin: string, requestOrigin: string) {
  try {
    const left = new URL(origin);
    const right = new URL(requestOrigin);
    const loopbackHosts = new Set(["localhost", "127.0.0.1"]);
    return (
      left.protocol === "http:" &&
      right.protocol === "http:" &&
      loopbackHosts.has(left.hostname) &&
      loopbackHosts.has(right.hostname) &&
      left.port === right.port
    );
  } catch {
    return false;
  }
}
