import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

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
    expect(nextConfig).toContain("https://*.adtrafficquality.google");
  });

  it("allows KG Inicis child scripts and frames in the global content security policy", async () => {
    const nextConfig = await readFile("next.config.ts", "utf-8");

    expect(nextConfig).toContain("https://stdpay.inicis.com");
    expect(nextConfig).toContain("https://stdux.inicis.com");
    expect(nextConfig).toContain("style-src 'self' 'unsafe-inline' https://stdpay.inicis.com https://stdux.inicis.com");
  });

  it("opens KG Inicis from the checkout button handler instead of an effect-driven popup", async () => {
    const checkoutClient = await readFile("src/components/CheckoutClient.tsx", "utf-8");
    const payWithInicis = checkoutClient.match(/(?:async )?function payWithInicis\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";

    expect(payWithInicis).toContain("window.INIStdPay.pay(inicisRequest.formId)");
    expect(checkoutClient).not.toContain("openedInicisOrderRef");
  });

  it("keeps opener access for checkout routes that launch external payment popups", async () => {
    const configuredHeaders = typeof nextConfig.headers === "function" ? await nextConfig.headers() : [];

    for (const source of ["/checkout/:path*", "/payment/:path*"]) {
      expect(configuredHeaders).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source,
            headers: expect.arrayContaining([
              { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }
            ])
          })
        ])
      );
    }
  });
});
