/** Chamadas da API dos núcleos do FLAIR 3D (contrato em docs/flair/flair-3d/BASE_NUCLEOS.md, seção "API"). */
import { api } from "@/lib/api/client";
import type {
  AvatarTipo,
  EfeitosResposta,
  NucleoAcionamento,
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

/**
 * Abre a partida com o deck escolhido (o servidor confere tamanho, obrigatórias e dono: 422 DECK_INVALIDO com o que
 * falta). `avatar` = MODELO_CASA quando a pessoa joga com a modelo da casa (só onde o núcleo aceita).
 */
export function abrirPartida(codigo: NucleoCodigo, deck: string[], avatar?: AvatarTipo | null): Promise<NucleoPartida> {
  return api.post<NucleoPartida>(`${BASE}/nucleos/${codigo}/partidas`, avatar ? { deck, avatar } : { deck });
}

/**
 * Entrega o look (só o dono); o servidor pontua de forma determinística. O `status` da resposta diz se a partida
 * fechou (ENTREGUE), espera um acionamento (EM_ACAO) ou aceita outra entrega (ABERTA, no LABIRINTO).
 */
export function entregarPartida(id: string, entrega: NucleoEntrega): Promise<NucleoResultado> {
  return api.post<NucleoResultado>(`${BASE}/partidas/${encodeURIComponent(id)}/entrega`, entrega);
}

/** Prévia da entrega: pontos e regras de agora, sem fechar a partida (nos jogos automáticos, só os atributos). */
export function previaPartida(id: string, entrega: NucleoEntrega, signal?: AbortSignal): Promise<NucleoResultado> {
  return api.post<NucleoResultado>(`${BASE}/partidas/${encodeURIComponent(id)}/previa`, entrega, { signal });
}

/** Avança a ação de uma partida EM_ACAO, com a carta Especial ou a troca do intervalo quando a pessoa aciona. */
export function acionarPartida(id: string, acionamento: NucleoAcionamento = {}): Promise<NucleoResultado> {
  return api.post<NucleoResultado>(`${BASE}/partidas/${encodeURIComponent(id)}/acionar`, acionamento);
}
