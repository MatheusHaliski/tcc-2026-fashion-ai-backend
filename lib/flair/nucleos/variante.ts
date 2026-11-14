/**
 * A sala que a cena mostra quando o jogo tem mais de uma (lib/flair/nucleos/scene/registry.ts, VARIANTES): o salão da
 * vez no FASHION_DETECTIVE e a modalidade escolhida no FASHION_SPORTS. Nos outros jogos não há variante.
 */
import { salaoDaVez } from "@/lib/flair/nucleos/detective";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

export function varianteDaCena(codigo: NucleoCodigo, resposta: string | null, anterior: NucleoResultado | null | undefined): string | null {
  if (codigo === "FASHION_DETECTIVE") return salaoDaVez(anterior).codigo;
  if (codigo === "FASHION_SPORTS") return resposta ?? "FUTEBOL";
  return null;
}
