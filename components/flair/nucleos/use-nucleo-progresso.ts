"use client";
/**
 * A campanha da pessoa no jogo (rodadas vencidas, estrelas, o que abre a seguir, o ponto da história), lida do servidor
 * ao abrir a tela e de novo quando uma partida fecha. Sem resposta (fora do ar), fica nula: a tela não marca nem trava
 * nada, e o servidor continua decidindo ao abrir a partida.
 */
import { useApi } from "@/lib/hooks/use-api";
import { buscarProgresso } from "@/lib/flair/nucleos/api";
import type { NucleoProgresso } from "@/lib/flair/nucleos/progresso";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

export function useNucleoProgresso(codigo: NucleoCodigo, ativo = true) {
  const q = useApi<NucleoProgresso>((signal) => buscarProgresso(codigo, signal), [codigo], { enabled: ativo });
  const progresso = q.data && Array.isArray(q.data.rodadas) ? q.data : null;
  return { progresso, carregando: q.loading && !q.data, recarregar: q.reload };
}
