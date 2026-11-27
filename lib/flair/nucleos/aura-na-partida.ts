/**
 * A Aura muda a partida (rodada 8g; docs/aura/CIRCUITO_AURA.md: os jogos leem o Hype e a Aura, nunca escrevem). As
 * mesmas regras de `Flair3dAuraRegras` no servidor, que é quem julga; aqui servem para a tela avisar antes da entrega
 * e para ler o que o servidor mandou (AURA_NA_PARTIDA, AURA_NA_EXECUCAO). Puro.
 */
import { HYPE_BANDS, type HypeBand } from "@/lib/flair/photo-scene";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

export type FamiliaDeAura = "COMMON" | "ELECTRO" | "SPLASH" | "HYPE" | "METAMORPHOSE";

/** Os jogos de cartas com a Aura na partida nesta rodada (os de zonas ficam com outra). */
export const AURA_JOGOS: ReadonlySet<NucleoCodigo> = new Set<NucleoCodigo>(["PASSARELA", "DRESS_THE_STAR", "PERSONAGEM_FILME", "BOUTIQUE_3D", "BATALHA_LOOKS"]);
/** Pontos da plateia pela faixa média (índice = ordem da faixa). */
export const PLATEIA = [0, 0, 1, 2, 4, 6] as const;
/** Pontos do destaque do trunfo pela faixa da carta chamada. */
export const TRUNFO = [0, 0, 2, 3, 4, 5] as const;
export const ELECTRO_MS = 150;
export const ELECTRO_TETO_MS = 300;
export const RECARGA_MARCAS = 2;

/** O que o servidor mandou da Aura de cada carta nos selos (POST .../efeitos). */
export interface AuraDaCarta {
  familia: FamiliaDeAura | null;
  faixa: HypeBand;
  /** o bônus do destaque se a carta for chamada como trunfo (0: Hype abaixo de Relevante) */
  trunfo: number;
  /** a carta Especial com Aura Metamorfose (o poder com recarga) */
  metamorfose: boolean;
}

const ordem = (f: HypeBand) => Math.max(0, HYPE_BANDS.indexOf(f));

/** A faixa média inteira das peças, uma acima com Splash vestida (sem peça, sinal baixo). */
export function faixaDaPlateia(faixas: HypeBand[], splash: boolean): HypeBand {
  if (faixas.length === 0) return "LOW_SIGNAL";
  const media = Math.floor(faixas.reduce((n, f) => n + ordem(f), 0) / faixas.length);
  return HYPE_BANDS[Math.min(HYPE_BANDS.length - 1, media + (splash ? 1 : 0))];
}

export function plateia(faixas: HypeBand[], splash: boolean): number {
  return PLATEIA[ordem(faixaDaPlateia(faixas, splash))];
}

export function trunfoDaFaixa(f: HypeBand): number {
  return TRUNFO[ordem(f)];
}

export function electroMs(quantas: number): number {
  return Math.min(ELECTRO_TETO_MS, ELECTRO_MS * Math.max(0, quantas));
}

/** As marcas em que a Metamorfose dispara: o primeiro erro e, depois de recarregar por 2 marcas, o próximo. */
export function metamorfoses(marcas: string[]): number[] {
  const out: number[] = [];
  let pronta = 0;
  marcas.forEach((m, i) => {
    if (m === "ERROU" && i >= pronta) {
      out.push(i);
      pronta = i + RECARGA_MARCAS + 1;
    }
  });
  return out;
}

/** A Aura de um look para o aviso da preparação: a faixa da plateia, os pontos e as famílias vestidas. */
export function auraDoLook(auras: (AuraDaCarta | undefined)[]) {
  const lista = auras.filter((a): a is AuraDaCarta => !!a);
  const tem = (f: FamiliaDeAura) => lista.filter((a) => a.familia === f).length;
  const splash = tem("SPLASH") > 0;
  return { faixa: faixaDaPlateia(lista.map((a) => a.faixa), splash), plateia: plateia(lista.map((a) => a.faixa), splash), splash,
    electroMs: electroMs(tem("ELECTRO")), comum: tem("COMMON") > 0, metamorfose: lista.some((a) => a.metamorfose) };
}

export interface TrunfoNaPartida {
  carta: string;
  faixa: HypeBand;
  bonus: number;
  etapa: number;
}

export interface AuraDoServidor {
  faixa: HypeBand;
  plateia: number;
  splash: boolean;
  electroMs: number;
  comum: boolean;
  metamorfose: boolean;
  trunfo: TrunfoNaPartida | null;
}

type Valor = Record<string, unknown>;
const objeto = (v: unknown): Valor | null => (v && typeof v === "object" ? (v as Valor) : null);

/** A última leitura da Aura que o servidor mandou (na Batalha vem uma por rodada); nula sem ela. */
export function auraDoResultado(r: NucleoResultado | null | undefined): AuraDoServidor | null {
  const lista = (r?.eventos ?? []).filter((e) => e.codigo === "AURA_NA_PARTIDA").map((e) => objeto(e.valor)).filter((v): v is Valor => !!v);
  const v = lista[lista.length - 1];
  if (!v) return null;
  const t = objeto(v.trunfo);
  return { faixa: (v.faixa as HypeBand) ?? "LOW_SIGNAL", plateia: Number(v.plateia ?? 0), splash: !!v.splash, electroMs: Number(v.electroMs ?? 0), comum: !!v.comum,
    metamorfose: !!v.metamorfose, trunfo: t ? { carta: String(t.carta), faixa: t.faixa as HypeBand, bonus: Number(t.bonus ?? 0), etapa: Number(t.etapa ?? 0) } : null };
}

/** O que a Aura mudou na execução: a janela a mais, o erro perdoado e as marcas transformadas. */
export function auraDaExecucao(r: NucleoResultado | null | undefined): { electroMs: number; perdoados: number; metamorfoses: number[] } | null {
  const v = objeto(r?.eventos.find((e) => e.codigo === "AURA_NA_EXECUCAO")?.valor);
  if (!v) return null;
  return { electroMs: Number(v.electroMs ?? 0), perdoados: Number(v.perdoados ?? 0), metamorfoses: Array.isArray(v.metamorfoses) ? v.metamorfoses.map(Number) : [] };
}
