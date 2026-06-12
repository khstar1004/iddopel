import { describe, expect, it } from "vitest";
import { handleApiError } from "./api";
import { PaymentProviderError } from "./payment-provider";

describe("handleApiError", () => {
  it("returns structured JSON for payment provider errors", async () => {
    const response = handleApiError(new PaymentProviderError("PAYMENT_CONFIG_MISSING", "POLAR_ACCESS_TOKEN이 없습니다.", 503));

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error?: { code: string; message: string } };
    expect(body.error).toMatchObject({
      code: "PAYMENT_CONFIG_MISSING",
      message: "POLAR_ACCESS_TOKEN이 없습니다."
    });
  });
});
