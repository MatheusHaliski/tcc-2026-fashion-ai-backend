/**
 * A moldura de história de cada jogo (critério da dona: começo, desenvolvimento com cutscenes e final com cutscene que
 * segue a lógica do desfecho): a premissa que abre a partida e o final que fecha, um para cada desfecho. Os textos
 * ficam nos catálogos (flair3d.narrativa.<JOGO>.premissa e .final.<BOM|MEDIO|RUIM>). Puro.
 */
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

export type Desfecho = "BOM" | "MEDIO" | "RUIM";

const BONS = new Set(["VITORIA", "FAVORAVEL", "ABRE", "CONCLUIDO"]);
const MEDIOS = new Set(["EMPATE", "PARCIAL"]);
const RUINS = new Set(["DERROTA", "DESFAVORAVEL", "NAO_ABRE", "REPROVADO", "INCOMPLETO"]);

/** O desfecho da partida: o resultado do servidor quando ele diz (vitória, empate, derrota); senão, as estrelas. */
export function desfechoDe(r: Pick<NucleoResultado, "resultado" | "estrelas">): Desfecho {
  if (RUINS.has(r.resultado)) return "RUIM";
  if (MEDIOS.has(r.resultado)) return "MEDIO";
  if (BONS.has(r.resultado)) return "BOM";
  if (r.estrelas >= 3) return "BOM";
  return r.estrelas >= 1 ? "MEDIO" : "RUIM";
}
