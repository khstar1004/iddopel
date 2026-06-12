export function isMonitoringPaywallEnabled(env?: { MONITORING_PAYWALL_ENABLED?: string }) {
  return (env?.MONITORING_PAYWALL_ENABLED ?? process.env.MONITORING_PAYWALL_ENABLED) === "true";
}

export function monitoringPaywallEnabledMessage() {
  return "월간 모니터링은 결제 후 등록할 수 있어요.";
}
