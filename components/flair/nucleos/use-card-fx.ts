"use client";
/**
 * Efeito de entrada da carta: quando uma carta é vestida ou trocada na preparação, calcula o efeito (nível, selo, Aura
 * Hype), publica para a cena (fx-events), toca o som e mantém o efeito na tela por até 1 segundo.
 */
import { useEffect, useRef, useState } from "react";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { cartasVestidas, entradaDaCarta, ENTRADA_MS, type EntradaFx } from "@/lib/flair/nucleos/card-fx";
import { emitirFx } from "@/lib/flair/nucleos/fx-events";
import { tocarFx, type FxPrefs } from "@/lib/flair/nucleos/fx-sound";
import type { EfeitoItem, NucleoCodigo } from "@/lib/flair/nucleos/types";

export interface CardFxOptions {
  nucleo: NucleoCodigo;
  /** cartas vestidas por vaga */
  vestidas: Record<string, string>;
  cards: FlairCollectionCard[];
  itens: (cardId: string) => EfeitoItem[] | undefined;
  /** só na preparação há efeito de entrada */
  ativo: boolean;
  reduzido: boolean;
  prefs: FxPrefs;
}

export interface EntradaNaTela {
  entrada: EntradaFx;
  card: FlairCollectionCard;
  /** muda a cada carta vestida: reinicia a animação mesmo se a mesma carta voltar */
  chave: number;
}

export function useCardFx(opts: CardFxOptions): EntradaNaTela | null {
  const [atual, setAtual] = useState<EntradaNaTela | null>(null);
  const antes = useRef(opts.vestidas);
  const contador = useRef(0);
  const ref = useRef(opts);
  ref.current = opts;

  useEffect(() => {
    const novas = cartasVestidas(antes.current, opts.vestidas);
    antes.current = opts.vestidas;
    const o = ref.current;
    const ultima = novas[novas.length - 1];
    const card = ultima && o.cards.find((c) => c.id === ultima.cardId);
    if (!o.ativo || !ultima || !card) return;
    const entrada = entradaDaCarta(card, ultima.vaga, o.itens(card.id));
    contador.current += 1;
    setAtual({ entrada, card, chave: contador.current });
    emitirFx({ tipo: "entrada", nucleo: o.nucleo, entrada, reduzido: o.reduzido });
    tocarFx(entrada.som, o.prefs.som);
  }, [opts.vestidas]);

  useEffect(() => {
    if (!atual) return;
    const timer = window.setTimeout(() => setAtual(null), ENTRADA_MS);
    return () => window.clearTimeout(timer);
  }, [atual]);

  useEffect(() => {
    if (!opts.ativo) setAtual(null);
  }, [opts.ativo]);

  return atual;
}
