/**
 * Os lances da fase de uso dos jogos de zonas (rodada zonas; Flair3dMomentoChave, Flair3dCartaDeUso e
 * Flair3dFaseDeUsoNota no servidor): a janela de cada marca, que fecha com a rodada e com a marca; o momento-chave do
 * gênero (pênalti, virada da música, pit stop, ameaça), em que a escolha certa abre a janela das marcas seguintes e a
 * errada a fecha; e a carta do guarda-roupa jogada na marca, cuja cor aciona o lance (embalo, fôlego, escudo), cuja
 * faixa de Hype é a torcida e cuja versão Especial é a Metamorfose, que volta depois da recarga. Aqui só se mostra na
 * hora o que o servidor vai dizer, com as mesmas regras. Puro.
 */
import type { BotaoDaExecucao } from "@/lib/flair/nucleos/movimento/execucao";

/** O momento-chave da partida: a marca, o nome, a condição sorteada, as duas opções e o botão da certa. */
export interface ChaveDoPedido {
  marca: number;
  momento: string;
  condicao: string;
  opcoes: [string, string];
  certa: BotaoDaExecucao;
}

/** O que o servidor manda de cada carta da pessoa (POST .../efeitos, campo `uso`). */
export interface UsoDaCarta {
  lance: string;
  efeito: "EMBALO" | "FOLEGO" | "ESCUDO" | "METAMORFOSE";
  familia: string | null;
  faixa: string;
  janelaPct: number;
}

/** Os campos da rodada zonas no risco do pedido. */
export interface LancesDoPedido {
  janelas: number[];
  janelasOusadas: number[];
  chave: ChaveDoPedido | null;
  uniforme: string[];
  nivel: number;
  cartasMax: number;
  recarga: number;
}

export const EMBALO_DA_CHAVE_PCT = 15;
export const EMBALO_DA_CARTA = 2;
export const COR_DO_UNIFORME = 1;

const numeros = (v: unknown): number[] => (Array.isArray(v) && v.every((x) => typeof x === "number") ? v : []);

/** Lê os campos da rodada zonas do EXECUCAO_PEDIDA (ausentes: a fase de uso de antes, sem chave nem cartas). */
export function lerLances(v: Record<string, unknown>, ehBotao: (b: unknown) => b is BotaoDaExecucao): LancesDoPedido {
  const c = v.chave as Partial<ChaveDoPedido> | undefined;
  const chave = c && typeof c.marca === "number" && Array.isArray(c.opcoes) && c.opcoes.length === 2 && ehBotao(c.certa)
    ? { marca: c.marca, momento: String(c.momento ?? ""), condicao: String(c.condicao ?? ""), opcoes: [String(c.opcoes[0]), String(c.opcoes[1])] as [string, string], certa: c.certa }
    : null;
  return {
    janelas: numeros(v.janelas),
    janelasOusadas: numeros(v.janelasOusadas),
    chave,
    uniforme: Array.isArray(v.uniforme) ? v.uniforme.map(String) : [],
    nivel: Number(v.nivel ?? 0),
    cartasMax: Number(v.cartasMax ?? 0),
    recarga: Number(v.recarga ?? 0),
  };
}

/** As janelas da marca (seguro e ousado), com o embalo do momento-chave e o que a carta abre. */
export function janelasDaMarca(l: LancesDoPedido | undefined, marca: number, base: { seguro: number; ousado: number }, embaloPct: number, carta: UsoDaCarta | null) {
  const pct = 100 + embaloPct + (carta?.janelaPct ?? 0);
  const seguro = l?.janelas[marca] ?? base.seguro;
  const ousado = l?.janelasOusadas[marca] ?? base.ousado;
  return { seguro: Math.floor((seguro * pct) / 100), ousado: Math.floor((ousado * pct) / 100) };
}

/** O embalo das marcas depois do momento-chave: abre com a escolha certa, fecha com a errada. */
export function embaloDepoisDaChave(certa: boolean): number {
  return certa ? EMBALO_DA_CHAVE_PCT : -EMBALO_DA_CHAVE_PCT;
}

/** A carta segura o erro (escudo, Metamorfose). */
export function seguraOErro(carta: UsoDaCarta | null): boolean {
  return carta?.efeito === "ESCUDO" || carta?.efeito === "METAMORFOSE";
}

/** O que a carta soma ao lance que acerta: o embalo e, da cor de uma zona pintada, mais um. */
export function bonusDaCarta(carta: UsoDaCarta | null, uniforme: readonly string[]): number {
  if (!carta) return 0;
  const embalo = carta.efeito === "EMBALO" || carta.efeito === "METAMORFOSE" ? EMBALO_DA_CARTA : 0;
  return embalo + (carta.familia && uniforme.includes(carta.familia) ? COR_DO_UNIFORME : 0);
}

/** A carta ainda pode ser jogada: cada uma uma vez (a Metamorfose volta depois da recarga), até o máximo da fase. */
export function cartaDisponivel(l: LancesDoPedido, usos: ReadonlyMap<string, number>, cardId: string, uso: UsoDaCarta, marca: number): boolean {
  const antes = usos.get(cardId);
  if (antes === undefined) return usos.size < l.cartasMax;
  return uso.efeito === "METAMORFOSE" && marca - antes > l.recarga;
}
