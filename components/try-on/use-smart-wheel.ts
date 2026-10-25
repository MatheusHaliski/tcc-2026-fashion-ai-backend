"use client";

import { useEffect, useState, type RefObject } from "react";
import type { FittingDetailApi } from "@/lib/scene3d/orbit-steps";
import {
  ENGAGE_MS, PAGE_MOMENTUM_MS, afterWheel, initialWheelState, wheelIntent, wheelPixels, type WheelState,
} from "@/lib/scene3d/wheel-intent";

/** quanto tempo a dica "clique no palco para usar a roda na câmera" fica visível */
export const WHEEL_HINT_MS = 1800;
/** a pinça do trackpad chega em passos pequenos (ctrlKey); o OrbitControls também multiplica por 10 */
const PINCH_GAIN = 10;

/**
 * Rolagem inteligente no palco do provador (lib/scene3d/wheel-intent.ts decide): a roda em cima do 3D só move a
 * câmera quando a intenção é clara; senão a página rola normalmente, sem prender. O ouvinte fica no palco em fase de
 * captura e não deixa a roda chegar ao OrbitControls (o arrasto e a pinça no toque continuam com ele). Painel e botões
 * por cima do palco não entram: a roda ali é da página. Devolve se a dica deve aparecer.
 */
export function useSmartWheel(stage: RefObject<HTMLElement | null>, detail: FittingDetailApi | null | undefined): boolean {
  const [hint, setHint] = useState(false);
  useEffect(() => {
    const el = stage.current; if (!el || !detail) return;
    let s: WheelState = initialWheelState(), timer: ReturnType<typeof setTimeout> | undefined;
    const now = () => performance.now();
    const over3d = (e: Event) => e.target instanceof Element && e.target.closest("canvas") !== null;
    const onWheel = (e: WheelEvent) => {
      if (!over3d(e)) return;
      e.stopPropagation();
      const t = now(), cold = t - s.lastPageScrollAt >= PAGE_MOMENTUM_MS, intent = wheelIntent(e, t, s);
      if (intent === "camera") {
        const consumed = detail.wheel(wheelPixels(e) * (e.ctrlKey ? PINCH_GAIN : 1), e.ctrlKey);
        if (consumed || e.ctrlKey) e.preventDefault();          // a pinça em cima do palco nunca vira zoom da página
        s = afterWheel(s, intent, consumed, t);
        return;
      }
      // rolagem "fria" sobre o palco foi para a página: dica breve de como usar a roda na câmera
      if (cold && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        setHint(true); clearTimeout(timer); timer = setTimeout(() => setHint(false), WHEEL_HINT_MS);
      }
    };
    const engage = () => { s = { ...s, engagedUntil: now() + ENGAGE_MS }; clearTimeout(timer); setHint(false); };
    const enter = (e: PointerEvent) => { if (e.pointerType !== "touch") s = { ...s, hoverSince: now() }; };
    // o ponteiro que só "chegou" no palco porque a página rolou não conta; mexer o mouse depois que a página parou, sim
    // (movimento zero é o evento sintético que o navegador manda ao fim da rolagem)
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch" || !(e.movementX || e.movementY)) return;
      if (s.hoverSince === null || s.hoverSince <= s.lastPageScrollAt) s = { ...s, hoverSince: now() };
    };
    const leave = () => { s = { ...s, hoverSince: null }; };
    const scrolled = () => { s = { ...s, lastPageScrollAt: now() }; };
    el.addEventListener("wheel", onWheel, { capture: true, passive: false });
    el.addEventListener("pointerdown", engage, true);
    el.addEventListener("keydown", engage, true);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", scrolled, { capture: true, passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel, { capture: true });
      el.removeEventListener("pointerdown", engage, true);
      el.removeEventListener("keydown", engage, true);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", scrolled, { capture: true });
      clearTimeout(timer); setHint(false);
    };
  }, [stage, detail]);
  return hint;
}
