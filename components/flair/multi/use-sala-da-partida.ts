"use client";
/**
 * A sala da partida quando o jogo abre com ?sala= (modo mesma semente): a tela do jogo é a mesma, mas a partida abre
 * pela sala (semente e rodada dela) e a faixa da sala mostra a outra pessoa. Sem ?sala=, nada muda (single player).
 */
import { useSearchParams } from "next/navigation";
import { useApi } from "@/lib/hooks/use-api";
import { buscarSala } from "@/lib/flair/multi/api";
import { POLLING_MS } from "@/lib/flair/multi/filtros";
import type { Sala } from "@/lib/flair/multi/types";

export interface SalaDaPartida {
  id: string;
  rodada: string | null;
}

export function useSalaDaPartida(jogo: string) {
  const id = useSearchParams()?.get("sala") ?? null;
  const sala = useApi<Sala>((signal) => buscarSala(id ?? "", signal), [id], { enabled: !!id, refreshInterval: POLLING_MS * 5 });
  const valida = sala.data && sala.data.jogo === jogo && sala.data.modo === "ASSINCRONO" ? sala.data : null;
  const daPartida: SalaDaPartida | null = valida ? { id: valida.id, rodada: valida.rodada ?? null } : null;
  return { id, sala: valida, daPartida, carregando: !!id && sala.loading && !sala.data };
}
