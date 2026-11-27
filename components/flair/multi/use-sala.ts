"use client";
/**
 * A sala aberta na tela: lida do servidor a cada 2 s enquanto o convite espera ou o jogo corre (a vez, o lance da outra
 * pessoa e o julgamento vêm sempre do servidor), parada quando a sala fecha. As ações (aceitar, recusar, cancelar,
 * deck, lance, revanche) devolvem a sala nova e a tela passa a mostrá-la na hora.
 */
import { useCallback } from "react";
import { useAction, useApi } from "@/lib/hooks/use-api";
import { buscarSala, escolherDeckDaSala, lancar, responderConvite, revanche, type AcaoDoConvite } from "@/lib/flair/multi/api";
import { POLLING_MS } from "@/lib/flair/multi/filtros";
import type { Sala } from "@/lib/flair/multi/types";

const VIVA = ["CONVIDADO", "JOGANDO"];

export function useSala(id: string) {
  const sala = useApi((signal) => buscarSala(id, signal), [id], { refreshInterval: POLLING_MS });
  const viva = !sala.data || VIVA.includes(sala.data.estado);
  const { setData, reload } = sala;
  /** a resposta de uma ação: lances e deck já trazem a sala inteira; aceite e recusa trazem o resumo, então relê */
  const aplicar = useCallback((nova: Sala | undefined, inteira: boolean) => {
    if (nova && inteira) setData(nova);
    else reload();
  }, [setData, reload]);
  const responder = useAction(async (acao: AcaoDoConvite) => aplicar(await responderConvite(id, acao), false));
  const deck = useAction(async (cartas: string[]) => aplicar(await escolherDeckDaSala(id, cartas), true));
  const lance = useAction(async (turno: number, cartas: Record<string, string>) => aplicar(await lancar(id, turno, cartas), true));
  const nova = useAction(async () => revanche(id));
  return {
    sala: sala.data,
    carregando: sala.loading && !sala.data,
    erro: sala.error,
    viva,
    recarregar: reload,
    responder,
    deck,
    lance,
    revanche: nova,
  };
}
