const postgresEnvKeys = ["DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING"] as const;

export function resolvePostgresUrl(env: Record<string, string | undefined> = process.env): string | null {
  for (const key of postgresEnvKeys) {
    const value = env[key]?.trim();
    if (isPostgresUrl(value)) return value;
  }

  return null;
}

export function hasPostgresUrl(env: Record<string, string | undefined> = process.env): boolean {
  return resolvePostgresUrl(env) !== null;
}

function isPostgresUrl(value: string | undefined): value is string {
  return /^postgres(?:ql)?:\/\//.test(value ?? "");
}
