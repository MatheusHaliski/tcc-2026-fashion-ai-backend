"use client";
/**
 * Os jogos em que a partida inteira se joga com cartas, depois da entrega, trocam o palco e a faixa de baixo da tela de
 * jogo (nucleo-game.tsx): o Fashion Sports (transmissão e mão de cartas) e o Fashion Detective do caso "A Coleção Maré"
 * (sala explorável e painel de ações; a rodada SALOES_DA_GALA continua no fluxo antigo). Este hook monta os dois
 * pedaços; nos outros jogos devolve nulo e a tela usa o palco e a ação de sempre.
 */
import type { ReactNode } from "react";
import type { ApiError } from "@/lib/api/client";
import type { Look3dPiece } from "@/components/three/common";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { EsportePainel } from "@/components/flair/esporte/esporte-painel";
import { EsportePalco } from "@/components/flair/esporte/esporte-palco";
import { LANCE_MS, useEsporte, type EsporteNaTela } from "@/components/flair/esporte/use-esporte";
import { cartasDoDetetive, DetetivePainel } from "@/components/flair/detetive/detetive-painel";
import { DetetivePalco } from "@/components/flair/detetive/detetive-palco";
import type { Protagonista } from "@/components/flair/nucleos/nucleo-avatar";
import type { AcionamentoPedido } from "@/components/flair/nucleos/nucleo-trigger";
import { retratoDe } from "@/lib/flair/detetive/types";
import type { PassoAcao } from "@/lib/flair/nucleos/action-fx";
import type { EfeitoItem, NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

/** A rodada de 14/11 do Fashion Detective (salões automáticos), que segue no fluxo antigo. */
export const SALOES_DA_GALA = "SALOES_DA_GALA";

interface Entrada {
  codigo: NucleoCodigo;
  rodada: string | null | undefined;
  momento: string;
  resultado: NucleoResultado | null;
  escolhida: string | null;
  acao: { passos: PassoAcao[]; mostrados: number; aberta: boolean; pular: () => void };
  cartas: FlairCollectionCard[];
  vestidas: Record<string, string>;
  itens: (cardId: string) => EfeitoItem[] | undefined;
  pecas: Look3dPiece[];
  protagonista: Protagonista;
  semente: number | undefined;
  ocupado: boolean;
  erro: ApiError | null;
  acionar: (pedido: AcionamentoPedido) => void;
}

export interface ModoPorCartas {
  palco: ReactNode | null;
  acao: ReactNode | null;
  esporte: EsporteNaTela;
  /** o Fashion Detective do caso novo (o palco fica a sala mesmo no resultado, para a cutscene final) */
  detetive: boolean;
}

export function useModoPorCartas(e: Entrada): ModoPorCartas {
  const preparando = e.momento === "PREPARACAO";
  const esporte = useEsporte({ resultado: e.resultado, escolhida: e.escolhida, passos: e.acao.passos, mostrados: e.acao.mostrados, aberta: e.acao.aberta, cartas: e.cartas, vestidas: e.vestidas, itens: e.itens });
  const retrato = e.codigo === "FASHION_DETECTIVE" && e.rodada !== SALOES_DA_GALA ? retratoDe(e.resultado) : null;
  if (e.codigo === "FASHION_SPORTS" && !preparando) {
    return {
      esporte,
      detetive: false,
      palco: <EsportePalco modalidade={esporte.modalidade} jogadas={esporte.jogadas} duracao={LANCE_MS} uniforme={esporte.uniforme} fim={e.momento === "RESULTADO"} semente={e.semente} />,
      acao: <EsportePainel modalidade={esporte.modalidade} jogadas={esporte.jogadas} situacao={esporte.situacao} mao={esporte.mao} ocupado={e.ocupado} erro={e.erro}
        onJogar={(cardId) => e.acionar({ tipo: "CARTA", cardId: cardId ?? undefined })} onPular={e.acao.pular} />,
    };
  }
  if (retrato && !preparando) {
    const onAcao = (alvo: string, cardId?: string) => e.acionar({ tipo: "CARTA", cardId, alvo });
    return {
      esporte,
      detetive: true,
      palco: <DetetivePalco r={retrato} pecas={e.pecas} protagonista={e.protagonista} semente={e.semente ?? 1} ocupado={e.ocupado} onAcao={onAcao} />,
      acao: <DetetivePainel r={retrato} mao={cartasDoDetetive(retrato.mao, e.cartas, e.itens)} ocupado={e.ocupado} erro={e.erro} onAcao={onAcao} />,
    };
  }
  return { esporte, detetive: false, palco: null, acao: null };
}
