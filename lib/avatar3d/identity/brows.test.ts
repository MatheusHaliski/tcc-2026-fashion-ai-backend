import { describe, expect, it } from "vitest";
import { BROW_LINES, browShape, browsProfile, measureBrow } from "./brows";
import { deltaE2000, hexToLab, rgbToLab } from "./metrics";
import type { Pt } from "../image-stats";

/** Testa sintética com duas sobrancelhas de forma, espessura e cor conhecidas (nenhuma foto de pessoa). */
const W = 320, H = 200, SKIN = [200, 160, 135], HAIR = [70, 48, 36];
function scene(opts: { arch: number; thick: number; hair?: number[]; sparse?: boolean }) {
  const data = new Uint8ClampedArray(W * H * 4); const px: Pt[] = Array.from({ length: 478 }, () => [0, 0] as Pt);
  const brow = (x: number, cx: number) => 70 - opts.arch * (1 - ((x - cx) / 45) ** 2);          // linha de cima, y para baixo
  for (const [side, cx] of [["right", 90], ["left", 230]] as const) {
    const b = BROW_LINES[side];
    px[b.eye[0]] = [cx + (side === "right" ? -30 : 30), 110]; px[b.eye[1]] = [cx + (side === "right" ? 30 : -30), 110];
    const xs = [0, 1, 2, 3, 4].map((k) => cx + (side === "right" ? 40 - k * 20 : -40 + k * 20));    // de dentro para fora
    b.upper.forEach((id, k) => { px[id] = [xs[k], brow(xs[k], cx)]; });
    b.lower.forEach((id, k) => { px[id] = [xs[k], brow(xs[k], cx) + opts.thick]; });
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c = SKIN;
    for (const cx of [90, 230]) {
      const top = 70 - opts.arch * (1 - ((x - cx) / 45) ** 2);
      if (Math.abs(x - cx) <= 42 && y >= top && y <= top + opts.thick && (!opts.sparse || (x + y) % 3 === 0)) c = opts.hair ?? HAIR;
    }
    const o = (y * W + x) * 4; data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
  }
  return { img: { data, width: W, height: H }, px };
}

describe("sobrancelhas (I4)", () => {
  it("mede cor, espessura e densidade de sobrancelhas cheias", () => {
    const { img, px } = scene({ arch: 2, thick: 12 });
    const b = browsProfile(img, px)!;
    expect(deltaE2000(hexToLab(b.color), rgbToLab(HAIR[0], HAIR[1], HAIR[2]))).toBeLessThan(5);
    expect(b.thickness).toBeCloseTo(12 / 60, 1);
    expect(b.density).toBeGreaterThan(0.8);
    expect(b.confidence).toBeGreaterThan(0.7);
  });

  it("arco: reta, suave e alta pela altura do arco", () => {
    expect(browsProfile(scene({ arch: 1, thick: 10 }).img, scene({ arch: 1, thick: 10 }).px)!.shape).toBe("STRAIGHT");
    const soft = scene({ arch: 14.5, thick: 10 }), high = scene({ arch: 19, thick: 10 });
    expect(browsProfile(soft.img, soft.px)!.shape).toBe("SOFT_ARCH");
    expect(browsProfile(high.img, high.px)!.shape).toBe("HIGH_ARCH");
    expect(browShape(0.02)).toBe("STRAIGHT");
  });

  it("sobrancelha rala tem densidade baixa", () => {
    const full = scene({ arch: 3, thick: 10 }), sparse = scene({ arch: 3, thick: 10, sparse: true });
    expect(measureBrow(sparse.img, sparse.px, "right")!.density).toBeLessThan(measureBrow(full.img, full.px, "right")!.density - 0.3);
  });

  it("franja por cima ou pelo da cor da pele: confiança baixa", () => {
    const { img, px } = scene({ arch: 3, thick: 10 });
    const fringe = new Float32Array(W * H).fill(1);
    expect(browsProfile(img, px, fringe)!.confidence).toBeLessThan(0.4);
    const light = scene({ arch: 3, thick: 10, hair: [165, 128, 105] });
    expect(browsProfile(light.img, light.px)!.confidence).toBeLessThan(0.5);
  });

  it("sem os pontos do rosto, nada", () => {
    const { img } = scene({ arch: 3, thick: 10 });
    expect(browsProfile(img, [])).toBeNull();
  });
});
