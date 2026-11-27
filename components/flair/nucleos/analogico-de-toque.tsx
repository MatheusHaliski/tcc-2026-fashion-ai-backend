"use client";
/**
 * O analógico virtual da tela de toque (reauditoria de 25/11/2026: no celular a personagem não andava). Aparece no
 * canto de baixo à esquerda do palco só com ponteiro grosso (dedo) e enquanto o jogo anda livre; arrastar o dedo
 * dentro do círculo escreve o eixo de andar (lib/flair/entrada/eixo-de-andar.ts), o mesmo do WASD e do analógico do
 * controle. Soltar para.
 */
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { PARADO, limitar } from "@/lib/flair/entrada/acoes";
import { definirEixo } from "@/lib/flair/entrada/eixo-de-andar";

const RAIO = 48;

function dedo(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

export function AnalogicoDeToque({ ativo, rotulo }: { ativo: boolean; rotulo: string }) {
  const [visivel, setVisivel] = useState(false);
  const [ponta, setPonta] = useState({ x: 0, y: 0 });
  const centro = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => setVisivel(dedo()), []);
  useEffect(() => () => definirEixo(PARADO), []);
  if (!ativo || !visivel) return null;
  const mover = (e: PointerEvent<HTMLDivElement>) => {
    if (!centro.current) return;
    const v = limitar({ x: (e.clientX - centro.current.x) / RAIO, y: -(e.clientY - centro.current.y) / RAIO });
    setPonta({ x: v.x * RAIO, y: -v.y * RAIO });
    definirEixo(v);
  };
  const soltar = () => {
    centro.current = null;
    setPonta({ x: 0, y: 0 });
    definirEixo(PARADO);
  };
  return (
    <div className="n3d-analogico" role="application" aria-label={rotulo} data-testid="analogico-de-toque"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        centro.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        e.currentTarget.setPointerCapture?.(e.pointerId);
        mover(e);
      }}
      onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
      <span style={{ transform: `translate(${ponta.x}px, ${ponta.y}px)` }} aria-hidden />
    </div>
  );
}
