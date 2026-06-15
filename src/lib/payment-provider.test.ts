import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachCheckoutUrl,
  createInicisPaymentRequest,
  confirmPolarCheckout,
  confirmPortOnePayment,
  inicisPaymentKey,
  polarPaymentKey,
  portOnePaymentKey,
  publicPortOneConfig
} from "./payment-provider";
import type { ReportOrder } from "./types";

describe("attachCheckoutUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.POLAR_ACCESS_TOKEN;
    delete process.env.POLAR_PRODUCT_ID;
    delete process.env.POLAR_MONTHLY_MONITORING_PRODUCT_ID;
    delete process.env.POLAR_SERVER;
    delete process.env.ENABLE_MOCK_PAYMENTS;
    delete process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    delete process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
    delete process.env.PORTONE_API_SECRET;
    delete process.env.INICIS_MID;
    delete process.env.INICIS_SIGN_KEY;
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

  it("returns an internal checkout URL for PortOne browser checkout orders", async () => {
    process.env.NEXT_PUBLIC_PORTONE_STORE_ID = "store_test";
    process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY = "channel-key-test";
    const order = orderFixture("order_portone", "PORTONE");

    await expect(attachCheckoutUrl(order, "https://id-doppelganger.kr")).resolves.toMatchObject({
      checkoutUrl: "https://id-doppelganger.kr/checkout/order_portone"
    });
  });

  it("blocks PortOne checkout when channel key is missing", async () => {
    process.env.NEXT_PUBLIC_PORTONE_STORE_ID = "store_test";
    const order = orderFixture("order_portone", "PORTONE");

    await expect(attachCheckoutUrl(order, "https://id-doppelganger.kr")).rejects.toMatchObject({
      code: "PAYMENT_CONFIG_MISSING",
      status: 503,
      message: "PORTONE_CHANNEL_KEY가 설정되어 있지 않아요."
    });
  });

  it("returns an internal checkout URL for KG Inicis browser checkout orders", async () => {
    process.env.INICIS_MID = "INIpayTest";
    process.env.INICIS_SIGN_KEY = "not-a-real-inicis-sign-key";
    const order = orderFixture("order_inicis", "INICIS");

    await expect(attachCheckoutUrl(order, "https://id-doppelganger.kr")).resolves.toMatchObject({
      checkoutUrl: "https://id-doppelganger.kr/checkout/order_inicis"
    });
  });

  it("blocks KG Inicis checkout when the sign key is missing", async () => {
    process.env.INICIS_MID = "INIpayTest";
    const order = orderFixture("order_inicis", "INICIS");

    await expect(attachCheckoutUrl(order, "https://id-doppelganger.kr")).rejects.toMatchObject({
      code: "PAYMENT_CONFIG_MISSING",
      status: 503,
      message: "INICIS_SIGN_KEY가 설정되어 있지 않아요."
    });
  });
});

describe("createInicisPaymentRequest", () => {
  afterEach(() => {
    delete process.env.INICIS_MID;
    delete process.env.INICIS_SIGN_KEY;
    delete process.env.INICIS_BUYER_NAME;
    delete process.env.INICIS_BUYER_TEL;
    delete process.env.INICIS_BUYER_EMAIL;
  });

  it("creates signed KG Inicis request fields without exposing the sign key", () => {
    process.env.INICIS_MID = "INIpayTest";
    process.env.INICIS_SIGN_KEY = "not-a-real-inicis-sign-key";
    process.env.INICIS_BUYER_NAME = "검수자";
    process.env.INICIS_BUYER_TEL = "010-0000-0000";
    process.env.INICIS_BUYER_EMAIL = "review@example.com";

    const request = createInicisPaymentRequest(orderFixture("order_inicis", "INICIS"), "https://id-doppelganger.kr", 1770000000000);

    expect(request.scriptUrl).toBe("https://stdpay.inicis.com/stdjs/INIStdPay.js");
    expect(request.fields).toMatchObject({
      version: "1.0",
      mid: "INIpayTest",
      oid: "order_inicis",
      price: "2900",
      timestamp: "1770000000000",
      currency: "WON",
      goodname: "ID 도플갱어 정밀 리포트",
      buyername: "검수자",
      buyertel: "010-0000-0000",
      buyeremail: "review@example.com",
      returnUrl: "https://id-doppelganger.kr/api/payments/inicis/return",
      closeUrl: "https://id-doppelganger.kr/payment/fail?provider=inicis&orderId=order_inicis",
      acceptmethod: "centerCd(Y)"
    });
    expect(Object.values(request.fields)).not.toContain("not-a-real-inicis-sign-key");
    expect(request.fields.signature).toHaveLength(64);
    expect(request.fields.verification).toHaveLength(64);
    expect(request.fields.mKey).toHaveLength(64);
  });

  it("namespaces KG Inicis transaction ids before storing paid access", () => {
    expect(inicisPaymentKey("StdpayCARDINIpayTest202606150000000001")).toBe(
      "inicis_tid:StdpayCARDINIpayTest202606150000000001"
    );
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

describe("confirmPortOnePayment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PORTONE_API_SECRET;
  });

  it("accepts a paid PortOne payment whose amount and currency match the local order", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        id: "order_portone",
        status: "PAID",
        amount: { total: 2900 },
        currency: "CURRENCY_KRW"
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.PORTONE_API_SECRET = "portone_secret_test";

    await expect(confirmPortOnePayment(orderFixture("order_portone", "PORTONE"), "order_portone")).resolves.toMatchObject({
      status: "PAID"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.portone.io/payments/order_portone",
      expect.objectContaining({
        headers: { Authorization: "PortOne portone_secret_test" },
        cache: "no-store"
      })
    );
  });

  it("rejects paid PortOne payments with a different amount", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: "order_portone",
          status: "PAID",
          amount: { total: 1000 },
          currency: "CURRENCY_KRW"
        })
      )
    );
    process.env.PORTONE_API_SECRET = "portone_secret_test";

    await expect(confirmPortOnePayment(orderFixture("order_portone", "PORTONE"), "order_portone")).rejects.toThrow(
      "PortOne 결제 금액이 주문 금액과 일치하지 않아요."
    );
  });

  it("rejects PortOne payments that are not paid yet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: "order_portone",
          status: "READY",
          amount: { total: 2900 },
          currency: "CURRENCY_KRW"
        })
      )
    );
    process.env.PORTONE_API_SECRET = "portone_secret_test";

    await expect(confirmPortOnePayment(orderFixture("order_portone", "PORTONE"), "order_portone")).rejects.toThrow(
      "PortOne 결제가 아직 완료되지 않았어요."
    );
  });
});

describe("PortOne helpers", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    delete process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
  });

  it("returns public PortOne browser SDK configuration from env", () => {
    process.env.NEXT_PUBLIC_PORTONE_STORE_ID = "store_test";
    process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY = "channel-key-test";

    expect(publicPortOneConfig()).toEqual({
      storeId: "store_test",
      channelKey: "channel-key-test"
    });
  });

  it("namespaces PortOne payment ids before storing paid access", () => {
    expect(portOnePaymentKey("payment_123")).toBe("portone_payment:payment_123");
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
