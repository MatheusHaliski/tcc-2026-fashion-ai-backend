"use client";

import type { HypeViewState } from "@/lib/hype/model";
import { displayScore, levelTone } from "@/lib/hype/model";

/**
 * Camada informativa sobre a foto: não simula um GIF nem calcula Hype no cliente; só anima o
 * score já publicado pelo serviço de HypeScore. A foto continua legível quando não há score.
 */
export function AuraHype({ state }: { state: HypeViewState }) {
  if (state.kind !== "available") return null;
  return (
    <div className={`aura-hype ${levelTone(state.level)}`} aria-label={`AURA Hype, score ${displayScore(state.score)}, ${state.level}`}>
      <span className="aura-hype-grid" aria-hidden />
      <span className="aura-hype-scan" aria-hidden />
      <span className="aura-hype-node is-one" aria-hidden />
      <span className="aura-hype-node is-two" aria-hidden />
      <span className="aura-hype-node is-three" aria-hidden />
      <span className="aura-hype-readout"><small>AURA HYPE</small><strong>{displayScore(state.score)}</strong><em>{state.direction === "UP" ? "RISING" : state.direction === "DOWN" ? "COOLING" : "STABLE"}</em></span>
      <span className="aura-hype-metrics" aria-hidden>TX · 98%<br />MAP · LIVE</span>
    </div>
  );
}
