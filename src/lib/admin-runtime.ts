import { devAdminRuntimeStatus } from "./dev-admin";
import { buildHealthStatus } from "./health";

export function adminRuntimeStatus(request: Request) {
  const health = buildHealthStatus(process.env);

  return {
    ...devAdminRuntimeStatus(request),
    scanProvider: health.scanProvider,
    storage: health.storage,
    paymentProvider: health.paymentProvider
  };
}
