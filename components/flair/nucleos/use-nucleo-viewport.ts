"use client";
/**
 * Porte e proporção do quadro da tela de jogo, lidos do viewport (lib/flair/nucleos/quadro.ts). As classes e as
 * medidas das cartas saem daqui; o estado só muda quando o porte ou a proporção mudam, não a cada pixel.
 */
import { useEffect, useState } from "react";
import { quadroDoViewport, type QuadroLayout } from "@/lib/flair/nucleos/quadro";

function ler(): QuadroLayout {
  if (typeof window === "undefined") return quadroDoViewport(360, 780);
  return quadroDoViewport(window.innerWidth, window.innerHeight);
}

export function useNucleoViewport(): QuadroLayout {
  const [layout, setLayout] = useState<QuadroLayout>(ler);
  useEffect(() => {
    const medir = () => {
      const novo = ler();
      setLayout((atual) => (atual.porte === novo.porte && atual.quadro === novo.quadro ? atual : novo));
    };
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("orientationchange", medir);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("orientationchange", medir);
    };
  }, []);
  return layout;
}
