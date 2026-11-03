import { useEffect, useRef } from "react";

/**
 * Atalhos do quarto no teclado: V/Shift+V trocam o ponto de vista, L acende/apaga, 1–5 voltam a uma vista salva e
 * Shift+1–5 salvam a câmera de agora. Os atalhos chamam sempre as ações da renderização mais recente.
 */
export function useRoomKeys(gl: boolean | null, { cycleView, toggleLight, saveFavorite, recallFavorite }: {
  cycleView: (step: number) => void; toggleLight: () => Promise<void>; saveFavorite: (slot: number) => void; recallFavorite: (slot: number) => void;
}) {
  // atalhos do quarto no teclado: V/Shift+V trocam o ponto de vista, L acende/apaga, 1–5 voltam a uma vista salva e
  // Shift+1–5 salvam a câmera de agora (Ctrl/⌘+número troca de aba no navegador: fica de fora). Nunca dentro de um
  // campo de texto ou de um diálogo aberto.
  const keyActions = useRef({ cycleView, toggleLight, saveFavorite, recallFavorite }); keyActions.current = { cycleView, toggleLight, saveFavorite, recallFavorite };
  useEffect(() => {
    if (!gl) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || el?.closest("input,textarea,select,[contenteditable=true],[role=dialog]")) return;
      const k = keyActions.current, digit = /^Digit([1-5])$/.exec(e.code);
      if (e.code === "KeyV") { e.preventDefault(); k.cycleView(e.shiftKey ? -1 : 1); }
      else if (e.code === "KeyL") { e.preventDefault(); void k.toggleLight(); }
      else if (digit) { e.preventDefault(); if (e.shiftKey) k.saveFavorite(Number(digit[1])); else k.recallFavorite(Number(digit[1])); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gl]);
}
