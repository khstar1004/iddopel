import { createHmac, timingSafeEqual } from "node:crypto";

const tokenMaxAgeMs = 7 * 24 * 60 * 60 * 1000;

export function isDevAdminEnabled(request: Request) {
  if (process.env.ENABLE_DEV_ADMIN === "false") return false;
  if (process.env.ENABLE_DEV_ADMIN === "true") {
    return true;
  }
  return isLocalRequest(request);
}

export function isDevAdminLoginConfigured(request: Request) {
  return isLocalRequest(request) || Boolean(process.env.DEV_ADMIN_PASSWORD);
}

export function devAdminRuntimeStatus(request: Request) {
  const local = isLocalRequest(request);
  const enabled = isDevAdminEnabled(request);

  return {
    enabled,
    loginConfigured: enabled && isDevAdminLoginConfigured(request),
    setupRequired: enabled && !isDevAdminLoginConfigured(request),
    local,
    passwordConfigured: Boolean(process.env.DEV_ADMIN_PASSWORD),
    secretConfigured: Boolean(process.env.DEV_ADMIN_SECRET),
    username: enabled ? devAdminUsername() : null
  };
}

export function devAdminUsername() {
  return process.env.DEV_ADMIN_USERNAME || "admin";
}

export function verifyDevAdminCredentials(request: Request, username: string, password: string) {
  if (!isDevAdminEnabled(request)) return false;
  if (!isDevAdminLoginConfigured(request)) return false;
  const expectedUsername = devAdminUsername();
  const expectedPassword = process.env.DEV_ADMIN_PASSWORD || (isLocalRequest(request) ? "admin" : "");
  if (!expectedPassword) return false;

  return safeEqual(username, expectedUsername) && safeEqual(password, expectedPassword);
}

export function createDevAdminToken(request: Request, username: string, now = Date.now()) {
  if (!isDevAdminEnabled(request)) return null;
  if (!isDevAdminLoginConfigured(request)) return null;
  const payload = Buffer.from(JSON.stringify({ username, issuedAt: now })).toString("base64url");
  const signature = sign(payload, request);
  return `dev.${payload}.${signature}`;
}

export function isDevAdminRequest(request: Request) {
  if (!isDevAdminEnabled(request)) return false;
  if (!isDevAdminLoginConfigured(request)) return false;
  const token = readDevAdminToken(request);
  if (!token) return false;
  return verifyDevAdminToken(request, token);
}

export function verifyDevAdminToken(request: Request, token: string, now = Date.now()) {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "dev") return false;
  const [, payload, signature] = parts;
  if (!safeEqual(signature, sign(payload, request))) return false;

  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as {
      username?: unknown;
      issuedAt?: unknown;
    };
    if (body.username !== devAdminUsername()) return false;
    if (typeof body.issuedAt !== "number") return false;
    return now - body.issuedAt >= 0 && now - body.issuedAt <= tokenMaxAgeMs;
  } catch {
    return false;
  }
}

export function readDevAdminToken(request: Request) {
  const headerToken = request.headers.get("x-dev-admin-token");
  if (headerToken) return headerToken;

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice("Bearer ".length).trim();

  const urlToken = new URL(request.url).searchParams.get("adminToken");
  return urlToken || null;
}

function isLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function sign(payload: string, request: Request) {
  return createHmac("sha256", devAdminSecret(request)).update(payload).digest("base64url");
}

function devAdminSecret(request: Request) {
  return process.env.DEV_ADMIN_SECRET || `${devAdminUsername()}:${process.env.DEV_ADMIN_PASSWORD || "admin"}:${new URL(request.url).hostname}`;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
