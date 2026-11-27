"use client";
/**
 * O Fashion Sports na tela de jogo: lê do que o servidor mandou a modalidade, os lances que já apareceram, a jogada da
 * vez com a mão de cartas, o resumo final e as cores do uniforme da pessoa (as das peças vestidas no time).
 */
import { useMemo } from "react";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { cartasDaMao, type CartaNaMao } from "@/components/flair/esporte/esporte-painel";
import { UNIFORME_DA_CASA, type Uniforme } from "@/lib/flair/esporte/campo";
import { comoJogada, modalidadeDe, resumoDe, situacaoDe, type Jogada, type Resumo, type Situacao } from "@/lib/flair/esporte/types";
import type { PassoAcao } from "@/lib/flair/nucleos/action-fx";
import { corDoEfeito, efeitoDaCor } from "@/lib/flair/nucleos/card-fx";
import type { EfeitoItem, NucleoResultado } from "@/lib/flair/nucleos/types";

/** Quanto cada lance fica na tela, em ms. */
export const LANCE_MS = 1700;
/** Os eventos da partida que viram passo na tela (os outros só carregam dados). */
export const PASSOS_DO_ESPORTE = new Set(["JOGADA", "INTERVALO"]);

export interface EsporteNaTela {
  modalidade: string;
  jogadas: Jogada[];
  situacao: Situacao | null;
  mao: CartaNaMao[];
  resumo: Resumo | null;
  uniforme: Uniforme;
  /** lances em que uma carta da pessoa agiu, para o resumo final */
  comCarta: Jogada[];
}

interface Entrada {
  resultado: NucleoResultado | null;
  /** a modalidade escolhida na preparação (vale até o servidor responder) */
  escolhida: string | null;
  passos: PassoAcao[];
  mostrados: number;
  /** a janela da jogada abriu (tudo o que o servidor mandou já passou na tela) */
  aberta: boolean;
  cartas: FlairCollectionCard[];
  vestidas: Record<string, string>;
  itens: (cardId: string) => EfeitoItem[] | undefined;
}

export function useEsporte({ resultado, escolhida, passos, mostrados, aberta, cartas, vestidas, itens }: Entrada): EsporteNaTela {
  const jogadas = useMemo(() => {
    const out: Jogada[] = [];
    for (const p of passos.slice(0, mostrados)) {
      const j = p.codigo === "JOGADA" ? comoJogada(p.valor) : null;
      if (j) out.push(j);
    }
    return out;
  }, [passos, mostrados]);
  const situacao = useMemo(() => (aberta ? situacaoDe(resultado) : null), [aberta, resultado]);
  const mao = useMemo(() => cartasDaMao(situacao?.mao ?? [], cartas, itens), [situacao, cartas, itens]);
  const uniforme = useMemo<Uniforme>(() => {
    const cor = (vaga: string, padrao: string) => corDoEfeito(efeitoDaCor(itens(vestidas[vaga] ?? ""))) ?? padrao;
    return { camisa: cor("SUP", UNIFORME_DA_CASA.camisa), calcao: cor("INF", UNIFORME_DA_CASA.calcao), calcado: cor("CAL", UNIFORME_DA_CASA.calcado) };
  }, [vestidas, itens]);
  return {
    modalidade: modalidadeDe(resultado, escolhida ?? "FUTEBOL"),
    jogadas,
    situacao,
    mao,
    resumo: useMemo(() => resumoDe(resultado), [resultado]),
    uniforme,
    comCarta: useMemo(() => jogadas.filter((j) => !!j.carta), [jogadas]),
  };
}
