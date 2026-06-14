import { afterEach, describe, expect, it } from "vitest";
import { freeScanOwnerTokenKey, getOrCreateFreeScanOwnerToken, resetFreeScanOwnerTokenForTests } from "./client-tokens";

describe("client token storage", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

  afterEach(() => {
    resetFreeScanOwnerTokenForTests();
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  });

  it("reuses a stored free scan owner token", () => {
    setWindowLocalStorage({
      getItem: (key) => key === freeScanOwnerTokenKey ? "stored-owner-token" : null,
      setItem: () => undefined,
      removeItem: () => undefined
    });

    expect(getOrCreateFreeScanOwnerToken()).toBe("stored-owner-token");
  });

  it("falls back to memory when localStorage is unavailable", () => {
    setWindowLocalStorage({
      getItem: () => {
        throw new Error("storage unavailable");
      },
      setItem: () => {
        throw new Error("storage unavailable");
      },
      removeItem: () => undefined
    });

    const first = getOrCreateFreeScanOwnerToken();
    const second = getOrCreateFreeScanOwnerToken();

    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });
});

function setWindowLocalStorage(localStorage: Pick<Storage, "getItem" | "setItem" | "removeItem">) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage
    }
  });
}
