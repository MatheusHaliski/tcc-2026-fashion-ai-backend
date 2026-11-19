/**
 * A luta do Dress Fighter como o servidor a devolve (DressFighterLuta): cada LANCE (o golpe da pessoa pela cor da carta,
 * o da oponente, o dano, o combo e as duas vidas) e o placar LUTA (vidas, lance, round e a leitura do próximo golpe da
 * oponente). A tela só mostra: a vida e o resultado saem do servidor. Puro.
 */
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

export interface LanceDaLuta {
  lance: number;
  round: number;
  carta: string | null;
  golpe: string;
  golpeOponente: string;
  dano: number;
  sofrido: number;
  cura: number;
  combo: string | null;
  vidaVoce: number;
  vidaOponente: number;
}

export interface EstadoDaLuta {
  vidaVoce: number;
  vidaOponente: number;
  vida: number;
  lance: number;
  lances: number;
  round: number;
  /** o golpe que a oponente prepara (a leitura); nulo com a luta encerrada */
  proximo: string | null;
  /** a carta do último lance: não entra no lance seguinte */
  ultimaCarta: string | null;
  /** o último combo fechado */
  combo: string | null;
}

/** Os eventos da luta que viram passo na ação (o placar LUTA só alimenta as barras). */
export const PASSOS_DA_LUTA = new Set(["LANCE_DA_LUTA", "ROUND", "NOCAUTE"]);

const numero = (v: unknown, padrao = 0) => (typeof v === "number" ? v : padrao);
const texto = (v: unknown) => (typeof v === "string" ? v : null);

export function lancesDaLuta(r: NucleoResultado | null | undefined): LanceDaLuta[] {
  if (!r) return [];
  return r.eventos
    .filter((e) => e.codigo === "LANCE_DA_LUTA" && !!e.valor && typeof e.valor === "object")
    .map((e) => {
      const v = e.valor as Record<string, unknown>;
      return {
        lance: numero(v.lance),
        round: numero(v.round, 1),
        carta: texto(v.carta),
        golpe: texto(v.golpe) ?? "GUARDA_BASICA",
        golpeOponente: texto(v.golpeOponente) ?? "GUARDA",
        dano: numero(v.dano),
        sofrido: numero(v.sofrido),
        cura: numero(v.cura),
        combo: texto(v.combo),
        vidaVoce: numero(v.vidaVoce, 100),
        vidaOponente: numero(v.vidaOponente, 100),
      };
    });
}

/** O placar da luta, ou nulo quando o resultado não é de uma luta lance a lance. */
export function estadoDaLuta(r: NucleoResultado | null | undefined): EstadoDaLuta | null {
  const luta = r?.eventos.filter((e) => e.codigo === "LUTA").pop()?.valor;
  if (!luta || typeof luta !== "object") return null;
  const v = luta as Record<string, unknown>;
  const ultimo = lancesDaLuta(r).pop();
  return {
    vidaVoce: numero(v.vidaVoce, 100),
    vidaOponente: numero(v.vidaOponente, 100),
    vida: numero(v.vida, 100),
    lance: numero(v.lance),
    lances: numero(v.lances, 9),
    round: numero(v.round, 1),
    proximo: texto(v.proximo),
    ultimaCarta: ultimo?.carta ?? null,
    combo: ultimo?.combo ?? null,
  };
}

/** A fração da barra de vida (0 a 1). */
export const fracaoDaVida = (vida: number, total: number) => Math.max(0, Math.min(1, total > 0 ? vida / total : 0));

/**
 * O contador da faixa da ação na luta: o round e o lance que já apareceram na tela. Conta lances, não eventos (o
 * fim de round e o nocaute também são passos: "4 de 4" não dizia em que round a luta estava).
 */
export function contadorDaLuta(passos: { codigo: string; valor?: unknown }[], mostrados: number, lances = 9): { round: number; lance: number; lances: number } {
  const vistos = passos.slice(0, mostrados).filter((p) => p.codigo === "LANCE_DA_LUTA");
  const v = (vistos[vistos.length - 1]?.valor ?? {}) as Record<string, unknown>;
  return { round: numero(v.round, 1), lance: numero(v.lance, vistos.length), lances };
}
