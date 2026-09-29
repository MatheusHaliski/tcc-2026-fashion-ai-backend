/*
 * Avatar 3D (RF40) — corte de cabelo escolhido pela pessoa (ajuste fino "Corte"). 0 = o medido na foto; os outros
 * cobrem os cortes mais comuns, masculinos e femininos, e trocam só o que o corte define:
 *
 *   raspado — máquina: o couro cabeludo com 2–3 mm de fio;
 *   curto   — laterais e nuca batidas, pouco volume em cima (social, degradê);
 *   topete  — curto nas laterais, volume alto na frente (topete, quiff);
 *   joaozinho — curto feminino: franja longa de lado, laterais cobrindo o alto da orelha, nuca mais comprida;
 *   chanel  — reto na linha do queixo, com volume nas laterais;
 *   medio   — até os ombros;
 *   longo   — abaixo dos ombros.
 * Textura, cor e tom continuam os medidos (ou os escolhidos). Sem cabelo medido (careca, ou a foto não mostrou), o
 * corte escolhido aparece em castanho médio — a pessoa troca o tom ao lado.
 */
import type { AvatarHair } from "./model";
import type { HairLength } from "./hair";
import { HAIR_LEVELS } from "./image-stats";

export interface HairCut { id: number; key: string; length: HairLength; bottom: number | null; top?: number; fringe?: number; sides?: "tight" | "soft" }

// alturas no canônico do rosto (cm): testa 8,26; alto do crânio ≈ 13; lóbulo da orelha ≈ −2,9; queixo ≈ −9,4; ombros ≈ −17
export const HAIR_CUTS: HairCut[] = [
  { id: 1, key: "raspado", length: "buzz", bottom: null, fringe: 0 },
  { id: 2, key: "curto", length: "short", bottom: 3.2, top: 14.4, fringe: 0.1, sides: "tight" },
  { id: 3, key: "topete", length: "short", bottom: 3.4, top: 16.6, fringe: 0, sides: "tight" },
  { id: 4, key: "joaozinho", length: "short", bottom: 1.2, top: 15, fringe: 0.55, sides: "soft" },
  { id: 5, key: "chanel", length: "medium", bottom: -9.8, top: 15, sides: "soft" },
  { id: 6, key: "medio", length: "medium", bottom: -16 },
  { id: 7, key: "longo", length: "long", bottom: -27 },
];
export const HAIR_CUT_MAX = HAIR_CUTS.length;
const DEFAULT_COLOR = "#4a3323";                        // castanho médio (nível 4 da paleta de hair-tone.ts)

/** Cabelo com o corte escolhido (1–7); 0, ausente ou cobertura de cabeça: o próprio cabelo medido. */
export function hairWithCut(hair: AvatarHair, cut: number | null | undefined): AvatarHair {
  const c = HAIR_CUTS.find((x) => x.id === Math.round(cut ?? 0));
  if (!c || hair.cover) return hair;
  const out: AvatarHair = { ...hair, present: true, length: c.length, color: hair.color ?? DEFAULT_COLOR, cut: false };
  if (c.bottom !== null) out.bottom = c.bottom;
  if (c.top !== undefined) out.top = c.top;
  if (c.fringe !== undefined) out.fringe = c.fringe;
  if (hair.outline?.length) {
    // silhueta medida só até onde o corte vai; laterais batidas não herdam o volume lateral da foto
    out.outline = hair.outline.map((w, i) => {
      const y = HAIR_LEVELS[i];
      if (c.bottom !== null && y < c.bottom - 1) return 0;
      if (c.sides === "tight") return 0;
      return w;
    });
  }
  return out;
}
