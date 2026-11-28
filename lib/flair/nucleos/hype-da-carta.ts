/**
 * A faixa de Hype de uma carta, só para mostrar (Circuito Aura: os jogos leem o Hype, nunca o escrevem). Os mesmos
 * limiares do servidor (Flair3dHype: NICHE ≥ 20, RELEVANT ≥ 40, HOT ≥ 60, TRENDING ≥ 75, VIRAL ≥ 90); carta sem HYP
 * público = LOW_SIGNAL. A nota da partida não depende disto. Puro.
 */
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { HYPE_BANDS, type HypeBand } from "@/lib/flair/photo-scene";

const LIMIARES = [20, 40, 60, 75, 90];

export function faixaDeHype(card: Pick<FlairCollectionCard, "hype"> | null | undefined): HypeBand {
  const hyp = card?.hype?.HYP;
  if (hyp == null || !Number.isFinite(hyp)) return "LOW_SIGNAL";
  return HYPE_BANDS[LIMIARES.filter((l) => hyp >= l).length];
}
