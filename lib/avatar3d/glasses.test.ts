import { describe, expect, it } from "vitest";
import { CANON_UV } from "./canonical-face";
import { erode, glassesMask, prepareFaceTexture, removePhotographedEyes } from "./glasses";
import { defaultEyes, EYES } from "./iris";
import { polygonMask, type Pt, type Raster } from "./image-stats";

const SKIN: [number, number, number] = [196, 150, 122];
const FRAME = [28, 26, 30] as const;
const BROWS = [[70, 63, 105, 66, 107, 55, 65, 52, 53, 46], [300, 293, 334, 296, 336, 285, 295, 282, 283, 276]];

/** Saved canonical atlas with an antialiased frame, shaded skin and intact brow/eye pixels; no person's photo. */
function atlas(thickness = 0.075) {
  const width = 512, height = 512;
  const px: Pt[] = Array.from({ length: 468 }, (_, i) => [CANON_UV[i * 2] * width, CANON_UV[i * 2 + 1] * height]);
  const eyes = Object.values(EYES).map((e) => ({
    cx: e.contour.reduce((a, i) => a + px[i][0], 0) / e.contour.length,
    cy: e.contour.reduce((a, i) => a + px[i][1], 0) / e.contour.length,
    w: Math.hypot(px[e.corners[0]][0] - px[e.corners[1]][0], px[e.corners[0]][1] - px[e.corners[1]][1]),
  }));
  const eyeMasks = Object.values(EYES).map((e) => polygonMask(width, height, e.contour.map((i) => px[i])));
  const data = new Uint8ClampedArray(width * height * 4), frame = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, o = i * 4;
    let blend = 0;
    for (const eye of eyes) {
      const d = Math.abs(x - eye.cx), v = Math.abs(y - eye.cy - eye.w * 0.12);
      const outer = (d / (eye.w * 0.93)) ** 4 + (v / (eye.w * 0.63)) ** 4;
      const inner = (d / (eye.w * (0.93 - thickness))) ** 4 + (v / (eye.w * (0.63 - thickness))) ** 4;
      if (outer < 1 && inner >= 1) blend = 1;
      else if (outer < 1.035 && inner >= 0.965) blend = Math.max(blend, 0.45);
    }
    if (x > px[133][0] && x < px[362][0] && Math.abs(y - eyes[0].cy + eyes[0].w * 0.2) < 2) blend = 1;
    frame[i] = blend === 1 ? 1 : 0;
    for (let k = 0; k < 3; k++) data[o + k] = SKIN[k] + (y / height - 0.5) * 12;
    if (eyeMasks.some((mask) => mask[i])) { data[o] = 202; data[o + 1] = 209; data[o + 2] = 216; }
    for (let k = 0; k < 3; k++) data[o + k] = data[o + k] * (1 - blend) + FRAME[k] * blend;
    data[o + 3] = 255;
  }
  // Brows are independent identity detail; drawing them last keeps the source's natural occlusion.
  for (const ids of BROWS) {
    const brow = polygonMask(width, height, ids.map((i) => px[i]));
    for (let i = 0; i < brow.length; i++) if (brow[i]) { data[i * 4] = 67; data[i * 4 + 1] = 45; data[i * 4 + 2] = 32; frame[i] = 0; }
  }
  return { img: { width, height, data } as Raster, px, eyes, frame, eyeMasks };
}

describe("separate photographed eyewear from saved skin", () => {
  it.each([0.055, 0.1, 0.17])("removes complete rims, including the upper rim and thick frame (%s eye widths)", (thickness) => {
    const f = atlas(thickness), original = new Uint8ClampedArray(f.img.data);
    const repaired = prepareFaceTexture(f.img, SKIN, defaultEyes("PRESCRIPTION", "#1c1a1e"));
    const upper = f.eyes.map((eye) => [Math.round(eye.cx), Math.round(eye.cy - eye.w * (0.51 - thickness / 2))]);
    for (const [x, y] of upper) {
      const o = (y * f.img.width + x) * 4;
      expect(original[o]).toBeLessThan(80);
      expect(repaired.image.data[o]).toBeGreaterThan(150);
    }
    expect(f.img.data.every((v, i) => v === original[i])).toBe(true);
  });

  it("restores eyewear on legacy metadata without replacing the measured iris colour", () => {
    const f = atlas(), eyes = { ...defaultEyes(), color: "#5c7696", secondary: "#486077" };
    const result = prepareFaceTexture(f.img, SKIN, eyes);
    expect(result.eyes?.glasses).toBe("PRESCRIPTION");
    expect(result.eyes?.color).toBe(eyes.color);
    expect(result.eyes?.secondary).toBe(eyes.secondary);
    expect(result.removed).toBeGreaterThan(0);
  });

  it("the antialiased repair never dilates into eyes or brows", () => {
    const f = atlas();
    const mask = glassesMask(f.img, f.px, SKIN, "PRESCRIPTION", "#1c1a1e")!;
    for (let i = 0; i < mask.length; i++) if (f.eyeMasks.some((m) => m[i])) expect(mask[i]).toBe(0);
    for (const ids of BROWS) for (const id of ids) {
      const [x, y] = f.px[id];
      expect(mask[Math.floor(y) * f.img.width + Math.floor(x)]).toBe(0);
    }
  });

  it("cleans the second photographed eye from orbital skin, including white pixels at the contour", () => {
    const f = atlas();
    const prepared = prepareFaceTexture(f.img, SKIN, defaultEyes("PRESCRIPTION", "#1c1a1e"));
    const before = new Uint8ClampedArray(prepared.image.data);
    expect(removePhotographedEyes(prepared.image, SKIN)).toBeGreaterThan(0);
    for (const e of f.eyes) {
      const o = (Math.round(e.cy) * f.img.width + Math.round(e.cx)) * 4;
      // The source eye was pale blue-grey; the hidden socket is warm local skin.
      expect(before[o + 2]).toBeGreaterThan(200);
      expect(prepared.image.data[o + 2]).toBeLessThan(145);
      expect(prepared.image.data[o] - prepared.image.data[o + 2]).toBeGreaterThan(45);
    }
    for (let i = 0; i < f.eyeMasks[0].length; i++) if (f.eyeMasks.some((m) => m[i]) && before[i * 4 + 2] > 200)
      expect(prepared.image.data[i * 4 + 2]).toBeLessThan(145);
  });

  it("keeps dark lashes and canthi while removing antialiased sclera and coloured iris at the edge", () => {
    const f = atlas(), w = f.img.width, h = f.img.height;
    const preserved: number[] = [], cleaned: number[] = [];
    for (const aperture of f.eyeMasks) {
      const interior = erode(aperture, w, h, 1);
      for (let i = 0; i < aperture.length; i++) if (aperture[i] && !interior[i]) {
        const color = i % 3 === 0 ? [61, 41, 29] : i % 3 === 1 ? [202, 183, 171] : [63, 112, 130];
        f.img.data.set(color, i * 4);
        (i % 3 === 0 ? preserved : cleaned).push(i);
      }
    }
    const before = new Uint8ClampedArray(f.img.data);
    removePhotographedEyes(f.img, SKIN);
    expect(preserved.length).toBeGreaterThan(20); expect(cleaned.length).toBeGreaterThan(40);
    for (const i of preserved) expect(Array.from(f.img.data.slice(i * 4, i * 4 + 4))).toEqual(Array.from(before.slice(i * 4, i * 4 + 4)));
    for (const i of cleaned) expect(f.img.data[i * 4] - f.img.data[i * 4 + 2]).toBeGreaterThan(45);
  });
});
