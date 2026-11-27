/**
 * Linha do tempo do vídeo da partida (replay): abertura com o cenário e o tema, um trecho por rodada (as duas cartas de
 * roupa entram pelos lados, a vencedora acende, o placar sobe) e o fechamento com o resultado. Puro: dado o instante,
 * diz o que o quadro mostra; quem desenha é components/flair/arena/use-replay-recorder.ts.
 */
import type { MatchData, MatchMoment, MatchWinner } from "@/lib/flair/match-stage";

export const INTRO_MS = 1200;
export const MOMENT_MS = 1700;
export const FINAL_MS = 2200;
export const FPS = 30;

export type ReplayPhase = "intro" | "moment" | "final";
export interface ReplayFrame {
  phase: ReplayPhase;
  /** rodada em cena (só na fase moment) */
  moment: MatchMoment | null;
  /** 0..1 dentro da fase */
  progress: number;
  /** placar já revelado até este quadro */
  score: { A: number; B: number };
  winner: MatchWinner | null;
}

export function replayDuration(data: MatchData): number {
  return INTRO_MS + data.moments.length * MOMENT_MS + FINAL_MS;
}

function scoreUntil(data: MatchData, count: number): { A: number; B: number } {
  const s = { A: 0, B: 0 };
  for (const m of data.moments.slice(0, count)) {
    if (m.winner === "A") s.A++;
    else if (m.winner === "B") s.B++;
  }
  return s;
}

/** O que o quadro do instante `ms` mostra (antes de 0 = abertura; depois do fim = último quadro). */
export function frameAt(data: MatchData, ms: number): ReplayFrame {
  const t = Math.max(0, Math.min(ms, replayDuration(data)));
  if (t < INTRO_MS) return { phase: "intro", moment: null, progress: t / INTRO_MS, score: { A: 0, B: 0 }, winner: null };
  const inMoments = t - INTRO_MS;
  const index = Math.floor(inMoments / MOMENT_MS);
  if (index < data.moments.length) {
    const progress = (inMoments - index * MOMENT_MS) / MOMENT_MS;
    // o ponto da rodada entra no placar quando a vencedora acende (metade do trecho)
    return { phase: "moment", moment: data.moments[index], progress, score: scoreUntil(data, index + (progress >= 0.5 ? 1 : 0)), winner: null };
  }
  const progress = Math.min(1, (inMoments - data.moments.length * MOMENT_MS) / FINAL_MS);
  return { phase: "final", moment: null, progress, score: scoreUntil(data, data.moments.length), winner: data.winner };
}

/** Deslocamento horizontal (0 = no lugar, 1 = fora da tela) da carta que entra no começo do trecho. */
export function slideIn(progress: number): number {
  const p = Math.min(1, progress / 0.3);
  return 1 - (1 - Math.pow(1 - p, 3));
}
