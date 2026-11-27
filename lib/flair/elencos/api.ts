/** Chamadas da API dos elencos (logado; só cartas da própria pessoa, 422 caso contrário). */
import { api } from "@/lib/api/client";
import type { ElencoConferencia, ElencoDefinicao, ElencoEntregaResultado, ElencoResumo } from "@/lib/flair/elencos/types";

const BASE = "/api/flair/elencos";

export function listarElencos(signal?: AbortSignal): Promise<{ elencos: ElencoResumo[] }> {
  return api.get<{ elencos: ElencoResumo[] }>(BASE, { signal });
}

export function buscarElenco(codigo: string, signal?: AbortSignal): Promise<ElencoDefinicao> {
  return api.get<ElencoDefinicao>(`${BASE}/${encodeURIComponent(codigo)}`, { signal });
}

export function conferirElenco(codigo: string, cartas: Record<string, string>, signal?: AbortSignal): Promise<ElencoConferencia> {
  return api.post<ElencoConferencia>(`${BASE}/${encodeURIComponent(codigo)}/conferir`, { cartas }, { signal });
}

export function entregarElenco(codigo: string, cartas: Record<string, string>): Promise<ElencoEntregaResultado> {
  return api.post<ElencoEntregaResultado>(`${BASE}/${encodeURIComponent(codigo)}/entrega`, { cartas });
}
