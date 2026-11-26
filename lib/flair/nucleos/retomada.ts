/**
 * O ponto em que a partida retomada parou, em uma frase ("Continuar partida"): a sala e as pistas da investigação, o
 * placar e a jogada da partida por cartas, a etapa da vez nas rodadas em etapas, a ação em curso ou o deck já escolhido.
 * Só lê o que o servidor mandou (lib/flair/nucleos/types.ts, NucleoRetomada). Puro.
 */
import { retratoDe, relogio } from "@/lib/flair/detetive/types";
import { situacaoDe } from "@/lib/flair/esporte/types";
import { etapaDaVez } from "@/lib/flair/nucleos/rodadas";
import type { NucleoRetomada } from "@/lib/flair/nucleos/types";

export type PontoDaRetomada =
  | { tipo: "detetive"; sala: string; pistas: number; total: number; vida: number; relogio: string }
  | { tipo: "esporte"; placar: string; jogada: number; total: number }
  | { tipo: "etapa"; etapa: number; total: number }
  | { tipo: "acao" }
  | { tipo: "deck"; n: number };

export function pontoDaRetomada(r: NucleoRetomada): PontoDaRetomada {
  const retrato = retratoDe(r.resultado);
  if (retrato) {
    return { tipo: "detetive", sala: retrato.sala, pistas: retrato.pistas.length, total: retrato.totalDePistas, vida: retrato.vida, relogio: relogio(retrato.tempo) };
  }
  const situacao = situacaoDe(r.resultado);
  if (situacao) return { tipo: "esporte", placar: situacao.placar.replace("-", " × "), jogada: situacao.jogada, total: situacao.total };
  if (r.resultado) return { tipo: "acao" };
  const etapa = r.tentativa ? etapaDaVez(r.partida, r.tentativa) : null;
  if (etapa) return { tipo: "etapa", etapa: etapa.etapa, total: etapa.total };
  return { tipo: "deck", n: r.partida.deck?.length ?? 0 };
}
