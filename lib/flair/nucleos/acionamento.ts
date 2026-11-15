/** O acionamento da pessoa na janela da ação, no formato da API (POST /api/flair/3d/partidas/{id}/acionar). Puro. */
import type { NucleoAcionamento } from "@/lib/flair/nucleos/types";

/** O que a pessoa acionou na janela da ação: a carta Especial (só `cardId`) ou a troca (`vaga` e `cardId`); vazio = seguir. */
export interface AcionamentoDaPessoa {
  cardId?: string;
  vaga?: string;
  /** Fashion Detective: o alvo do passo */
  alvo?: string;
}

export function corpoDoAcionamento({ cardId, vaga, alvo }: AcionamentoDaPessoa): NucleoAcionamento {
  if (cardId && vaga) return { troca: { vaga, carta: cardId } };
  if (alvo) return cardId ? { carta: cardId, alvo } : { alvo };
  return cardId ? { carta: cardId } : {};
}
