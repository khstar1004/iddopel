import { describe, expect, it } from "vitest";
import { resolvePostgresUrl } from "./postgres-env";

describe("resolvePostgresUrl", () => {
  it("prefers DATABASE_URL when multiple Postgres env aliases exist", () => {
    expect(
      resolvePostgresUrl({
        DATABASE_URL: "postgres://primary.example/db",
        POSTGRES_URL: "postgres://vercel.example/db"
      })
    ).toBe("postgres://primary.example/db");
  });

  it("accepts Vercel-style Postgres aliases when DATABASE_URL is not set", () => {
    expect(
      resolvePostgresUrl({
        POSTGRES_URL: "postgresql://vercel.example/db"
      })
    ).toBe("postgresql://vercel.example/db");
  });

  it("ignores missing or non-Postgres values", () => {
    expect(resolvePostgresUrl({ DATABASE_URL: "mysql://example/db", POSTGRES_URL: "" })).toBeNull();
  });
});
