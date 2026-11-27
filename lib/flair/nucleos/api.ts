/** Chamadas da API dos núcleos do FLAIR 3D (contrato em docs/flair/flair-3d/BASE_NUCLEOS.md, seção "API"). */
import { api } from "@/lib/api/client";
import type { NucleoProgresso, RascunhoSalvo } from "@/lib/flair/nucleos/progresso";
import { marcarSalvo, oQueDaResposta } from "@/lib/flair/nucleos/salvamento";
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
  NucleoRetomada,
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

/** Para onde valem os selos: a partida aberta (rodada e sorteio dela) ou, antes de entrar, a rodada escolhida. */
export interface OndeDosEfeitos {
  rodada?: string | null;
  partida?: string | null;
  /** a etapa da vez numa rodada em etapas: não vai no pedido (o servidor a conhece), só faz a tela pedir os selos de novo */
  vez?: number | null;
}

/** Efeito de cada carta da pessoa neste núcleo (logado; só cartas da própria pessoa). */
export function efeitosDasCartas(codigo: NucleoCodigo, cartas: string[], signal?: AbortSignal, onde: OndeDosEfeitos = {}): Promise<EfeitosResposta> {
  const corpo = onde.partida ? { cartas, partida: onde.partida } : onde.rodada ? { cartas, rodada: onde.rodada } : { cartas };
  return api.post<EfeitosResposta>(`${BASE}/nucleos/${codigo}/efeitos`, corpo, { signal });
}

/**
 * Abre a partida com o deck escolhido (o servidor confere tamanho, obrigatórias e dono: 422 DECK_INVALIDO com o que
 * falta). `avatar` = MODELO_CASA quando a pessoa joga com a modelo da casa (só onde o núcleo aceita).
 */
export function abrirPartida(codigo: NucleoCodigo, deck: string[], avatar?: AvatarTipo | null, rodada?: string | null): Promise<NucleoPartida> {
  const corpo: Record<string, unknown> = avatar ? { deck, avatar } : { deck };
  if (rodada) corpo.rodada = rodada;
  return api.post<NucleoPartida>(`${BASE}/nucleos/${codigo}/partidas`, corpo).then((p) => {
    if (p?.id) marcarSalvo(p.id, "partida");
    return p;
  });
}

/** A campanha da pessoa neste jogo: rodadas vencidas, estrelas, o que abre a seguir e o ponto da história. */
export function buscarProgresso(codigo: NucleoCodigo, signal?: AbortSignal): Promise<NucleoProgresso> {
  return api.get<NucleoProgresso>(`${BASE}/nucleos/${codigo}/progresso`, { signal });
}

/** Guarda no servidor o look em montagem da partida aberta (não conta tentativa nem muda a nota). */
export function guardarRascunhoNoServidor(id: string, look: NucleoEntrega): Promise<RascunhoSalvo> {
  return api.put<RascunhoSalvo>(`${BASE}/partidas/${encodeURIComponent(id)}/rascunho`, look).then((r) => {
    if (r?.salvoEm) marcarSalvo(id, "rascunho", r.salvoEm);
    return r;
  });
}

/** A partida da pessoa que ainda não fechou neste núcleo ("Continuar partida"), ou null (204). */
export async function buscarEmAndamento(codigo: NucleoCodigo, signal?: AbortSignal): Promise<NucleoRetomada | null> {
  const r = await api.get<NucleoRetomada | undefined>(`${BASE}/nucleos/${codigo}/em-andamento`, { signal });
  return r && r.partida ? r : null;
}

/**
 * Entrega o look (só o dono); o servidor pontua de forma determinística. O `status` da resposta diz se a partida
 * fechou (ENTREGUE), espera um acionamento (EM_ACAO) ou aceita outra entrega (ABERTA, no LABIRINTO).
 */
export function entregarPartida(id: string, entrega: NucleoEntrega): Promise<NucleoResultado> {
  return api.post<NucleoResultado>(`${BASE}/partidas/${encodeURIComponent(id)}/entrega`, entrega).then((r) => {
    marcarSalvo(id, oQueDaResposta(r?.status, "entrega"));
    return r;
  });
}

/** Prévia da entrega: pontos e regras de agora, sem fechar a partida (nos jogos automáticos, só os atributos). */
export function previaPartida(id: string, entrega: NucleoEntrega, signal?: AbortSignal): Promise<NucleoResultado> {
  return api.post<NucleoResultado>(`${BASE}/partidas/${encodeURIComponent(id)}/previa`, entrega, { signal });
}

/** Avança a ação de uma partida EM_ACAO, com a carta Especial ou a troca do intervalo quando a pessoa aciona. */
export function acionarPartida(id: string, acionamento: NucleoAcionamento = {}): Promise<NucleoResultado> {
  return api.post<NucleoResultado>(`${BASE}/partidas/${encodeURIComponent(id)}/acionar`, acionamento).then((r) => {
    marcarSalvo(id, oQueDaResposta(r?.status, "passo"));
    return r;
  });
}
