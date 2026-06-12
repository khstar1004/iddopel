export const devAdminTokenKey = "id-doppelganger-dev-admin-token";
export const freeScanOwnerTokenKey = "id-doppelganger-free-scan-owner-token";

export function getOrCreateFreeScanOwnerToken() {
  const existing = window.localStorage.getItem(freeScanOwnerTokenKey);
  if (existing) return existing;

  const token = typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(freeScanOwnerTokenKey, token);
  return token;
}
