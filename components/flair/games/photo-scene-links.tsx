"use client";
import type { CSSProperties } from "react";
import type { CbcSlotResult } from "@/lib/flair/cbc";
import type { Flair3dSlot } from "@/lib/flair/games";
import { BAND_AURA } from "@/components/flair/games/photo-scene-hit";
import { bandIndex } from "@/lib/flair/games";
import type { PhotoPin } from "@/components/flair/games/photo-scene";

/**
 * Conexão entre as cartas da cena (RF FLAIR Metamorfose, "Conexão cromática"): o efeito de uma carta faz sentido no
 * contexto das demais. Duas vagas vizinhas na sequência do mapa que o servidor marcou como em harmonia (`neighbor` em
 * evaluation.slots: mesma marca, estilo em comum ou cores em harmonia) ganham um fio de luz que une os dois objetos na
 * foto. Com Metamorfose numa das pontas, o fio vira circuito na cor da Aura (faixa de partida mais alta das duas) com um
 * pulso que percorre a ligação; a espessura cresce com a sintonia somada. Sem harmonia, nada liga as cartas.
 */
export function PhotoSceneLinks({ pins, results, flair3d, filledKeys }: { pins: PhotoPin[]; results?: CbcSlotResult[]; flair3d?: Flair3dSlot[]; filledKeys: Set<string> }) {
  const byResult = new Map((results ?? []).map((r) => [r.slot, r]));
  const byFlair3d = new Map((flair3d ?? []).map((g) => [g.slot, g]));
  const links: { a: PhotoPin; b: PhotoPin; meta: boolean; band: number; weight: number }[] = [];
  for (let i = 0; i < pins.length - 1; i++) {
    const a = pins[i], b = pins[i + 1];
    if (!filledKeys.has(a.key) || !filledKeys.has(b.key)) continue;
    const ra = byResult.get(a.key), rb = byResult.get(b.key);
    if (!ra?.neighbor || !rb?.neighbor) continue;
    const ga = byFlair3d.get(a.key), gb = byFlair3d.get(b.key);
    const meta = [ga, gb].some((g) => g && g.effect.kind !== "COMUM");
    const band = Math.max(ga ? bandIndex(ga.matchBand) : 0, gb ? bandIndex(gb.matchBand) : 0);
    links.push({ a, b, meta, band, weight: (ra.sintonia ?? 0) + (rb.sintonia ?? 0) });
  }
  if (!links.length) return null;
  return (
    <svg className="gep-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden focusable="false">
      {links.map(({ a, b, meta, band, weight }) => {
        const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - Math.max(4, Math.abs(a.x - b.x) * 0.18);
        const d = `M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`;
        const style = { "--link-color": meta ? BAND_AURA[band] : "#fff3d6", "--link-w": `${0.25 + weight * 0.06}` } as CSSProperties;
        return (
          <g key={`${a.key}-${b.key}`} className={meta ? "gep-link is-circuit" : "gep-link"} style={style}>
            <path className="gep-link-glow" d={d} />
            <path className="gep-link-core" d={d} pathLength={100} />
            {meta && <path className="gep-link-pulse" d={d} pathLength={100} />}
          </g>
        );
      })}
    </svg>
  );
}
