/**
 * O que cada carta faz sozinha na ação (docs/flair/flair-3d/DESENHO_DA_TELA.md, seção 4): os passos saem SÓ do
 * resultado do servidor (regras e eventos da entrega), na ordem em que vieram. O efeito especial fecha a ação e também
 * só mostra o que o servidor decidiu. Puro.
 */
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { seloDaCarta } from "@/lib/flair/nucleos/card-fx";
import type { AcionamentoTipo } from "@/lib/flair/nucleos/moments";
import type { EfeitoItem, NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

/** Efeito de cenário de cada jogo (tabela "O que cada carta faz na ação"); os modos do Ateliê acendem um spot. */
export type EfeitoAcao =
  | "led"
  | "golpe"
  | "silhueta"
  | "refletor"
  | "lampada"
  | "cordao"
  | "arara"
  | "espelho"
  | "mapa"
  | "chute"
  | "placar"
  | "spot";

export const EFEITO_ACAO: Record<NucleoCodigo, EfeitoAcao> = {
  PASSARELA: "led",
  DRESS_FIGHTER: "golpe",
  DRESS_THE_STAR: "silhueta",
  PERSONAGEM_FILME: "refletor",
  ROAD_TO_GLORY: "lampada",
  FASHION_DETECTIVE: "cordao",
  BOUTIQUE_3D: "arara",
  CLUBE_CORACAO: "spot",
  FAVORITE_SINGER: "spot",
  LABIRINTO: "espelho",
  PILOTO_FAVORITO: "spot",
  AROUND_THE_WORLD: "mapa",
  SUPER_HEROI: "spot",
  FASHION_SPORTS: "chute",
  BATALHA_LOOKS: "placar",
};

export interface PassoAcao {
  fonte: "regra" | "evento" | "especial";
  codigo: string;
  ok: boolean;
  pontos: number;
  /** vaga da peça quando a regra é por vaga (FIGURINO_SUP, PEDIDO_INF...) */
  vaga: string | null;
  valor?: unknown;
}

/** Duração de cada passo na tela, em ms (cada efeito dura no máximo 2 segundos). */
export const PASSO_MS = 700;

const POSITIVOS = new Set(["VITORIA", "FAVORAVEL", "ABRE", "APROVADO", "CONCLUIDO"]);
const POR_VAGA = /_(SUP|INF|CAL|ACE|VES)$/;

function vagaDaRegra(codigo: string): string | null {
  return POR_VAGA.exec(codigo)?.[1] ?? null;
}

function venceu(valor: unknown): boolean {
  if (valor && typeof valor === "object" && "venceu" in valor) return (valor as { venceu?: unknown }).venceu === true;
  return true;
}

/** O servidor deu o efeito especial? Resultado positivo ou todas as regras cumpridas. */
export function especialOk(r: NucleoResultado): boolean {
  if (POSITIVOS.has(r.resultado)) return true;
  return r.regras.length > 0 && r.regras.every((x) => x.ok);
}

/**
 * Passos da ação: nas disputas automáticas (luta, partida) os eventos contam a história; nos demais, cada regra é uma
 * peça agindo, seguida dos eventos. O último passo é sempre o efeito especial.
 */
export function passosDaAcao(r: NucleoResultado, automatico = false): PassoAcao[] {
  const regras = r.regras.map((x): PassoAcao => ({ fonte: "regra", codigo: x.codigo, ok: x.ok, pontos: x.pontos, vaga: vagaDaRegra(x.codigo) }));
  const eventos = r.eventos.map((e): PassoAcao => ({ fonte: "evento", codigo: e.codigo, ok: venceu(e.valor), pontos: 0, vaga: null, valor: e.valor }));
  const especial: PassoAcao = { fonte: "especial", codigo: r.resultado, ok: especialOk(r), pontos: r.pontos, vaga: null };
  const corpo = automatico && eventos.length ? eventos : [...regras, ...eventos];
  return [...corpo, especial];
}

/**
 * A janela do acionamento abriu neste ponto da ação? Carta Especial: entre dois rounds. Troca de peça: depois do
 * evento INTERVALO do servidor. `indice` é o próximo passo a mostrar.
 */
export function janelaDoAcionamento(tipo: AcionamentoTipo, passos: PassoAcao[], indice: number): boolean {
  const anterior = passos[indice - 1];
  const proximo = passos[indice];
  if (!anterior || !proximo) return false;
  if (tipo === "ESPECIAL") return anterior.codigo === "ROUND" && proximo.codigo === "ROUND";
  if (tipo === "TROCA") return anterior.codigo === "INTERVALO";
  return false;
}

export interface CartaPontuada {
  vaga: string;
  cardId: string;
  /** pontos da regra da vaga (servidor) ou null quando o resultado não separa por carta */
  pontos: number | null;
  /** efeito da carta neste jogo (servidor), usado quando o resultado não traz os pontos por carta */
  selo: EfeitoItem | null;
}

/**
 * Cartas que pontuaram, na ordem das vagas: pela regra da vaga quando o resultado traz uma (FIGURINO_SUP...); senão,
 * pelo efeito que o servidor deu à carta em POST .../efeitos.
 */
export function cartasQuePontuaram(
  r: NucleoResultado,
  cartas: Record<string, string>,
  cards: FlairCollectionCard[],
  efeitos: Map<string, EfeitoItem[]>,
): CartaPontuada[] {
  const porVaga = new Map<string, number>();
  for (const regra of r.regras) {
    const vaga = vagaDaRegra(regra.codigo);
    if (vaga && regra.ok) porVaga.set(vaga, regra.pontos);
  }
  const temPorVaga = r.regras.some((x) => vagaDaRegra(x.codigo));
  const out: CartaPontuada[] = [];
  for (const [vaga, cardId] of Object.entries(cartas)) {
    if (!cards.some((c) => c.id === cardId)) continue;
    const selo = seloDaCarta(efeitos.get(cardId));
    if (temPorVaga) {
      if (porVaga.has(vaga)) out.push({ vaga, cardId, pontos: porVaga.get(vaga) ?? 0, selo });
    } else if (selo) {
      out.push({ vaga, cardId, pontos: null, selo });
    }
  }
  return out;
}
