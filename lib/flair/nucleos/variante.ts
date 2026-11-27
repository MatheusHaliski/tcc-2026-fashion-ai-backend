/**
 * A sala que a cena mostra quando o jogo tem mais de uma (lib/flair/nucleos/scene/registry.ts, VARIANTES): o salão da
 * vez no FASHION_DETECTIVE, a modalidade escolhida no FASHION_SPORTS e, no AROUND_THE_WORLD, o lugar da etapa da vez
 * (a região, o andar da torre, a estação do metrô). Nos outros jogos não há variante.
 */
import { etapaDaVez } from "@/lib/flair/nucleos/rodadas";
import { salaoDaVez } from "@/lib/flair/nucleos/detective";
import type { NucleoCodigo, NucleoDefinicao, NucleoPartida, NucleoResultado } from "@/lib/flair/nucleos/types";

export function varianteDaCena(codigo: NucleoCodigo, resposta: string | null, anterior: NucleoResultado | null | undefined, partida?: Pick<NucleoPartida, "abertura"> | null): string | null {
  if (codigo === "FASHION_DETECTIVE") return salaoDaVez(anterior).codigo;
  if (codigo === "FASHION_SPORTS") return resposta ?? "FUTEBOL";
  // a etapa que a última entrega abriu; antes dela, a primeira (a sala do jogo, ou a da abertura da partida)
  if (codigo === "AROUND_THE_WORLD") return etapaDaVez(partida, anterior)?.codigo ?? null;
  return null;
}

/**
 * Jogo artístico (Clube do Coração): o objetivo que o servidor mandou tem regras, mas nenhuma vale pontos; a tela não
 * mostra placar. A definição local de reserva (objetivo "BASE", sem os pontos do servidor) nunca conta como artística.
 */
export function semPlacar(definicao: NucleoDefinicao): boolean {
  const regras = definicao.objetivo?.regras ?? [];
  return definicao.objetivo?.codigo !== "BASE" && regras.length > 0 && regras.every((r) => r.pontos === 0);
}
