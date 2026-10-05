import { describe, expect, it } from "vitest";
import { applyGains, estimateIlluminant, skinProfile, undertoneOf } from "./skin-tone";
import { deltaE2000, rgbToLab } from "./identity/metrics";
import type { Pt } from "./image-stats";

/**
 * "Cartões" sintéticos: uma foto com dois olhos (esclera de cor conhecida, íris escura) sob uma luz colorida. A pele
 * corrigida pelos ganhos estimados na esclera tem de voltar ao tom real (ΔE2000 ≤ 3) — auditoria de identidade, seção 17.
 */
const EYE_L = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const EYE_R = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
const SCLERA: [number, number, number] = [0.93, 0.9, 0.865];
const W = 220, H = 120;

function scene(illum: [number, number, number], withIris = true) {
  const data = new Uint8ClampedArray(W * H * 4);
  const px: Pt[] = Array.from({ length: withIris ? 478 : 468 }, () => [0, 0] as Pt);
  const eyes = [{ ids: EYE_L, cx: 70, iris: 468 }, { ids: EYE_R, cx: 150, iris: 473 }];
  for (const e of eyes) {
    e.ids.forEach((id, k) => { const a = (k / e.ids.length) * Math.PI * 2; px[id] = [e.cx + Math.cos(a) * 18, 60 + Math.sin(a) * 8]; });
    if (withIris) { px[e.iris] = [e.cx, 60]; for (let k = 1; k <= 4; k++) { const a = (k / 4) * Math.PI * 2; px[e.iris + k] = [e.cx + Math.cos(a) * 5, 60 + Math.sin(a) * 5]; } }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    let refl: [number, number, number] = [0.55, 0.4, 0.32];                         // pele em volta
    for (const e of eyes) {
      const inEye = ((x - e.cx) / 18) ** 2 + ((y - 60) / 8) ** 2 < 1;
      if (inEye) refl = Math.hypot(x - e.cx, y - 60) < 5.5 ? [0.18, 0.12, 0.08] : SCLERA;
    }
    for (let k = 0; k < 3; k++) data[o + k] = Math.min(255, refl[k] * illum[k] * 235);
    data[o + 3] = 255;
  }
  return { img: { data, width: W, height: H }, px };
}

const ILLUMINANTS: Record<string, [number, number, number]> = {
  neutra: [1, 1, 1], quente: [1.16, 1, 0.74], fria: [0.86, 1, 1.18], fluorescente: [0.93, 1.07, 0.9], magenta: [1.08, 0.9, 1.04],
};
const SKINS: Record<string, [number, number, number]> = { clara: [0.86, 0.66, 0.56], media: [0.64, 0.46, 0.36], escura: [0.36, 0.25, 0.19] };

describe("balanço de branco pela esclera (I3)", () => {
  for (const [ln, il] of Object.entries(ILLUMINANTS)) for (const [sn, refl] of Object.entries(SKINS)) {
    it(`pele ${sn} sob luz ${ln}: ΔE2000 ≤ 3 depois da correção`, () => {
      const { img, px } = scene(il);
      const wb = estimateIlluminant(img, px);
      expect(wb.source).toBe("SCLERA");
      const photo = refl.map((r, k) => Math.min(255, r * il[k] * 230)) as [number, number, number];
      const truth = refl.map((r) => r * 230) as [number, number, number];
      const fixed = applyGains(photo, wb.gains);
      const before = deltaE2000(rgbToLab(...photo), rgbToLab(...truth)), after = deltaE2000(rgbToLab(...fixed), rgbToLab(...truth));
      expect(after).toBeLessThanOrEqual(3);
      if (ln !== "neutra") expect(after).toBeLessThan(before);
    });
  }
  it("sem íris (468 pontos): gray-world fraco; imagem escura: sem correção", () => {
    const { img, px } = scene(ILLUMINANTS.quente, false);
    const wb = estimateIlluminant(img, px);
    expect(wb.source).toBe("GRAY_WORLD"); expect(wb.confidence).toBeLessThan(0.5);
    const dark = { data: new Uint8ClampedArray(W * H * 4), width: W, height: H };
    expect(estimateIlluminant(dark, px).source).toBe("NONE");
  });
});

describe("perfil da pele", () => {
  it("subtom pelo ângulo de matiz e melanina pela luminância", () => {
    expect(undertoneOf({ L: 60, a: 18, b: 10 }).cls).toBe("COOL");
    expect(undertoneOf({ L: 60, a: 12, b: 24 }).cls).toBe("WARM");
    expect(undertoneOf({ L: 60, a: 4, b: 18 }).cls).toBe("OLIVE");
    const light = skinProfile([224, 180, 160], { gains: [1, 1, 1], source: "SCLERA", confidence: 0.8, samples: 100 });
    const dark = skinProfile([96, 64, 48], { gains: [1, 1, 1], source: "GRAY_WORLD", confidence: 0.3, samples: 100 });
    expect(dark.melaninLevel.value).toBeGreaterThan(light.melaninLevel.value);
    expect(dark.baseTone.confidence).toBeLessThan(light.baseTone.confidence);
  });
});
