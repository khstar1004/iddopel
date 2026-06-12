const postgresEnvKeys = ["DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING"];

export function resolvePostgresUrl(env = process.env) {
  for (const key of postgresEnvKeys) {
    const value = String(env[key] ?? "").trim();
    if (/^postgres(?:ql)?:\/\//.test(value)) return value;
  }

  return null;
}
