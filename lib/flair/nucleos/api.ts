/** Chamadas da API dos núcleos do FLAIR 3D (contrato em docs/flair/flair-3d/BASE_NUCLEOS.md, seção "API"). */
import { api } from "@/lib/api/client";
import type {
  EfeitosResposta,
  NucleoCodigo,
  NucleoDefinicao,
  NucleoEntrega,
  NucleoLista,
  NucleoPartida,
  NucleoResultado,
} from "@/lib/flair/nucleos/types";

const BASE = "/api/flair/3d";

/** Lista dos 15 núcleos (pública). */
export function listarNucleos(signal?: AbortSignal): Promise<NucleoLista> {
  return api.get<NucleoLista>(`${BASE}/nucleos`, { signal, anonymous: true });
}

/** Definição de um núcleo: objetivo, recursos, vagas, zonas, áreas, opções, ações e regras do deck (pública). */
export function buscarNucleo(codigo: NucleoCodigo, signal?: AbortSignal): Promise<NucleoDefinicao> {
  return api.get<NucleoDefinicao>(`${BASE}/nucleos/${codigo}`, { signal, anonymous: true });
}

/** Efeito de cada carta da pessoa neste núcleo (logado; só cartas da própria pessoa). */
export function efeitosDasCartas(codigo: NucleoCodigo, cartas: string[], signal?: AbortSignal): Promise<EfeitosResposta> {
  return api.post<EfeitosResposta>(`${BASE}/nucleos/${codigo}/efeitos`, { cartas }, { signal });
}

/** Abre a partida com o deck escolhido (o servidor confere tamanho, obrigatórias e dono: 422 com o que falta). */
export function abrirPartida(codigo: NucleoCodigo, deck: string[]): Promise<NucleoPartida> {
  return api.post<NucleoPartida>(`${BASE}/nucleos/${codigo}/partidas`, { deck });
}

/** Entrega o look (uma vez, só o dono); o servidor pontua de forma determinística. */
export function entregarPartida(id: string, entrega: NucleoEntrega): Promise<NucleoResultado> {
  return api.post<NucleoResultado>(`${BASE}/partidas/${encodeURIComponent(id)}/entrega`, entrega);
}
