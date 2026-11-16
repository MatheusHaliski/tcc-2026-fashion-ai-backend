"use client";
/**
 * Mantém a vaga em destaque à vista: quando o destaque muda (um toque, a carta posta que leva à próxima vaga vazia,
 * as setas), se a vaga ficou atrás da bandeja presa embaixo ou acima da barra do topo, a página rola só o que falta
 * para ela aparecer inteira entre as duas. Nada muda de tamanho nem de lugar (sem salto de layout); com "reduzir
 * movimento" a rolagem é imediata.
 */
import { useEffect, type RefObject } from "react";

/** Altura da barra fixa do topo do app, mais uma folga. */
const TOPO = 64;
const FOLGA = 12;

/** Quanto rolar (positivo desce) para a faixa [topo, fundo] da vaga caber entre `limiteTopo` e `limiteFundo`. */
export function rolagemParaVer(topo: number, fundo: number, limiteTopo: number, limiteFundo: number): number {
  if (fundo > limiteFundo) return Math.min(fundo - limiteFundo, Math.max(0, topo - limiteTopo));
  if (topo < limiteTopo) return topo - limiteTopo;
  return 0;
}

export function useVagaAVista(vagaId: string, bandeja: RefObject<HTMLElement | null>, reduzido: boolean): void {
  useEffect(() => {
    const vaga = document.querySelector<HTMLElement>(`[data-slot="${vagaId.replace(/["\\]/g, "")}"]`);
    const tray = bandeja.current;
    if (!vaga || !tray || typeof window.scrollBy !== "function") return;
    const r = vaga.getBoundingClientRect();
    const fundo = Math.min(tray.getBoundingClientRect().top, window.innerHeight) - FOLGA;
    const delta = rolagemParaVer(r.top, r.bottom, TOPO + FOLGA, fundo);
    if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: reduzido ? "auto" : "smooth" });
  }, [vagaId, bandeja, reduzido]);
}
