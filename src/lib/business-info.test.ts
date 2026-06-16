import { describe, expect, it } from "vitest";
import { getBusinessInfo } from "./business-info";

describe("businessInfo", () => {
  it("publishes the business registration fields required for PG review", () => {
    const info = getBusinessInfo({
      BUSINESS_LEGAL_NAME: "테스트상호",
      BUSINESS_REPRESENTATIVE: "테스트대표",
      BUSINESS_REGISTRATION_NUMBER: "123-45-67890",
      BUSINESS_ADDRESS: "서울특별시 테스트구 테스트로 1",
      BUSINESS_PHONE: "02-0000-0000",
      BUSINESS_SUPPORT_EMAIL: "support@example.com"
    });

    expect(info.legalName).toBe("테스트상호");
    expect(info.representative).toBe("테스트대표");
    expect(info.businessRegistrationNumber).toBe("123-45-67890");
    expect(info.address).toContain("서울특별시");
    expect(info.phone).toBe("02-0000-0000");
    expect(info.supportEmail).toBe("support@example.com");
  });

  it("does not publish non-required personal registration details", () => {
    const businessInfo = getBusinessInfo();
    expect(Object.values(businessInfo).join(" ")).not.toContain("2004");
  });

  it("uses the configured shared office contact by default for PG review", () => {
    const info = getBusinessInfo({});
    expect(info.address).toBe("경기도 용인시 기흥구 사은로126번길 10, 103동 1701호(보라동, 민속마을쌍용아파트)");
    expect(info.phone).toBe("0507-1330-8289");
    expect(info.supportEmail).toBe("azicteam@gmail.com");
  });

  it("publishes service period and refund policy for payment review", () => {
    const info = getBusinessInfo({});
    expect(info.servicePeriod).toContain("결제 완료 즉시");
    expect(info.servicePeriod).toContain("30일");
    expect(info.refundPolicy).toContain("7일 이내");
    expect(info.refundPolicy).toContain("환불");
  });
});
