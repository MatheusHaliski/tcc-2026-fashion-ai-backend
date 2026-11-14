"use client";
/**
 * Carta ampliada: abre com toque longo (ou clique longo) numa carta e com a tecla I na carta em foco; fecha com Esc,
 * com I de novo ou pelo botão. O toque longo não veste a carta: o clique que vem em seguida é descartado.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";

/** Tempo do toque longo, em ms. */
export const TOQUE_LONGO_MS = 500;

const CAMPOS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export interface CardZoom {
  ampliada: FlairCollectionCard | null;
  abrir: (card: FlairCollectionCard) => void;
  fechar: () => void;
  /** handlers de toque longo para o botão da carta */
  toque: (card: FlairCollectionCard) => {
    onPointerDown: (e: PointerEvent) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
    onPointerCancel: () => void;
  };
  /** true (uma vez) quando o clique veio logo depois de um toque longo */
  consumirClique: () => boolean;
}

export function useCardZoom(focada: FlairCollectionCard | null, ligado = true): CardZoom {
  const [ampliada, setAmpliada] = useState<FlairCollectionCard | null>(null);
  const timer = useRef<number | null>(null);
  const longo = useRef(false);
  const ref = useRef({ focada, ligado, ampliada });
  ref.current = { focada, ligado, ampliada };

  const soltar = useCallback(() => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const toque = useCallback(
    (card: FlairCollectionCard) => ({
      onPointerDown: (e: PointerEvent) => {
        if (e.button > 0) return;
        soltar();
        longo.current = false;
        timer.current = window.setTimeout(() => {
          longo.current = true;
          setAmpliada(card);
        }, TOQUE_LONGO_MS);
      },
      onPointerUp: soltar,
      onPointerLeave: soltar,
      onPointerCancel: soltar,
    }),
    [soltar],
  );

  const consumirClique = useCallback(() => {
    const foi = longo.current;
    longo.current = false;
    return foi;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const atual = ref.current;
      const alvo = e.target as HTMLElement | null;
      if (!atual.ligado || e.altKey || e.ctrlKey || e.metaKey) return;
      if (alvo?.tagName && (CAMPOS.has(alvo.tagName) || alvo.isContentEditable)) return;
      if (e.key === "Escape" && atual.ampliada) {
        setAmpliada(null);
        e.preventDefault();
      } else if (e.key.toLowerCase() === "i" && (atual.ampliada || atual.focada)) {
        setAmpliada(atual.ampliada ? null : atual.focada);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      soltar();
    };
  }, [soltar]);

  return { ampliada, abrir: setAmpliada, fechar: () => setAmpliada(null), toque, consumirClique };
}
