/** Chamadas da regra peça-recurso numa partida (Flair3dRecursoController). */
import { api } from "@/lib/api/client";
import type { RecursosDaPartida } from "@/lib/flair/recursos/types";
import type { TrunfoNaPartida } from "@/lib/flair/nucleos/aura-na-partida";

const BASE = "/api/flair/3d/partidas";

export function buscarRecursos(partida: string, signal?: AbortSignal): Promise<RecursosDaPartida> {
  return api.get<RecursosDaPartida>(`${BASE}/${encodeURIComponent(partida)}/recursos`, { signal });
}

/** `pedido`: identificador do toque; repetido (rede lenta, clique duplo), o servidor devolve a mesma resposta sem gastar. */
export function usarPeca(partida: string, carta: string, pedido: string): Promise<RecursosDaPartida> {
  return api.post<RecursosDaPartida>(`${BASE}/${encodeURIComponent(partida)}/usar`, { carta, pedido });
}

/** O trunfo do Hype (rodada 8g): chama o Hype de uma carta do deck, uma vez por partida; o Hype real não muda. */
export function chamarHype(partida: string, carta: string, pedido: string): Promise<{ hype: TrunfoNaPartida }> {
  return api.post<{ hype: TrunfoNaPartida }>(`${BASE}/${encodeURIComponent(partida)}/hype`, { carta, pedido });
}
