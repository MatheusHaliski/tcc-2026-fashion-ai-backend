/**
 * O orçamento de tinta dos jogos de zonas (Flair3dTinta.java): cada zona pintada gasta latas pelo acabamento (fosco 1,
 * brilhante 2, metálico e espelhado 3) e a peça tem 2 latas por zona da rodada. O servidor manda o evento TINTA na
 * prévia (enquanto a pessoa pinta) e no resultado; a sobra vira fôlego da fase de uso, e passar do orçamento fecha a
 * partida SEM_TINTA. Aqui só se lê o que o servidor disse. Puro.
 */
import { valorDoEvento } from "@/lib/flair/nucleos/action-fx";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

export interface Tinta {
  orcamento: number;
  gasto: number;
  sobra: number;
}

/** As latas de cada acabamento, as mesmas do servidor (para a legenda da paleta). */
export const LATAS_POR_ACABAMENTO: Readonly<Record<string, number>> = { FOSCO: 1, BRILHANTE: 2, METALICO: 3, ESPELHADO: 3 };

/** O orçamento do resultado ou da prévia; nulo fora dos jogos de zonas. */
export function tintaDe(r: NucleoResultado | null | undefined): Tinta | null {
  const v = valorDoEvento(r, "TINTA") as Partial<Tinta> | undefined;
  if (!v || typeof v.orcamento !== "number" || typeof v.gasto !== "number") return null;
  return { orcamento: v.orcamento, gasto: v.gasto, sobra: Math.max(0, v.orcamento - v.gasto) };
}

/** Passou do orçamento: a peça não sai do ateliê. */
export function passouDoOrcamento(t: Tinta): boolean {
  return t.gasto > t.orcamento;
}
