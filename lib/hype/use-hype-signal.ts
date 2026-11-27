"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { tr } from "@/lib/i18n/core";
import { announceHype } from "./hype-announcer";
import { activeHypeSignal, HYPE_SIGNAL_MS, observeHype, revealHype, subscribeHypeSignal, type HypeLive, type HypeSignal } from "./hype-signal-store";

/** "Reduzir movimento" do app (data-reduce-motion no <html>) ou do sistema: o sinal vira cor estática. */
export function prefersReducedMotion(): boolean {
  if (typeof document === "undefined") return false;
  if (document.documentElement.dataset.reduceMotion === "true") return true;
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Card "de fato visível": ≥ 50% dele na tela, ou ocupando ao menos metade da tela (cards ampliados mais altos que ela). */
export function isMostlyVisible(entry: IntersectionObserverEntry): boolean {
  if (!entry.isIntersecting) return false;
  if (entry.intersectionRatio >= 0.5) return true;
  return !!entry.rootBounds && entry.rootBounds.height > 0 && entry.intersectionRect.height >= entry.rootBounds.height * 0.5;
}

/** Assina o sinal em exibição da entidade: re-renderiza quando ele toca e quando expira (HYPE_SIGNAL_MS). */
export function useHypeSignal(live?: Pick<HypeLive, "scope" | "key" | "enabled"> | null): HypeSignal | undefined {
  const scope = live?.scope ?? null;
  const key = live?.enabled ? live.key : "";
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!key) return;
    return subscribeHypeSignal(scope, key, () => setTick((n) => n + 1));
  }, [scope, key]);
  const signal = key ? activeHypeSignal(scope, key) : undefined;
  const seq = signal?.seq;
  const at = signal?.at;
  useEffect(() => {
    if (seq === undefined || at === undefined) return;
    const timer = setTimeout(() => setTick((n) => n + 1), Math.max(0, HYPE_SIGNAL_MS - (Date.now() - at)));
    return () => clearTimeout(timer);
  }, [seq, at]);
  return signal;
}

/**
 * Conduz o evento de uma superfície: registra o score exibido na memória da pessoa, observa a visibilidade do elemento
 * (IntersectionObserver, ≥ 50%) e toca a mudança pendente só quando o card aparece; anuncia uma vez (com throttle global).
 */
export function useHypeSignalDriver(element: Element | null, live: HypeLive | undefined, score: number | null): HypeSignal | undefined {
  const enabled = !!live?.enabled && score !== null;
  const scope = live?.scope ?? null;
  const key = live?.key ?? "";
  const visible = useRef(false);
  const reveal = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    const signal = revealHype(scope, key);
    if (signal) announceHype(tr(signal.direction === "up" ? "hypeLive.up" : "hypeLive.down", { n: Math.abs(signal.delta) }));
  }, [scope, key]);

  useEffect(() => {
    if (!enabled || !element) return;
    const onPageVisible = () => {
      if (visible.current) reveal();
    };
    document.addEventListener("visibilitychange", onPageVisible);
    if (typeof IntersectionObserver === "undefined") {
      visible.current = true;
      reveal();
      return () => {
        visible.current = false;
        document.removeEventListener("visibilitychange", onPageVisible);
      };
    }
    const io = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      visible.current = !!last && isMostlyVisible(last);
      if (visible.current) reveal();
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    io.observe(element);
    return () => {
      io.disconnect();
      visible.current = false;
      document.removeEventListener("visibilitychange", onPageVisible);
    };
  }, [enabled, element, reveal]);

  const dims = live?.dims;
  const dimsKey = JSON.stringify(dims ?? {});
  const version = live?.version;
  useEffect(() => {
    if (!enabled || score === null) return;
    observeHype(scope, key, score, dims ?? {}, version);
    if (visible.current) reveal();
    // dimsKey representa `dims` (objeto novo a cada render)
  }, [enabled, scope, key, score, dimsKey, version, reveal]); // eslint-disable-line react-hooks/exhaustive-deps

  return useHypeSignal(enabled ? live : null);
}
