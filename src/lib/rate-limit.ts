const buckets = new Map<string, { count: number; resetAt: number }>();

export function assertRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= limit) {
    const seconds = Math.ceil((bucket.resetAt - now) / 1000);
    throw new Error(`RATE_LIMIT:${seconds}`);
  }

  bucket.count += 1;
}

export function rateLimitKey(request: Request, fallback: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || fallback;
}
