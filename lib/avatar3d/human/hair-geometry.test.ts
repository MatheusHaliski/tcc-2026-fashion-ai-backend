import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { baseNormals } from "./three-human";
import { buildHair, earVertexMask } from "./hair-geometry";
import { DEFAULT_BODY } from "../body-spec";
import { HAIR_LEVELS } from "../image-stats";
import type { AvatarHair } from "../model";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

function body(sex: "FEMININO" | "MASCULINO") {
  const c = compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature);
  return { c, normals: baseNormals(c.body, asset.body.index, asset.body.renderVertex), H: DEFAULT_BODY[sex].stature };
}

/** Silhueta típica: meia-largura (cm) por altura do canônico, mais larga no alto da cabeça e caindo para baixo. */
const outline = (w: number) => HAIR_LEVELS.map((y) => (y > -10 ? w : Math.max(0, w - (-10 - y) * 0.4)));

const base: AvatarHair = { present: true, color: "#3b2a20", top: 14, side: 8, bottom: -6, fringe: 0.3, cut: false, outline: outline(9) };

/** Caixa da geometria gerada (posições x, y, z). */
function bounds(pos: ArrayLike<number>) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], pos[i + k]); hi[k] = Math.max(hi[k], pos[i + k]); }
  return { lo, hi };
}

describe("cabelo 3D do avatar (RF40) — geometria presa ao esqueleto", () => {
  const f = body("FEMININO");
  const m = body("MASCULINO");

  it("sem cabelo, careca ou sem cor não gera geometria", () => {
    expect(buildHair(asset, f.c, f.normals, { ...base, present: false })).toBeNull();
    expect(buildHair(asset, f.c, f.normals, { ...base, length: "bald" })).toBeNull();
    expect(buildHair(asset, f.c, f.normals, { ...base, color: null })).toBeNull();
  });

  it("raspado vira uma casca rente ao couro cabeludo, no alto da cabeça", () => {
    const hb = buildHair(asset, m.c, m.normals, { ...base, length: "buzz" })!;
    expect(hb.kind).toBe("hair");
    const { lo, hi } = bounds(hb.geometry.getAttribute("position").array);
    expect(hi[1]).toBeGreaterThan(0.85 * m.H);
    expect(lo[1]).toBeGreaterThan(0.75 * m.H);
  });

  it("curto, médio e longo: quanto maior o comprimento, mais o cabelo desce", () => {
    const bottomOf = (length: AvatarHair["length"]) =>
      bounds(buildHair(asset, f.c, f.normals, { ...base, length, bottom: length === "long" ? -24 : length === "medium" ? -15 : -4 })!.geometry.getAttribute("position").array).lo[1];
    const short = bottomOf("short"), medium = bottomOf("medium"), long = bottomOf("long");
    expect(medium).toBeLessThan(short);
    expect(long).toBeLessThan(medium);
  });

  it("todas as texturas geram geometria válida, sem coordenadas inválidas", () => {
    for (const texture of ["straight", "wavy", "curly", "coily"] as const) {
      for (const length of ["short", "medium", "long"] as const) {
        const hb = buildHair(asset, f.c, f.normals, { ...base, texture, length, bottom: length === "long" ? -22 : -8 }, 1.3)!;
        const pos = hb.geometry.getAttribute("position").array as Float32Array;
        expect(pos.length).toBeGreaterThan(0);
        expect(pos.every((v) => Number.isFinite(v))).toBe(true);
        expect(hb.geometry.getAttribute("skinIndex")).toBeTruthy();
      }
    }
  });

  it("volume maior afasta o cabelo da cabeça (a largura cresce)", () => {
    const width = (volume: number) => {
      const { lo, hi } = bounds(buildHair(asset, f.c, f.normals, { ...base, texture: "coily", length: "short", volume: 1.8 }, volume)!.geometry.getAttribute("position").array);
      return hi[0] - lo[0];
    };
    expect(width(1.8)).toBeGreaterThanOrEqual(width(0.8));
  });

  it("topo cortado na foto e cabelo sem silhueta ainda geram um volume mínimo", () => {
    expect(buildHair(asset, m.c, m.normals, { ...base, cut: true, length: "short" })).not.toBeNull();
    expect(buildHair(asset, m.c, m.normals, { ...base, outline: undefined, top: 0, length: "short" })).not.toBeNull();
  });

  it("cobertura de cabeça (lenço, boné) gera a cobertura mesmo sem cabelo visível", () => {
    const hb = buildHair(asset, f.c, f.normals, { ...base, present: false, color: null, cover: "#aa2233" })!;
    expect(hb.kind).toBe("cover");
    expect(hb.geometry.getAttribute("position").count).toBeGreaterThan(0);
  });

  it("a calota e o raspado não copiam a superfície das orelhas, mesmo em cabelo longo", () => {
    // Pontos externos do hélix e da concha no asset MakeHuman real; ambos têm peso 100% no Head.
    const pinna = [5439, 5445, 5500, 5598, 5724, 12038, 12044, 12099, 12197, 12323];
    const mask = earVertexMask(asset);
    for (const v of pinna) expect(mask[v]).toBe(1);
    expect(mask[meta.vertices.top[0]]).toBe(0);
    for (const b of [f, m]) for (const length of ["buzz", "short", "long"] as const) {
      const hb = buildHair(asset, b.c, b.normals, { ...base, length, bottom: length === "long" ? -24 : 0 })!;
      const pos = hb.geometry.getAttribute("position").array, idx = hb.geometry.getIndex()!.array;
      const cap = new Set(Array.from(idx).slice(0, hb.calotaIndex ?? idx.length));
      let copied = 0;
      for (const v of pinna) for (const q of cap) {
        const d = [0, 1, 2].map((k) => pos[q * 3 + k] - b.c.body[v * 3 + k]);
        const n = [0, 1, 2].map((k) => b.normals[v * 3 + k]);
        const t = d.reduce((sum, x, k) => sum + x * n[k], 0);
        // Uma cópia da pinna seria o mesmo vértice afastado pela espessura do cabelo ao longo de sua normal.
        if (t > 0.001 && t < 0.09 && Math.hypot(...d.map((x, k) => x - n[k] * t)) < 0.00002) copied++;
      }
      expect(copied).toBe(0);
      if (length === "long") expect(idx.length).toBeGreaterThan(hb.calotaIndex!); // continua havendo cortina
    }
  });
});
