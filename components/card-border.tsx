"use client";
import { useState } from 'react';
import { borderStyle, type CardBorderConfig } from '@/lib/card-border';
import { displayScore, type HypeViewState } from '@/lib/hype/model';
import { HYPE_SIGNAL_MS, type HypeLive } from '@/lib/hype/hype-signal-store';
import { prefersReducedMotion, useHypeSignalDriver } from '@/lib/hype/use-hype-signal';

/** Duração do sinal verde/vermelho (entrada e saída suaves no CSS). */
export const HYPE_BORDER_PULSE_MS = HYPE_SIGNAL_MS;

/**
 * Borda do card. Com a AURA Hype ativa e `live.enabled` (opção + permissão AURA_DYNAMIC), a borda fica verde quando o
 * Hype exibido subiu e vermelha quando caiu — ao vivo ou desde a última vez que esta pessoa viu o card — só com o card
 * visível. A primeira vista só grava a referência. Movimento reduzido: cor estática pelo mesmo tempo.
 */
export function CardBorder({ entityId, background, auraHype = false, hype, live }: { entityId: string; background?: Record<string,unknown> | null; auraHype?: boolean; hype?: HypeViewState; live?: HypeLive }) {
  const [element, setElement] = useState<HTMLSpanElement | null>(null);
  const score = hype?.kind === 'available' ? displayScore(hype.score) : null;
  const driven = auraHype && live?.enabled ? { ...live, key: entityId } : undefined;
  const signal = useHypeSignalDriver(element, driven, score);
  const configured = (background?.border as CardBorderConfig | undefined)?.effect;
  const effect = configured && configured !== 'AUTO' ? configured : (auraHype ? 'SHIMMER' : 'NONE');
  const direction = driven && signal ? signal.direction : undefined;
  const motion = direction && prefersReducedMotion() ? 'static' : undefined;
  // a seta repete a direção do sinal em forma: subir/cair não depende só de verde/vermelho
  return <>
    <span ref={setElement} className="card-border" aria-hidden="true" data-effect={effect} data-pulse={direction} data-motion={motion} data-signal-seq={signal?.seq} style={borderStyle(background, auraHype)} />
    {direction && <span key={signal?.seq} className="card-border-arrow" aria-hidden="true" data-direction={direction} data-motion={motion}>{direction === 'up' ? '▲' : '▼'}</span>}
  </>;
}
