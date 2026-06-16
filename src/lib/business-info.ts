import { defaultRefundPolicy, defaultServicePeriod } from "./service-policy";

export interface BusinessInfoFields {
  serviceName: string;
  legalName: string;
  representative: string;
  businessRegistrationNumber: string;
  address: string;
  businessType: string;
  businessItem: string;
  phone: string;
  supportEmail: string;
  serviceDelivery: string;
  servicePeriod: string;
  refundPolicy: string;
}

export const businessInfo = getBusinessInfo();

export function getBusinessInfo(env: Record<string, string | undefined> = process.env): BusinessInfoFields {
  return {
    serviceName: env.BUSINESS_SERVICE_NAME?.trim() || "ID 도플갱어",
    legalName: env.BUSINESS_LEGAL_NAME?.trim() || "아직",
    representative: env.BUSINESS_REPRESENTATIVE?.trim() || "임관훈",
    businessRegistrationNumber: env.BUSINESS_REGISTRATION_NUMBER?.trim() || "822-26-01904",
    address: env.BUSINESS_ADDRESS?.trim() || "경기도 용인시 기흥구 사은로126번길 10, 103동 1701호(보라동, 민속마을쌍용아파트)",
    businessType: env.BUSINESS_TYPE?.trim() || "정보통신업",
    businessItem: env.BUSINESS_ITEM?.trim() || "IT 서비스",
    phone: env.BUSINESS_PHONE?.trim() || "0507-1330-8289",
    supportEmail: env.BUSINESS_SUPPORT_EMAIL?.trim() || env.STORE_SUPPORT_EMAIL?.trim() || "azicteam@gmail.com",
    serviceDelivery:
      env.BUSINESS_SERVICE_DELIVERY?.trim() ||
      "실물 배송이 없는 온라인 디지털 서비스입니다. 결제 완료 즉시 상세 리포트 조회 권한을 제공합니다.",
    servicePeriod:
      env.BUSINESS_SERVICE_PERIOD?.trim() ||
      defaultServicePeriod,
    refundPolicy:
      env.BUSINESS_REFUND_POLICY?.trim() ||
      defaultRefundPolicy
  };
}
