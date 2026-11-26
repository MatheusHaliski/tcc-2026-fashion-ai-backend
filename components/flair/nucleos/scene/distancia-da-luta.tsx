"use client";
/**
 * Escreve, a cada quadro, quanto a lutadora do Dress Fighter recuou da marca dela (a oponente fica do lado +x): a tela lê
 * esse valor ao jogar a carta e manda a faixa PERTO ou LONGE ao servidor (lib/flair/nucleos/luta-distancia.ts).
 */
import { useEffect, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Jogador } from "@/components/flair/nucleos/scene/andarilho";
import { definirRecuoDaLutadora } from "@/lib/flair/nucleos/luta-distancia";

export function DistanciaDaLuta({ jogador }: { jogador: MutableRefObject<Jogador> }) {
  useFrame(() => definirRecuoDaLutadora(-jogador.current.pos.x));
  useEffect(() => () => definirRecuoDaLutadora(0), []);
  return null;
}
