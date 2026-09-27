import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { buildHuman, baseNormals } from "./three-human";
import { applyIdle, applyRestPose, setArmOut } from "./pose";
import { SPECS, bodyParam, garmentGeometry, kindOf, posedPositions, underLayer, type GarmentKind } from "./garments";
import { DEFAULT_BODY } from "../body-spec";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

/** Fração dos vértices da peça que ficam dentro do corpo (mais de 2 mm para dentro da pele mais próxima). */
function inside(body: Float32Array, normals: Float32Array, pts: Float32Array, alpha: Float32Array, skip?: (i: number) => boolean): number {
  const cell = 0.03; const grid = new Map<string, number[]>();
  const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let v = 0; v < body.length / 3; v++) { const k = key(body[v * 3], body[v * 3 + 1], body[v * 3 + 2]); (grid.get(k) ?? grid.set(k, []).get(k)!).push(v); }
  let n = 0, bad = 0;
  for (let i = 0; i < pts.length / 3; i++) {
    if (alpha[i] < 0.5 || skip?.(i)) continue; n++;
    const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2]; let best = -1, bd = Infinity;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) for (const v of grid.get(`${cx + a},${cy + b},${cz + c}`) ?? []) {
      const d = (body[v * 3] - x) ** 2 + (body[v * 3 + 1] - y) ** 2 + (body[v * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = v; }
    }
    if (best < 0) continue;
    const dot = (x - body[best * 3]) * normals[best * 3] + (y - body[best * 3 + 1]) * normals[best * 3 + 1] + (z - body[best * 3 + 2]) * normals[best * 3 + 2];
    if (dot < -0.002) bad++;
  }
  return n ? bad / n : 0;
}

function dressed(sex: "FEMININO" | "MASCULINO", kinds: GarmentKind[]) {
  const c = compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature);
  const h = buildHuman(asset, c, { skin: "#c99a6e" }); const st = applyRestPose(h);
  const normals = baseNormals(c.body, asset.body.index, asset.body.renderVertex);
  const P = bodyParam(asset, c); const below: typeof SPECS[GarmentKind][] = [];
  if (kinds.some((k) => SPECS[k].skirt > 0)) setArmOut(h, st, 15);
  const gs = kinds.map((k) => { const g = garmentGeometry(asset, c, normals, P, SPECS[k], below.length ? underLayer(c, P, below) : null); below.push(SPECS[k]); return g!; });
  return { c, h, st, gs };
}

describe("roupa que veste — moldes presos ao esqueleto", () => {
  it("reconhece o tipo de molde pela subcategoria da peça", () => {
    expect(kindOf({ subcategory: "t_shirt" })).toBe("tee");
    expect(kindOf({ subcategory: "jeans" })).toBe("pants");
    expect(kindOf({ subcategory: "dress" })).toBe("dress");
    expect(kindOf({ subcategory: "sneakers" })).toBe("shoes");
    expect(kindOf({ subcategory: "ankle_boots" })).toBe("boots");
    expect(kindOf({ subcategory: "hoodie" })).toBe("hoodie");
    expect(kindOf({ subcategory: "sunglasses" })).toBeNull();
    expect(kindOf({ category: "LOWER", subcategory: "" })).toBe("pants");
  });

  for (const sex of ["FEMININO", "MASCULINO"] as const) {
    it(`${sex}: camiseta, calça, vestido e tênis não atravessam o corpo, parado e em movimento`, () => {
      const { c, h, st, gs } = dressed(sex, ["pants", "tee", "shoes"]);
      const D = dressed(sex, ["dress"]);
      for (const [g, H] of [...gs.map((x) => [x, { c, h, st }] as const), [D.gs[0], D] as const]) {
        const { c, h, st } = H;
        expect(g.index.length).toBeGreaterThan(300);
        for (const t of [-1, 2.5, 7.3]) {                       // −1 = pose de repouso do esqueleto (pose A)
          if (t < 0) { for (const b of h.bones) b.quaternion.identity(); h.bone("Hips").position.copy(st.hips); } else applyIdle(h, st, t, 1);
          const bodyPosed = posedPositions(h.skeleton, h.body.bindMatrix, c.body, asset.body.skinIndex, Float32Array.from(asset.body.skinWeight, (w) => w / 255));
          const n = baseNormals(bodyPosed, asset.body.index, asset.body.renderVertex);
          const gp = posedPositions(h.skeleton, h.body.bindMatrix, g.position, g.skinIndex, g.skinWeight);
          // tudo: < 3% (o resto é a axila, que o braço esconde, e o vão entre os dedos dentro do calçado)
          expect(inside(bodyPosed, n, gp, g.alpha)).toBeLessThan(0.03);
          // fora dessas zonas escondidas: < 0,5%
          const P = bodyParam(asset, c);
          const hidden = (i: number) => { const v = g.source[i]; if (v < 0) return false;
            return (P.group[v] === 2 && P.arm[v] < 0.4 && P.h[v] > 0.4 && P.h[v] < 0.85) || (P.group[v] === 1 && P.h[v] > 0.45 && P.h[v] < 0.8 && Math.abs(c.body[v * 3]) > 0.1) || P.group[v] === 4; };
          expect(inside(bodyPosed, n, gp, g.alpha, hidden)).toBeLessThan(0.005);
        }
      }
    });
  }

  it("a peça de cima passa por fora da de baixo na cintura", () => {
    const { c, gs: [pants, tee] } = dressed("MASCULINO", ["pants", "tee"]);
    // vértices que nasceram do mesmo ponto do corpo: a camiseta fica mais afastada que a calça
    const byPants = new Map<number, number>(); for (let i = 0; i < pants.source.length; i++) if (pants.source[i] >= 0) byPants.set(pants.source[i], i);
    let n = 0, out = 0;
    for (let i = 0; i < tee.source.length; i++) {
      const v = tee.source[i]; const j = byPants.get(v); if (j === undefined || tee.alpha[i] < 0.5 || pants.alpha[j] < 0.5) continue; n++;
      const dt = Math.hypot(tee.position[i * 3] - c.body[v * 3], tee.position[i * 3 + 1] - c.body[v * 3 + 1], tee.position[i * 3 + 2] - c.body[v * 3 + 2]);
      const dp = Math.hypot(pants.position[j * 3] - c.body[v * 3], pants.position[j * 3 + 1] - c.body[v * 3 + 1], pants.position[j * 3 + 2] - c.body[v * 3 + 2]);
      if (dt > dp) out++;
    }
    expect(n).toBeGreaterThan(50);
    expect(out / n).toBeGreaterThan(0.97);
  });

  it("o molde herda os pesos do corpo (4 ossos, somando 1)", () => {
    const { gs: [tee] } = dressed("FEMININO", ["tee"]);
    for (let i = 0; i < tee.skinWeight.length; i += 4) expect(tee.skinWeight[i] + tee.skinWeight[i + 1] + tee.skinWeight[i + 2] + tee.skinWeight[i + 3]).toBeCloseTo(1, 2);
    void THREE;
  });
});
