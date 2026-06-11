(function () {
  const plugin = window.Capacitor?.Plugins?.NativeBilling;
  if (!plugin || window.IDD_NATIVE_BILLING) return;

  window.IDD_NATIVE_BILLING = {
    purchaseDetailedReport(options) {
      return plugin.purchaseDetailedReport(options);
    },
    restoreDetailedReport(options) {
      return plugin.restoreDetailedReport(options);
    },
    completeDetailedReportPurchase(options) {
      if (typeof plugin.completeDetailedReportPurchase !== "function") return Promise.resolve({ ok: true });
      return plugin.completeDetailedReportPurchase(options);
    }
  };
})();
