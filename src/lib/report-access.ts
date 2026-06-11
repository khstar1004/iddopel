import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function createReportToken() {
  return randomBytes(32).toString("base64url");
}

export function createFirstFreeReportToken(scanId: string, ownerToken: string) {
  return createHmac("sha256", reportTokenSecret())
    .update(`first-free:${scanId}:${ownerToken}`)
    .digest("base64url");
}

export function hashReportToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyReportToken(token: string, hash: string | null) {
  if (!hash) return false;

  const actual = Buffer.from(hashReportToken(token), "hex");
  const expected = Buffer.from(hash, "hex");

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function reportTokenSecret() {
  return process.env.REPORT_TOKEN_SECRET || process.env.DEV_ADMIN_SECRET || "local-report-token-secret";
}
