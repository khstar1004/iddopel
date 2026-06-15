import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("checkout deployment configuration", () => {
  it("allows KG Inicis orders in the Postgres provider constraint", async () => {
    const schema = await readFile("db/schema.sql", "utf-8");

    expect(schema).toMatch(/report_orders_provider_check[\s\S]*'INICIS'/);
  });

  it("allows AdSense assets in the global content security policy", async () => {
    const nextConfig = await readFile("next.config.ts", "utf-8");

    expect(nextConfig).toContain("https://pagead2.googlesyndication.com");
    expect(nextConfig).toContain("https://googleads.g.doubleclick.net");
    expect(nextConfig).toContain("https://tpc.googlesyndication.com");
  });
});
