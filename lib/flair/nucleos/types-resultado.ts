/**
 * FLAIR 3D, base dos 15 núcleos (docs/flair/flair-3d/BASE_NUCLEOS.md, seção "API"): o que o servidor devolve da prévia,
 * da entrega e do acionamento de uma partida, e o efeito de cada carta na tela do deck. Reexportado por `types.ts`.
 */
import type { AuraDaCarta } from "@/lib/flair/nucleos/aura-na-partida";
import type { UsoDaCarta } from "@/lib/flair/nucleos/movimento/lances-de-uso";
import type { PerfilDaPeca } from "@/lib/flair/recursos/types";

export interface RegraResultado {
  codigo: string;
  ok: boolean;
  pontos: number;
}

/** Quanto a carta vestida numa vaga rendeu na nota (0 quando não pontuou). */
export interface CartaPontos {
  vaga: string;
  cardId: string;
  pontos: number;
}

/** Como a partida fica depois da chamada: fechada, esperando um acionamento ou aceitando outra entrega (LABIRINTO). */
export type PartidaStatus = "ABERTA" | "EM_ACAO" | "ENTREGUE";

export interface NucleoResultado {
  pontos: number;
  estrelas: number;
  resultado: string;
  regras: RegraResultado[];
  eventos: { codigo: string; valor?: unknown }[];
  /** pontos de cada carta vestida (vazio nos núcleos de zonas e enquanto a partida está EM_ACAO) */
  cartas?: CartaPontos[];
  status?: PartidaStatus | null;
}

/**
 * Corpo de POST .../partidas/{id}/acionar: a carta Especial do DRESS_FIGHTER ou a troca do intervalo do
 * FASHION_SPORTS. Tudo opcional: sem nada, a partida só avança para a próxima etapa.
 */
export interface NucleoAcionamento {
  carta?: string | null;
  troca?: { vaga: string; carta: string } | null;
  /** Fashion Detective: o que a pessoa faz no passo ("IR:meio", "ACUSAR:2"...) */
  alvo?: string | null;
  /** os jogos de ação jogável: os botões apertados em cada marca do percurso (Flair3dExecucao) */
  execucao?: { toques: { marca: number; botao: string; ms: number }[] } | null;
}

export interface EfeitoItem {
  codigo: string;
  valor: number | string;
  /** verdadeiro quando o item é o motivo de a carta não pontuar (MARCA_NAO_BR, FORA_DA_FAMILIA, SEM_BONUS...) */
  motivo?: boolean;
}

export interface EfeitosResposta {
  /** `perfil`: a regra peça-recurso da carta (lib/flair/recursos/types.ts); servidor antigo não manda */
  /** `uso`: nos jogos de zonas, o lance que a cor da carta aciona na fase de uso (lib/flair/nucleos/movimento/lances-de-uso.ts) */
  /** `aura`: a Aura da carta nos jogos com Aura na partida (rodada 8g) */
  efeitos: { cardId: string; itens: EfeitoItem[]; perfil?: PerfilDaPeca; uso?: UsoDaCarta | null; aura?: AuraDaCarta }[];
}
