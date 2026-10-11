"use client";
import { useEffect, useRef } from "react";

/** Refresh only while visible; serialize requests and cancel when leaving the view. */
export function useVisibleRefresh(refresh: (signal: AbortSignal) => Promise<unknown>, enabled = true, interval = 30_000) {
  const ref = useRef(refresh);
  ref.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    let active: AbortController | null = null;
    const run = async () => {
      if (document.visibilityState === "hidden" || active) return;
      const controller = new AbortController();
      active = controller;
      try { await ref.current(controller.signal); }
      catch { /* Keep the last successful results; retry on the next interval. */ }
      finally { if (active === controller) active = null; }
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") { active?.abort(); }
      else void run();
    };
    const timer = window.setInterval(() => void run(), interval);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", run);
    return () => {
      clearInterval(timer);
      active?.abort();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", run);
    };
  }, [enabled, interval]);
}
