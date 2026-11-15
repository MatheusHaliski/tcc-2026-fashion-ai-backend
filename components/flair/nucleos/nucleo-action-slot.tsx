"use client";
/**
 * A faixa do deck durante a ação: o painel com o que já aconteceu (nucleo-action-panel) e, nos jogos que têm um, o
 * acionamento da pessoa (nucleo-trigger: a carta Especial, a troca do intervalo, o balcão do mercado).
 */
import type { ApiError } from "@/lib/api/client";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { NucleoActionPanel } from "@/components/flair/nucleos/nucleo-action-panel";
import { NucleoTrigger, type AcionamentoPedido } from "@/components/flair/nucleos/nucleo-trigger";
import type { useNucleoAction } from "@/components/flair/nucleos/use-nucleo-action";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

interface Props {
  nucleo: NucleoCodigo;
  /** a modalidade escolhida (Fashion Sports) */
  variante?: string | null;
  acao: ReturnType<typeof useNucleoAction>;
  /** a pessoa já acionou nesta etapa (vale até o servidor responder) */
  acionou: boolean;
  cartas: FlairCollectionCard[];
  vestidas: Record<string, string>;
  vagas: string[];
  ocupado: boolean;
  erro: ApiError | null;
  /** a ação que a cor da carta dispara ao entrar em campo */
  acaoDe: (cardId: string) => string | null;
  onAcionar?: (pedido: AcionamentoPedido) => void;
}

export function NucleoActionSlot({ nucleo, variante, acao, acionou, cartas, vestidas, vagas, ocupado, erro, acaoDe, onAcionar }: Props) {
  return (
    <NucleoActionPanel nucleo={nucleo} variante={variante} passos={acao.passos} mostrados={acao.mostrados} onPular={acao.pular} esperando={acao.aberta}>
      {acao.tipo && (
        <NucleoTrigger
          tipo={acao.tipo}
          aberta={acao.aberta}
          usado={acao.usado || acionou}
          cartas={cartas}
          vestidas={vestidas}
          vagas={vagas}
          ocupado={ocupado}
          erro={erro}
          acaoDe={acaoDe}
          onAcionar={onAcionar}
        />
      )}
    </NucleoActionPanel>
  );
}
