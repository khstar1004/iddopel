import { afterEach, describe, expect, it } from "vitest";
import { readPaidReportAccess, storePaidReportAccess } from "./paid-monitoring-client";

describe("paid report client storage", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

  afterEach(() => {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  });

  it("stores and reads paid report access when storage is available", () => {
    const storage = new Map<string, string>();
    setWindowLocalStorage(storage);

    storePaidReportAccess({
      orderId: "order_1",
      reportToken: "report-token",
      reportUrl: "/reports/scan_123",
      scanId: "scan_123"
    });

    expect(readPaidReportAccess("scan_123")).toMatchObject({
      orderId: "order_1",
      reportToken: "report-token",
      scanId: "scan_123"
    });
  });

  it("does not throw when browser storage is unavailable", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { origin: "https://id.example.com" },
        localStorage: {
          getItem: () => {
            throw new Error("storage unavailable");
          },
          setItem: () => {
            throw new Error("storage unavailable");
          },
          removeItem: () => undefined
        }
      }
    });

    expect(() => {
      storePaidReportAccess({
        orderId: "order_1",
        reportToken: "report-token",
        reportUrl: "/reports/scan_123",
        scanId: "scan_123"
      });
    }).not.toThrow();
    expect(readPaidReportAccess("scan_123")).toBeNull();
  });
});

function setWindowLocalStorage(storage: Map<string, string>) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { origin: "https://id.example.com" },
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        }
      }
    }
  });
}
