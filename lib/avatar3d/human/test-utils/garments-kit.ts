/**
 * Kit dos testes de roupa: o corpo do asset versionado, a medida "quanto da peça fica dentro do corpo" e o boneco
 * vestido com uma pilha de moldes (camadas por baixo viram `underLayer`).
 */
import { readFileSync } from "node:fs";
import { parseBodyAsset, type BodyMeta } from "../asset";
import { compose, fitBody } from "../compose";
import { buildHuman, baseNormals } from "../three-human";
import { applyRestPose, setArmOut } from "../pose";
import { SPECS, armOutFor, bodyParam, garmentGeometry, underLayer, type GarmentKind } from "../garments";
import { DEFAULT_BODY } from "../../body-spec";

const dir = new URL("../../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
export const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

/** Fração dos vértices da peça que ficam dentro do corpo (mais de 2 mm para dentro da pele mais próxima). */
export function inside(body: Float32Array, normals: Float32Array, pts: Float32Array, alpha: Float32Array, skip?: (i: number) => boolean): number {
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

export function dressed(sex: "FEMININO" | "MASCULINO", kinds: GarmentKind[]) {
  const c = compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature);
  const h = buildHuman(asset, c, { skin: "#c99a6e" }); const st = applyRestPose(h);
  const normals = baseNormals(c.body, asset.body.index, asset.body.renderVertex);
  const P = bodyParam(asset, c); const below: typeof SPECS[GarmentKind][] = [];
  setArmOut(h, st, armOutFor(kinds.map((k) => SPECS[k])));
  const gs = kinds.map((k) => { const g = garmentGeometry(asset, c, normals, P, SPECS[k], below.length ? underLayer(c, P, below) : null); below.push(SPECS[k]); return g!; });
  return { c, h, st, gs };
}
