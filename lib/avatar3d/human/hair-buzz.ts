/*
 * Avatar 3D (RF40) — cabelo raspado: o próprio couro cabeludo afastado alguns milímetros.
 */
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import type { AvatarHair } from "../model";
import { smooth } from "./hair-math";
import { hairline, scalpRegions, type HeadFrame } from "./hair-scalp";
import { finish, type HairBuild } from "./hair-material";

/** Raspado: o próprio couro cabeludo, 2–3 mm para fora, com a linha do cabelo desfiada. */
export function buzzShell(a: BodyAsset, c: Composed, normals: Float32Array, hair: AvatarHair, fr: HeadFrame): HairBuild | null {
  const nb = a.meta.counts.body;
  const scalp = scalpRegions(a);
  const headBone = a.meta.bones.findIndex((b) => b.name === "mixamorig:Head");
  const inScalp = new Uint8Array(nb); const phiOf = new Float32Array(nb);
  for (let v = 0; v < nb; v++) {
    if (a.body.skinIndex[v * 4] !== headBone || scalp.ear[v]) continue;
    const x = c.body[v * 3] - fr.cx, z = c.body[v * 3 + 2] - fr.cz; const phi = Math.atan2(x, z); phiOf[v] = phi;
    if (c.body[v * 3 + 1] >= hairline(fr, hair, phi, false) - 0.02) inScalp[v] = 1;
  }
  const rv = a.body.renderVertex; const idx = a.body.index; const map = new Map<number, number>();
  const pos: number[] = [], uv: number[] = [], si: number[] = [], sw: number[] = [], col: number[] = [], index: number[] = [];
  const add = (v: number) => {
    let i = map.get(v); if (i !== undefined) return i; i = pos.length / 3; map.set(v, i);
    const t = 0.0025;
    pos.push(c.body[v * 3] + normals[v * 3] * t, c.body[v * 3 + 1] + normals[v * 3 + 1] * t, c.body[v * 3 + 2] + normals[v * 3 + 2] * t);
    uv.push((phiOf[v] / (2 * Math.PI) + 0.5) * 10, (fr.headTop - c.body[v * 3 + 1]) / 0.25);
    for (let j = 0; j < 4; j++) { const w = a.body.skinWeight[v * 4 + j]; si.push(w ? a.body.skinIndex[v * 4 + j] : 0); sw.push(w / 255); }
    const hl = hairline(fr, hair, phiOf[v], false); col.push(1, 1, 1, smooth(hl - 0.02, hl + 0.006, c.body[v * 3 + 1]) * scalp.edge[v]);
    return i;
  };
  for (let t = 0; t < idx.length; t += 3) { const p = rv[idx[t]], q = rv[idx[t + 1]], r = rv[idx[t + 2]]; if (inScalp[p] && inScalp[q] && inScalp[r]) index.push(add(p), add(q), add(r)); }
  return index.length ? finish(pos, uv, col, si, sw, index, hair.color!, "straight", false, false, hair.variation ?? 0) : null;
}
