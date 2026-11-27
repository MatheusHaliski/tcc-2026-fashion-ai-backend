/**
 * Rodadas de um jogo (docs/flair/flair-3d/ESTADO_DOS_JOGOS.md, "Rodadas"): o objetivo mais simples e as rodadas do
 * grupo dele. A pessoa escolhe a rodada antes de entrar; a definição que a tela usa passa a ser a da rodada (objetivo,
 * zonas e opções dela). Nas rodadas em etapas, o servidor diz a etapa da vez na abertura da partida e, depois de cada
 * entrega, no evento PROXIMA_ETAPA. Puro.
 */
import { valorDoEvento } from "@/lib/flair/nucleos/action-fx";
import type { NucleoDefinicao, NucleoPartida, NucleoRecurso, NucleoResultado, NucleoRodada } from "@/lib/flair/nucleos/types";

/** As rodadas que o servidor mandou; sem resposta dele (ou jogo antigo), nenhuma: a tela joga o objetivo da definição. */
export function rodadasDe(definicao: Pick<NucleoDefinicao, "rodadas">): NucleoRodada[] {
  return definicao.rodadas ?? [];
}

/** Há o que escolher? (mais de uma rodada) */
export function temRodadas(definicao: Pick<NucleoDefinicao, "rodadas">): boolean {
  return rodadasDe(definicao).length > 1;
}

/** A definição vista pela rodada escolhida: o objetivo dela e, quando ela tem os seus, as zonas e as opções. */
export function definicaoDaRodada(definicao: NucleoDefinicao, codigo: string | null | undefined): NucleoDefinicao {
  const rodada = rodadasDe(definicao).find((r) => r.codigo === codigo);
  if (!rodada) return definicao;
  const opcoes = rodada.opcoes?.length ? rodada.opcoes : definicao.opcoes;
  const recursos: NucleoRecurso[] = rodada.opcoes?.length && !definicao.recursos.includes("RESPOSTA") ? [...definicao.recursos, "RESPOSTA"] : definicao.recursos;
  return { ...definicao, objetivo: rodada.objetivo, zonas: rodada.zonas?.length ? rodada.zonas : definicao.zonas, opcoes, recursos, rodada: rodada.codigo };
}

/** A rodada pede uma resposta antes de entregar? (opções próprias: o título, a década, a porta) */
export function respostaObrigatoria(definicao: NucleoDefinicao): boolean {
  if (definicao.codigo === "PERSONAGEM_FILME") return true;
  const rodada = rodadasDe(definicao).find((r) => r.codigo === definicao.rodada);
  return !!rodada?.opcoes?.length && definicao.codigo !== "FASHION_SPORTS";
}

/**
 * As vagas do uniforme que ainda estão vazias. Só o Fashion Sports pede o uniforme inteiro (parte de cima, de baixo e
 * calçado: o time joga com as três); nos outros jogos, qualquer escolha basta para entregar.
 */
export function vagasQueFaltam(definicao: Pick<NucleoDefinicao, "codigo" | "vagas">, cartas: Record<string, string>): string[] {
  return definicao.codigo === "FASHION_SPORTS" ? definicao.vagas.filter((v) => !cartas[v]) : [];
}

export interface EtapaDaVez {
  etapa: number;
  codigo: string;
  total: number;
  tentativa: number;
}

function comoEtapa(valor: unknown): EtapaDaVez | null {
  if (!valor || typeof valor !== "object") return null;
  const { etapa, codigo, total, tentativa } = valor as Record<string, unknown>;
  if (typeof etapa !== "number" || typeof codigo !== "string" || typeof total !== "number") return null;
  return { etapa, codigo, total, tentativa: typeof tentativa === "number" ? tentativa : 1 };
}

/** A etapa da vez de uma rodada em etapas: a da última entrega (PROXIMA_ETAPA) ou a da abertura; fora delas, null. */
export function etapaDaVez(partida: Pick<NucleoPartida, "abertura"> | null | undefined, ultima: NucleoResultado | null | undefined): EtapaDaVez | null {
  return comoEtapa(valorDoEvento(ultima, "PROXIMA_ETAPA")) ?? comoEtapa(partida?.abertura?.etapa);
}

/** O que o jogo revelou ao entrar, por nome ("tema", "estrela", "cena", "desafio", "pedido"): o código, ou null. */
export function revelado(partida: Pick<NucleoPartida, "abertura"> | null | undefined, nome: string): string | null {
  const v = partida?.abertura?.[nome];
  return typeof v === "string" ? v : null;
}
