export const devAdminTokenKey = "id-doppelganger-dev-admin-token";
export const freeScanOwnerTokenKey = "id-doppelganger-free-scan-owner-token";

let memoryFreeScanOwnerToken: string | null = null;

export function getOrCreateFreeScanOwnerToken() {
  const existing = readLocalStorage(freeScanOwnerTokenKey) ?? memoryFreeScanOwnerToken;
  if (existing) return existing;

  const token = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  memoryFreeScanOwnerToken = token;
  writeLocalStorage(freeScanOwnerTokenKey, token);
  return token;
}

export function resetFreeScanOwnerTokenForTests() {
  memoryFreeScanOwnerToken = null;
}

function readLocalStorage(key: string) {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // Private browsing and embedded app shells can reject localStorage writes.
  }
}
