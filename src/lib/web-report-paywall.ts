export function isWebDetailedReportPaywallEnabled(
  env?: { WEB_DETAILED_REPORT_PAYWALL_ENABLED?: string }
) {
  return (env?.WEB_DETAILED_REPORT_PAYWALL_ENABLED ?? process.env.WEB_DETAILED_REPORT_PAYWALL_ENABLED) === "true";
}

export function webPaywallEnabledMessage() {
  return "정밀 리포트는 결제 후 열려요.";
}
