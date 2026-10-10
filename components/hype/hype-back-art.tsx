"use client";
import { memo, type CSSProperties } from "react";
import type { HypeLevel } from "@/lib/hype/types";

/**
 * Arte dinâmica do verso do card (RF53): o fundo acompanha a faixa do Hype — "sinal baixo" é tímido (céu discreto, três
 * estrelas lentas), "viral" é dourado e vivo (gradiente em movimento, halo e muitas estrelas cintilando). Tudo em CSS
 * (sem canvas/WebGL): gradiente por faixa, estrelas de quatro pontas em posições determinísticas (semente = id do item,
 * então o mesmo card tem sempre o mesmo céu) e, a partir de HOT, um brilho que atravessa o card.
 *
 * Regras: decorativo (aria-hidden, sem foco, sem clique); a animação só roda com o verso visível (o CSS pausa quando o
 * card volta para a frente); movimento reduzido = céu parado; alto contraste = sem arte; a leitura dos dados vem primeiro
 * (as estrelas ficam nas bordas e o miolo tem um véu).
 */
export type HypeArtLevel = HypeLevel | "NONE";

/** Quantidade de estrelas por faixa — da arte tímida à super dinâmica. */
export const STARS_BY_LEVEL: Record<HypeArtLevel, number> = { NONE: 2, LOW_SIGNAL: 3, NICHE: 6, RELEVANT: 10, HOT: 16, TRENDING: 24, VIRAL: 36 };

/** PRNG pequeno e determinístico (mulberry32) a partir de uma string. */
function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export interface ArtStar { x: number; y: number; size: number; delay: number; duration: number; bright: boolean }

/**
 * Estrelas nas bordas (faixa superior e laterais), nunca no miolo onde ficam o número e as barras. Posição em %,
 * tamanho em px, atraso/duração em s (cada estrela pisca no seu tempo).
 */
export function artStars(seed: string, level: HypeArtLevel): ArtStar[] {
  const rnd = seeded(`${seed}:${level}`);
  const n = STARS_BY_LEVEL[level];
  const fast = level === "VIRAL" ? 1.6 : level === "TRENDING" ? 2.2 : level === "HOT" ? 2.8 : level === "RELEVANT" ? 3.6 : 5;
  return Array.from({ length: n }, (_, i) => {
    const band = i % 3;   // 0 = topo, 1 = lateral esquerda, 2 = lateral direita
    const x = band === 0 ? 4 + rnd() * 92 : band === 1 ? 2 + rnd() * 14 : 84 + rnd() * 14;
    const y = band === 0 ? 2 + rnd() * 22 : 18 + rnd() * 76;
    return { x, y, size: 4 + rnd() * (level === "VIRAL" || level === "TRENDING" ? 9 : 6), delay: rnd() * fast * 2, duration: fast * (0.7 + rnd() * 0.8), bright: rnd() > 0.72 };
  });
}

export const HypeBackArt = memo(function HypeBackArt({ level, seed }: { level: HypeArtLevel; seed: string }) {
  const stars = artStars(seed, level);
  return (
    <div className={`hype-art is-${level.toLowerCase().replace("_", "-")}`} aria-hidden data-level={level}>
      <span className="hype-art-sky" />
      {(level === "HOT" || level === "TRENDING" || level === "VIRAL") && <span className="hype-art-sheen" />}
      {level === "VIRAL" && <span className="hype-art-halo" />}
      {stars.map((s, i) => (
        <span key={i} className={s.bright ? "hype-art-star is-bright" : "hype-art-star"}
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, animationDelay: `${s.delay.toFixed(2)}s`, animationDuration: `${s.duration.toFixed(2)}s` } as CSSProperties} />
      ))}
      <span className="hype-art-veil" />
    </div>
  );
});
