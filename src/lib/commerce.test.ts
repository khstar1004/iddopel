import { afterEach, describe, expect, it } from "vitest";
import { resolvePaymentProvider } from "./commerce";

describe("resolvePaymentProvider", () => {
  afterEach(() => {
    delete process.env.PAYMENT_PROVIDER;
  });

  it("resolves KG Inicis web checkout when selected", () => {
    process.env.PAYMENT_PROVIDER = "inicis";

    expect(resolvePaymentProvider()).toBe("INICIS");
  });
});
