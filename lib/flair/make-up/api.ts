/** Chamadas da API do FLAIR 3D MAKE UP (logado). */
import { api } from "@/lib/api/client";
import type { BriefDefinicao, BriefLista, MakeUpCarreira, MakeUpEntrega, MakeUpResultado } from "@/lib/flair/make-up/types";

const BASE = "/api/flair/make-up";

export function buscarCarreira(signal?: AbortSignal): Promise<MakeUpCarreira> {
  return api.get<MakeUpCarreira>(`${BASE}/carreira`, { signal });
}

export function listarBriefs(signal?: AbortSignal): Promise<BriefLista> {
  return api.get<BriefLista>(`${BASE}/briefs`, { signal });
}

/** Definição do brief; abaixo do nível mínimo a API responde 403. */
export function buscarBrief(codigo: string, signal?: AbortSignal): Promise<BriefDefinicao> {
  return api.get<BriefDefinicao>(`${BASE}/briefs/${encodeURIComponent(codigo)}`, { signal });
}

export function entregarBrief(codigo: string, entrega: MakeUpEntrega): Promise<MakeUpResultado> {
  return api.post<MakeUpResultado>(`${BASE}/briefs/${encodeURIComponent(codigo)}/entrega`, entrega);
}
