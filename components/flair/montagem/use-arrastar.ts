"use client";
/**
 * Arrastar uma carta para uma vaga, com mouse, caneta ou dedo (eventos de ponteiro): a carta segue o ponteiro, a vaga
 * embaixo acende e soltar põe a carta. Soltar uma carta que veio de uma vaga sobre a bandeja ([data-drop-remove]) tira
 * a carta. Um toque sem arrasto continua sendo um clique normal.
 */
import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/** vaga = onde soltou; null = soltou sobre a área de tirar. */
export type AoSoltar = (cardId: string, vaga: string | null, origem: string | null) => void;

const LIMIAR = 8;

function alvoEm(x: number, y: number): { vaga: string | null; tirar: boolean; el: Element | null } {
  const el = typeof document.elementFromPoint === "function" ? document.elementFromPoint(x, y) : null;
  const vaga = el?.closest("[data-slot]") ?? null;
  return { vaga: vaga?.getAttribute("data-slot") ?? null, tirar: !vaga && !!el?.closest("[data-drop-remove]"), el: vaga };
}

export function useArrastar(aoSoltar: AoSoltar) {
  const soltar = useRef(aoSoltar);
  soltar.current = aoSoltar;
  const limpar = useRef<() => void>(() => {});
  useEffect(() => () => limpar.current(), []);

  return useCallback((cardId: string, origem: string | null) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const fonte = e.currentTarget;
    const [x0, y0] = [e.clientX, e.clientY];
    let fantasma: HTMLElement | null = null;
    let aceso: Element | null = null;
    const acender = (el: Element | null) => {
      if (aceso === el) return;
      aceso?.removeAttribute("data-drop");
      el?.setAttribute("data-drop", "sim");
      aceso = el;
    };
    const mover = (ev: PointerEvent) => {
      if (!fantasma) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < LIMIAR) return;
        const caixa = fonte.getBoundingClientRect();
        fantasma = fonte.cloneNode(true) as HTMLElement;
        fantasma.classList.add("mt-ghost");
        fantasma.style.width = `${caixa.width}px`;
        fantasma.style.left = `${caixa.left}px`;
        fantasma.style.top = `${caixa.top}px`;
        fantasma.setAttribute("aria-hidden", "true");
        document.body.appendChild(fantasma);
        fonte.setAttribute("data-dragging", "sim");
      }
      fantasma.style.transform = `translate(${ev.clientX - x0}px, ${ev.clientY - y0}px) scale(1.06)`;
      acender(alvoEm(ev.clientX, ev.clientY).el);
    };
    const fim = (ev: PointerEvent) => {
      const arrastou = !!fantasma;
      limpar.current();
      if (!arrastou || ev.type === "pointercancel") return;
      // o clique que o navegador dispara depois de soltar não deve escolher a carta de novo
      const engolir = (c: Event) => c.stopPropagation();
      window.addEventListener("click", engolir, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", engolir, { capture: true }), 60);
      const alvo = alvoEm(ev.clientX, ev.clientY);
      if (alvo.vaga && alvo.vaga !== origem) soltar.current(cardId, alvo.vaga, origem);
      else if (alvo.tirar && origem) soltar.current(cardId, null, origem);
    };
    limpar.current = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", fim);
      window.removeEventListener("pointercancel", fim);
      fantasma?.remove();
      fantasma = null;
      acender(null);
      fonte.removeAttribute("data-dragging");
      limpar.current = () => {};
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", fim);
    window.addEventListener("pointercancel", fim);
  }, []);
}
