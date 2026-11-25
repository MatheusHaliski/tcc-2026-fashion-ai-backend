/**
 * O recurso-vida que as decisões da partida gastaram (Flair3dDesgaste.java): a apresentação errada no Labirinto, a
 * tentativa reprovada na viagem, a peça fora do tema, do perfil ou do pedido. O servidor manda o evento DESGASTE com a
 * reserva (a inicial mais as peças usadas), o gasto, o que sobrou e os motivos; zerado, a partida acaba em derrota. Cada
 * jogo dá ao recurso o nome da história dele (o Reflexo do Labirinto, a Confiança da modelo, a Paciência da cliente).
 * Puro.
 */
import { valorDoEvento } from "@/lib/flair/nucleos/action-fx";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";
import { RECURSOS, type Recurso } from "@/lib/flair/recursos/types";

export interface Desgaste {
  recurso: Recurso;
  reserva: number;
  gasto: number;
  restante: number;
  motivos: Record<string, number>;
}

const ehRecurso = (r: unknown): r is Recurso => typeof r === "string" && (RECURSOS as readonly string[]).includes(r);

/** O desgaste do resultado, ou nulo quando o jogo não gasta nada com as decisões (ou o servidor é antigo). */
export function desgasteDe(r: NucleoResultado | null | undefined): Desgaste | null {
  const v = valorDoEvento(r, "DESGASTE") as Partial<Desgaste> | undefined;
  if (!v || !ehRecurso(v.recurso) || typeof v.restante !== "number") return null;
  return { recurso: v.recurso, reserva: Number(v.reserva ?? 0), gasto: Number(v.gasto ?? 0), restante: v.restante, motivos: v.motivos ?? {} };
}

type Ou = (chave: string, padrao: string) => string;

/** O nome do recurso no jogo ("Reflexo" no Labirinto); sem nome próprio, o nome comum ("Energia"). */
export function nomeDoRecurso(ou: Ou, jogo: string, recurso: string): string {
  return ou(`flair3d.ui.recurso.${jogo}.${recurso}`, ou(`flair3d.ui.recurso.${recurso}`, recurso));
}
