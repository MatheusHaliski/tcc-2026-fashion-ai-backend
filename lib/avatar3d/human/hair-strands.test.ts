import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { baseNormals } from "./three-human";
import { buildHair, headFrame } from "./hair-geometry";
import { strandGeometry, withStrands } from "./hair-strands";
import { DEFAULT_BODY } from "../body-spec";
import type { AvatarHair } from "../model";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

const c = compose(asset, fitBody(asset, { sex: "FEMININO" }).z, null, DEFAULT_BODY.FEMININO.stature);
const normals = baseNormals(c.body, asset.body.index, asset.body.renderVertex);
const fr = headFrame(asset, c);

const hairOf = (o: Partial<AvatarHair>): AvatarHair => ({ present: true, color: "#33241a", top: 15, side: 9, bottom: 2.9, fringe: 0, cut: false, length: "short", texture: "straight", ...o });

function strands(h: AvatarHair, volume = 1) {
  const base = buildHair(asset, c, normals, h, volume, { base: true })!;
  return { base, st: strandGeometry(asset, c, h, base, volume)! };
}

/** Fração dos vértices dos fios mais de 2 mm para dentro da pele mais próxima. */
function inside(pts: Float32Array): number {
  const body = c.body; const cell = 0.03; const grid = new Map<string, number[]>();
  const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let v = 0; v < body.length / 3; v++) { const k = key(body[v * 3], body[v * 3 + 1], body[v * 3 + 2]); (grid.get(k) ?? grid.set(k, []).get(k)!).push(v); }
  let n = 0, bad = 0;
  for (let i = 0; i < pts.length / 3; i += 7) {
    n++; const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2]; let best = -1, bd = Infinity;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) for (const v of grid.get(`${cx + a},${cy + b},${cz + d}`) ?? []) {
      const dd = (body[v * 3] - x) ** 2 + (body[v * 3 + 1] - y) ** 2 + (body[v * 3 + 2] - z) ** 2; if (dd < bd) { bd = dd; best = v; }
    }
    if (best < 0) continue;
    const dot = (x - body[best * 3]) * normals[best * 3] + (y - body[best * 3 + 1]) * normals[best * 3 + 1] + (z - body[best * 3 + 2]) * normals[best * 3 + 2];
    if (dot < -0.002) bad++;
  }
  return bad / n;
}

describe("cabelo em fios (fase 2 do plano)", () => {
  it("curto: milhares de fitas curtas, por fora da cabeça, só acima da nuca", () => {
    const t0 = performance.now(); const { st } = strands(hairOf({})); const ms = performance.now() - t0;
    expect(st.ribbons).toBeGreaterThan(2500);
    expect(st.position.every(Number.isFinite)).toBe(true);
    expect(inside(st.position)).toBeLessThan(0.01);
    let minY = Infinity; for (let i = 1; i < st.position.length; i += 3) minY = Math.min(minY, st.position[i]);
    expect(minY).toBeGreaterThan(fr.chinY - 0.03);                       // cabelo curto não desce pelo pescoço
    expect(ms).toBeLessThan(4000);
  });

  it("longo: os fios descem até o comprimento medido, por cima do corpo", () => {
    const h = hairOf({ length: "long", bottom: -24 }); const { st } = strands(h);
    const target = fr.toY(-24); let minY = Infinity; for (let i = 1; i < st.position.length; i += 3) minY = Math.min(minY, st.position[i]);
    expect(Math.abs(minY - target)).toBeLessThan(0.06);
    expect(inside(st.position)).toBeLessThan(0.01);
  });

  it("volume maior afasta os fios do couro cabeludo", () => {
    const spread = (v: number) => {
      const { st } = strands(hairOf({ volume: v })); const O = [fr.cx, fr.earY + 0.3 * (fr.headTop - fr.earY), fr.cz];
      let s = 0; const n = st.position.length / 3; for (let i = 0; i < n; i++) s += Math.hypot(st.position[i * 3] - O[0], st.position[i * 3 + 1] - O[1], st.position[i * 3 + 2] - O[2]);
      return s / n;
    };
    expect(spread(1.8)).toBeGreaterThan(spread(0.7) + 0.002);
  });

  it("determinístico, com cacho só quando a textura pede, e numa malha com dois materiais", () => {
    const a = strands(hairOf({ length: "medium", bottom: -14, texture: "curly" })).st;
    const b = strands(hairOf({ length: "medium", bottom: -14, texture: "curly" })).st;
    expect(Array.from(a.position.slice(0, 300))).toEqual(Array.from(b.position.slice(0, 300)));
    const { base, st } = strands(hairOf({}));
    const w = withStrands(base, st, "#33241a");
    expect(w.material.length).toBe(2); expect(w.geometry.groups.length).toBe(2);
    expect(w.geometry.getAttribute("position").count).toBe(base.geometry.getAttribute("position").count + st.position.length / 3);
  });

  it("sem fios para raspado, careca e cobertura", () => {
    for (const h of [hairOf({ length: "buzz" }), hairOf({ length: "bald", present: false }), hairOf({ cover: "#4a482b" })]) {
      const base = buildHair(asset, c, normals, h, 1, { base: true });
      expect(base ? strandGeometry(asset, c, h, base, 1) : null).toBeNull();
    }
  });
});
