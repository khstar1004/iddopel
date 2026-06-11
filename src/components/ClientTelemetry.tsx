"use client";

import { useEffect } from "react";

type TelemetryPayload = {
  name: "page_view" | "client_error" | "unhandled_rejection" | "web_vital";
  path: string;
  occurredAt: string;
  metric?: {
    name: "FCP" | "LCP" | "CLS" | "TTFB";
    value: number;
    rating?: "good" | "needs-improvement" | "poor";
  };
  error?: {
    message: string;
    source?: string;
    line?: number;
    column?: number;
  };
};

export function ClientTelemetry() {
  useEffect(() => {
    if (shouldSkipTelemetry()) return;

    sendTelemetry({ name: "page_view", path: window.location.pathname, occurredAt: new Date().toISOString() });
    reportNavigationTiming();

    const onError = (event: ErrorEvent) => {
      sendTelemetry({
        name: "client_error",
        path: window.location.pathname,
        occurredAt: new Date().toISOString(),
        error: {
          message: event.message || "unknown client error",
          source: event.filename ? new URL(event.filename, window.location.href).pathname : undefined,
          line: event.lineno,
          column: event.colno
        }
      });
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      sendTelemetry({
        name: "unhandled_rejection",
        path: window.location.pathname,
        occurredAt: new Date().toISOString(),
        error: { message: errorMessage(event.reason) }
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    const cleanupWebVitals = observeWebVitals();
    return () => {
      cleanupWebVitals();
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

function sendTelemetry(payload: TelemetryPayload) {
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon("/api/telemetry", blob)) return;
  }

  fetch("/api/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true
  }).catch(() => undefined);
}

function reportNavigationTiming() {
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (!navigation || navigation.responseStart <= 0) return;

  sendTelemetry({
    name: "web_vital",
    path: window.location.pathname,
    occurredAt: new Date().toISOString(),
    metric: { name: "TTFB", value: navigation.responseStart, rating: ratingFor("TTFB", navigation.responseStart) }
  });
}

function observeWebVitals() {
  const observers: PerformanceObserver[] = [];
  let clsValue = 0;
  let lcpValue = 0;

  if (!("PerformanceObserver" in window)) return () => undefined;

  try {
    const paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          sendTelemetry({
            name: "web_vital",
            path: window.location.pathname,
            occurredAt: new Date().toISOString(),
            metric: { name: "FCP", value: entry.startTime, rating: ratingFor("FCP", entry.startTime) }
          });
        }
      }
    });
    paintObserver.observe({ type: "paint", buffered: true });
    observers.push(paintObserver);
  } catch {
    // Unsupported observer types are expected in older embedded browsers.
  }

  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) lcpValue = last.startTime;
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    observers.push(lcpObserver);
  } catch {
    // Unsupported observer types are expected in older embedded browsers.
  }

  try {
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
        if (!layoutShift.hadRecentInput && typeof layoutShift.value === "number") {
          clsValue += layoutShift.value;
        }
      }
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });
    observers.push(clsObserver);
  } catch {
    // Unsupported observer types are expected in older embedded browsers.
  }

  const flush = () => {
    if (lcpValue > 0) {
      sendTelemetry({
        name: "web_vital",
        path: window.location.pathname,
        occurredAt: new Date().toISOString(),
        metric: { name: "LCP", value: lcpValue, rating: ratingFor("LCP", lcpValue) }
      });
    }
    sendTelemetry({
      name: "web_vital",
      path: window.location.pathname,
      occurredAt: new Date().toISOString(),
      metric: { name: "CLS", value: clsValue, rating: ratingFor("CLS", clsValue) }
    });
  };

  window.addEventListener("pagehide", flush, { once: true });
  return () => {
    window.removeEventListener("pagehide", flush);
    observers.forEach((observer) => observer.disconnect());
  };
}

function shouldSkipTelemetry() {
  return navigator.doNotTrack === "1" || process.env.NEXT_PUBLIC_TELEMETRY_DISABLED === "true";
}

function errorMessage(reason: unknown) {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  return "unknown rejected promise";
}

function ratingFor(name: NonNullable<TelemetryPayload["metric"]>["name"], value: number): NonNullable<TelemetryPayload["metric"]>["rating"] {
  if (name === "CLS") {
    if (value <= 0.1) return "good";
    if (value <= 0.25) return "needs-improvement";
    return "poor";
  }

  const thresholds = name === "LCP" ? [2500, 4000] : name === "FCP" ? [1800, 3000] : [800, 1800];
  if (value <= thresholds[0]) return "good";
  if (value <= thresholds[1]) return "needs-improvement";
  return "poor";
}
