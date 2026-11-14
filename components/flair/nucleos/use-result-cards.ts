"use client";
/**
 * As cartas que pontuaram no resultado, na ordem em que brilham uma a uma: o brilho de cada vaga na régua e a lista do
 * painel do resultado, com os pontos que o servidor deu a cada carta (`cartas` do resultado).
 */
import { useMemo } from "react";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import type { CartaNoResultado } from "@/components/flair/nucleos/nucleo-result";
import type { BrilhoDaVaga } from "@/components/flair/nucleos/nucleo-slot-ruler";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { cartasQuePontuaram } from "@/lib/flair/nucleos/action-fx";
import type { Momento } from "@/lib/flair/nucleos/moments";
import type { EfeitoItem, NucleoResultado } from "@/lib/flair/nucleos/types";

export interface ResultCardsOptions {
  momento: Momento;
  resultado: NucleoResultado | null;
  /** cartas vestidas por vaga (com a troca do intervalo, quando houve) */
  vestidas: Record<string, string>;
  cards: FlairCollectionCard[];
  efeitos: Map<string, EfeitoItem[]>;
}

export function useResultCards({ momento, resultado, vestidas, cards, efeitos }: ResultCardsOptions) {
  const tx = useNucleoText();
  return useMemo(() => {
    const pontuadas = momento === "RESULTADO" && resultado ? cartasQuePontuaram(resultado, vestidas, cards, efeitos) : [];
    const brilho: Record<string, BrilhoDaVaga> = {};
    const lista: CartaNoResultado[] = [];
    pontuadas.forEach((p, ordem) => {
      let texto = "";
      if (p.pontos != null) texto = tx.pontos(p.pontos);
      else if (p.selo) texto = tx.efeito(p.selo);
      brilho[p.vaga] = { ordem, texto };
      lista.push({ cardId: p.cardId, nome: cards.find((c) => c.id === p.cardId)?.name ?? "", texto });
    });
    return { brilho, lista };
  }, [momento, resultado, vestidas, cards, efeitos, tx]);
}
