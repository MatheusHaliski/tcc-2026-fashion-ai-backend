"use client";
import { useCallback, useRef } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { metricRoute } from "@/lib/performance/vitals";

/** Opt-in RUM; exports aggregate performance only, never URLs, account identifiers or tokens. */
export function WebVitals() {
  const sent = useRef(new Map<string, number>());
  useReportWebVitals(useCallback((metric) => {
    if (process.env.NEXT_PUBLIC_RUM_ENABLED !== "true" || !["CLS", "LCP", "INP", "FCP", "TTFB"].includes(metric.name)) return;
    if (sent.current.get(metric.id) === metric.value) return;
    sent.current.set(metric.id, metric.value);
    const width = window.innerWidth;
    void fetch("/bff/metrics", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
      body: JSON.stringify({ name: metric.name, value: metric.value, route: metricRoute(window.location.pathname), device: width < 640 ? "mobile" : width < 1024 ? "tablet" : "desktop" }) }).catch(() => undefined);
  }, []));
  return null;
}
