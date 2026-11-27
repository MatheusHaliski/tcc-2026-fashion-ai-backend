/** Chamadas da API do multiplayer do FLAIR 3D (docs/flair/flair-3d/MULTIPLAYER.md). */
import { api } from "@/lib/api/client";
import type { NucleoPartida } from "@/lib/flair/nucleos/types";
import { consultaDosFiltros } from "@/lib/flair/multi/filtros";
import type { BuscaAdversarios, CaixaMulti, ConvitePedido, FiltrosAdversario, Historico, Sala } from "@/lib/flair/multi/types";

const BASE = "/api/flair/3d";

export function buscarAdversarios(filtros: FiltrosAdversario, signal?: AbortSignal): Promise<BuscaAdversarios> {
  const qs = consultaDosFiltros(filtros);
  return api.get<BuscaAdversarios>(`${BASE}/adversarios${qs ? `?${qs}` : ""}`, { signal });
}

export function convidar(pedido: ConvitePedido): Promise<Sala> {
  return api.post<Sala>(`${BASE}/convites`, pedido);
}

export function buscarCaixa(signal?: AbortSignal): Promise<CaixaMulti> {
  return api.get<CaixaMulti>(`${BASE}/convites`, { signal });
}

export function buscarSala(id: string, signal?: AbortSignal): Promise<Sala> {
  return api.get<Sala>(`${BASE}/salas/${id}`, { signal });
}

export type AcaoDoConvite = "aceitar" | "recusar" | "cancelar";

export function responderConvite(id: string, acao: AcaoDoConvite): Promise<Sala> {
  return api.post<Sala>(`${BASE}/salas/${id}/${acao}`, {});
}

export function revanche(id: string): Promise<Sala> {
  return api.post<Sala>(`${BASE}/salas/${id}/revanche`, {});
}

/** Abre a partida do seu lado da sala com a semente e a rodada dela (mesma resposta da abertura solo, mais `sala`). */
export function abrirPartidaDaSala(id: string, deck: string[], avatar?: string | null): Promise<NucleoPartida> {
  return api.post<NucleoPartida>(`${BASE}/salas/${id}/partida`, avatar ? { deck, avatar } : { deck });
}

export function registrarLookDaSala(id: string, lookId: string): Promise<Sala> {
  return api.post<Sala>(`${BASE}/salas/${id}/look`, { lookId });
}

export function escolherDeckDaSala(id: string, deck: string[]): Promise<Sala> {
  return api.post<Sala>(`${BASE}/salas/${id}/deck`, { deck });
}

export function lancar(id: string, turno: number, cartas: Record<string, string>): Promise<Sala> {
  return api.post<Sala>(`${BASE}/salas/${id}/lance`, { turno, cartas });
}

export function buscarHistorico(userId: string, signal?: AbortSignal): Promise<Historico> {
  return api.get<Historico>(`${BASE}/historico/${userId}`, { signal });
}
