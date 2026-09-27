"use client";
import { useEffect, useRef } from "react";
import type { PieceView } from "@/lib/api/types";

/** A peça mudou no detalhe (favorita, disponível, dados, foto): as grades abertas atualizam o card sem recarregar. */
const PIECE_EVENT = "fai:piece-updated";

export function emitPieceUpdate(p: PieceView) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<PieceView>(PIECE_EVENT, { detail: p }));
}

export function usePieceUpdates(onUpdate: (p: PieceView) => void) {
  const ref = useRef(onUpdate); ref.current = onUpdate;
  useEffect(() => {
    const h = (e: Event) => ref.current((e as CustomEvent<PieceView>).detail);
    window.addEventListener(PIECE_EVENT, h); return () => window.removeEventListener(PIECE_EVENT, h);
  }, []);
}
