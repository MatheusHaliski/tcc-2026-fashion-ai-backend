"use client";
/**
 * Tela cheia de verdade (Fullscreen API) para o palco de jogo, pelo botão ou pela tecla F. Onde a API não existe ou
 * recusa (iPhone, iframe sem permissão), o palco entra no modo imersivo: cobre a janela inteira por CSS
 * (`.cst-palco.is-imersivo`), também com a casca do site por baixo.
 */
import { useCallback, useEffect, useState, type RefObject } from "react";

export interface TelaCheia {
  cheia: boolean;
  /** cheia pela Fullscreen API (falso no modo imersivo) */
  nativa: boolean;
  alternar: () => void;
}

export function useTelaCheia(ref: RefObject<HTMLElement | null>): TelaCheia {
  const [nativa, setNativa] = useState(false);
  const [imersiva, setImersiva] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const muda = () => setNativa(!!ref.current && document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", muda);
    return () => document.removeEventListener("fullscreenchange", muda);
  }, [ref]);
  const alternar = useCallback(() => {
    const el = ref.current;
    if (typeof document === "undefined" || !el) return;
    if (imersiva) return setImersiva(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
      return;
    }
    if (typeof el.requestFullscreen !== "function") return setImersiva(true);
    el.requestFullscreen().catch(() => setImersiva(true));
  }, [ref, imersiva]);
  return { cheia: nativa || imersiva, nativa, alternar };
}
