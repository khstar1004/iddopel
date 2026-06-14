import { afterEach, describe, expect, it, vi } from "vitest";
import { attachCheckoutUrl, confirmPolarCheckout, polarPaymentKey } from "./payment-provider";
import type { ReportOrder } from "./types";

describe("attachCheckoutUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.POLAR_ACCESS_TOKEN;
    delete process.env.POLAR_PRODUCT_ID;
    delete process.env.POLAR_MONTHLY_MONITORING_PRODUCT_ID;
    delete process.env.POLAR_SERVER;
    delete process.env.ENABLE_MOCK_PAYMENTS;
  });

  it("returns an absolute checkout URL for mock orders created from a Toss-hosted mini app", async () => {
    process.env.ENABLE_MOCK_PAYMENTS = "true";
    const order = orderFixture("order_mock", "MOCK");

    await expect(attachCheckoutUrl(order, "https://id-doppelganger.kr")).resolves.toMatchObject({
      checkoutUrl: "https://id-doppelganger.kr/checkout/order_mock"
    });
  });

  it("blocks mock checkout URLs unless mock payments are explicitly enabled", async () => {
    const order = orderFixture("order_mock", "MOCK");

    await expect(attachCheckoutUrl(order, "https://id-doppelganger.kr")).rejects.toMatchObject({
      code: "PAYMENT_CONFIG_MISSING",
      status: 503,
      message: "테스트 결제는 로컬/E2E 환경에서만 사용할 수 있어요. 운영 결제 Provider를 설정해 주세요."
    });
  });

  it("creates a Polar checkout session with app metadata and stores the checkout id as payment key", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json(
        {
          id: "chk_123",
          url: "https://polar.sh/checkout/chk_123"
        },
        { status: 201 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.POLAR_ACCESS_TOKEN = "polar_test_token";
    process.env.POLAR_PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

    const order = orderFixture("order_polar", "POLAR");
    const result = await attachCheckoutUrl(order, "https://id-doppelganger.kr");

    expect(result).toMatchObject({
      checkoutUrl: "https://polar.sh/checkout/chk_123",
      paymentKey: "polar_checkout:chk_123"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.polar.sh/v1/checkouts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer polar_test_token"
        }),
        body: expect.any(String)
      })
    );
    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      products: ["11111111-1111-4111-8111-111111111111"],
      success_url: "https://id-doppelganger.kr/payment/success?provider=polar&orderId=order_polar&checkout_id={CHECKOUT_ID}",
      return_url: "https://id-doppelganger.kr/checkout/order_polar",
      locale: "ko",
      currency: "krw",
      metadata: {
        orderId: "order_polar",
        scanId: "scan_order_polar",
        productId: "DETAILED_REPORT"
      }
    });
  });

  it("uses the monthly monitoring Polar product id for monitoring orders", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json(
        {
          id: "chk_monthly",
          url: "https://polar.sh/checkout/chk_monthly"
        },
        { status: 201 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.POLAR_ACCESS_TOKEN = "polar_test_token";
    process.env.POLAR_MONTHLY_MONITORING_PRODUCT_ID = "22222222-2222-4222-8222-222222222222";

    const order = {
      ...orderFixture("order_monitoring", "POLAR"),
      productId: "MONTHLY_MONITORING" as const,
      amount: 3900,
      orderName: "ID 도플갱어 월간 모니터링 - brand"
    };
    const result = await attachCheckoutUrl(order, "https://id-doppelganger.kr");

    expect(result.checkoutUrl).toBe("https://polar.sh/checkout/chk_monthly");
    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      products: ["22222222-2222-4222-8222-222222222222"],
      metadata: {
        orderId: "order_monitoring",
        scanId: "scan_order_monitoring",
        productId: "MONTHLY_MONITORING"
      }
    });
  });

  it("returns a configuration error when Polar access token is missing", async () => {
    process.env.POLAR_PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
    const order = orderFixture("order_polar", "POLAR");
    await expect(attachCheckoutUrl(order, "https://id-doppelganger.kr")).rejects.toMatchObject({
      code: "PAYMENT_CONFIG_MISSING",
      status: 503,
      message: "POLAR_ACCESS_TOKEN이 실제 결제 토큰으로 설정되어 있지 않아요."
    });
  });

  it("returns a provider-auth failure when Polar responds unauthorized", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          message: "Invalid API key"
        },
        { status: 401 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.POLAR_ACCESS_TOKEN = "polar_bad_token";
    process.env.POLAR_PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

    const order = orderFixture("order_polar", "POLAR");
    await expect(attachCheckoutUrl(order, "https://id-doppelganger.kr")).rejects.toMatchObject({
      code: "PAYMENT_CONFIG_INVALID",
      status: 503,
      message: "Polar 인증이 실패했어요. Access Token을 확인해 주세요."
    });
  });
});

describe("confirmPolarCheckout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.POLAR_ACCESS_TOKEN;
    delete process.env.POLAR_PRODUCT_ID;
    delete process.env.POLAR_MONTHLY_MONITORING_PRODUCT_ID;
    delete process.env.POLAR_SERVER;
    delete process.env.ENABLE_MOCK_PAYMENTS;
  });

  it("accepts a succeeded Polar checkout for the matching local order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: "chk_123",
          status: "succeeded",
          product_id: "11111111-1111-4111-8111-111111111111",
          currency: "krw",
          metadata: {
            orderId: "order_polar",
            scanId: "scan_order_polar",
            productId: "DETAILED_REPORT"
          }
        })
      )
    );
    process.env.POLAR_ACCESS_TOKEN = "polar_test_token";
    process.env.POLAR_PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

    await expect(confirmPolarCheckout(orderFixture("order_polar", "POLAR"), "chk_123")).resolves.toMatchObject({
      id: "chk_123",
      status: "succeeded"
    });
  });

  it("rejects a checkout whose metadata does not belong to the local order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: "chk_123",
          status: "succeeded",
          product_id: "11111111-1111-4111-8111-111111111111",
          currency: "krw",
          metadata: {
            orderId: "other_order"
          }
        })
      )
    );
    process.env.POLAR_ACCESS_TOKEN = "polar_test_token";
    process.env.POLAR_PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

    await expect(confirmPolarCheckout(orderFixture("order_polar", "POLAR"), "chk_123")).rejects.toThrow(
      "Polar 결제 정보가 주문과 일치하지 않아요."
    );
  });

  it("rejects a checkout without local order metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: "chk_123",
          status: "succeeded",
          product_id: "11111111-1111-4111-8111-111111111111",
          currency: "krw",
          metadata: {}
        })
      )
    );
    process.env.POLAR_ACCESS_TOKEN = "polar_test_token";
    process.env.POLAR_PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

    await expect(confirmPolarCheckout(orderFixture("order_polar", "POLAR"), "chk_123")).rejects.toThrow(
      "Polar 결제 정보가 주문과 일치하지 않아요."
    );
  });
});

describe("polarPaymentKey", () => {
  it("namespaces Polar checkout ids before storing them on local orders", () => {
    expect(polarPaymentKey("chk_123")).toBe("polar_checkout:chk_123");
  });
});

function orderFixture(orderId: string, provider: ReportOrder["provider"]): ReportOrder {
  return {
    orderId,
    scanId: `scan_${orderId}`,
    productId: "DETAILED_REPORT",
    amount: 2900,
    currency: "KRW",
    orderName: "ID 도플갱어 정밀 리포트",
    provider,
    status: "READY",
    checkoutUrl: null,
    paymentKey: null,
    reportTokenHash: null,
    createdAt: "2026-06-11T00:00:00.000Z",
    paidAt: null
  };
}
