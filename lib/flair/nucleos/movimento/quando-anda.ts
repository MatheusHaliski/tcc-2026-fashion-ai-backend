/**
 * Quando o analógico (e WASD) leva a personagem pela sala, regra única da tela de jogo e da cena 3D:
 * - na preparação, em todo jogo de andar livre (lib/flair/entrada/mapa-por-jogo.ts);
 * - na ação do desfile jogável (os pontos do jogo, lib/flair/nucleos/movimento/desfile.ts);
 * - no Dress Fighter, entre um lance e outro (a janela da carta aberta): a lutadora circula pelo ringue. Quando o lance
 *   seguinte começa, ela volta à guarda na marca dela (Andarilho). A nota é a do servidor: andar muda a cena, não o
 *   golpe (decisão da dona). Puro.
 */
import { mapaDoJogo } from "@/lib/flair/entrada/mapa-por-jogo";
import { DESFILE_JOGAVEL } from "@/lib/flair/nucleos/movimento/desfile";
import type { Momento } from "@/lib/flair/nucleos/moments";
import type { NucleoAcao, NucleoCodigo } from "@/lib/flair/nucleos/types";

/** Os jogos em que dá para circular entre os lances, com a janela do acionamento aberta. */
export const ANDA_ENTRE_LANCES = new Set<NucleoCodigo>(["DRESS_FIGHTER"]);

export function andaAgora(codigo: NucleoCodigo, acoes: readonly NucleoAcao[], momento: Momento, entreLances = false): boolean {
  if (mapaDoJogo(codigo, acoes).movimento !== "LIVRE") return false;
  if (momento === "PREPARACAO") return true;
  if (momento !== "ACAO") return false;
  return DESFILE_JOGAVEL.has(codigo) || (entreLances && ANDA_ENTRE_LANCES.has(codigo));
}
