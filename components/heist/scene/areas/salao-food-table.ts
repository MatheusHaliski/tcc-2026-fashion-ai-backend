/*
 * MET Gala Heist v2 — Grande Salão — a mesa de banquete vestida (mesa de doces e bufê): toalha de linho com a saia
 * plissada até o chão, trilho de cetim champanhe com galão dourado e a guirlanda de rosas e folhas em três arcos na
 * frente da saia. Tudo instanciado por tipo (uma chamada por rosa e por folha).
 */
import * as THREE from "three";
import { geo } from "../interior-batch";
import type { PropsCtx } from "../interior-props";
import { roseGeometry } from "../interior-hall";
import { ROOM, L, bx, rand, roundedBox, salaoFabric, salaoSolid, type Foot } from "./salao-kit";


export const TOP = 0.9;
const col = (h: string) => new THREE.Color(h);

/* ---------- toalha de linho com saia plissada até o chão ---------- */
function pleatedSkirt(key: string, w: number, d: number, h: number): THREE.BufferGeometry {
  return geo(`salao-skirt-${key}`, () => {
    // contorno do retângulo, pregas a cada 0,12 m (dobra que sai e entra), da borda do tampo até 1 cm do piso
    const per = 2 * (w + d), n = Math.round(per / 0.03), pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
    const at = (s: number): [number, number, number, number] => {
      let t = ((s % per) + per) % per;
      if (t < w) return [-w / 2 + t, d / 2, 0, 1]; t -= w;
      if (t < d) return [w / 2, d / 2 - t, 1, 0]; t -= d;
      if (t < w) return [w / 2 - t, -d / 2, 0, -1]; t -= w;
      return [-w / 2, -d / 2 + t, -1, 0];
    };
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * per, [x, z, nx, nz] = at(s), fold = 0.018 * Math.sin((s / 0.12) * Math.PI * 2);
      for (const [y, flare] of [[h, 0], [0.01, 0.02]] as [number, number][]) {
        pos.push(x + nx * (fold + flare), y, z + nz * (fold + flare)); nor.push(nx, 0, nz); uv.push(s / 1.2, y / h);
      }
    }
    for (let i = 0; i < n; i++) { const a = i * 2, b = a + 2; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals(); return g;
  });
}
/** Mesa de banquete vestida: tampo com toalha, saia plissada, trilho de cetim champanhe com galão dourado. */
export function dressedTable(c: PropsCtx, f: Foot, key: string) {
  const P = c.P, linen = P.linen, w = f.w, d = f.d;
  c.batch.add(ROOM, linen, roundedBox(`cloth-${key}`, w + 0.05, 0.035, d + 0.05, 0.012), L(f, 0, TOP - 0.035, 0), { cast: true });
  c.batch.add(ROOM, linen, pleatedSkirt(key, w + 0.04, d + 0.04, TOP - 0.02), L(f, 0, 0, 0), { cast: true });
  const satin = salaoFabric("satin", "#e8d3a6", c.q, { sheen: "#fff3d6", rough: 0.4 });
  bx(c.batch, satin, f, 0, TOP, 0.02, w - 0.3, 0.003, d * 0.55);
  for (const s of [-1, 1]) bx(c.batch, P.gold, f, 0, TOP, 0.02 + s * d * 0.275, w - 0.3, 0.004, 0.012);
}
/** Guirlanda de rosas e folhas em três arcos na frente da saia. */
export function garland(c: PropsCtx, f: Foot, w: number, d: number) {
  const rose = roseGeometry(c.q), roseMat = salaoSolid("roseWhite", "#ffffff", { rough: 0.72, side: THREE.DoubleSide, env: 0.4 }), leafMat = salaoSolid("leaf", "#3d5f33", { rough: 0.7, side: THREE.DoubleSide });
  const leaf = geo("salao-leafCard", () => new THREE.PlaneGeometry(0.06, 0.03)), R = rand(Math.round(f.cx * 13 + f.cz * 7));
  const tones = [col("#f6d4dc"), col("#ffffff"), col("#f2b7c6"), col("#fbe7d0")];
  const swags = 3, sw = (w - 0.2) / swags;
  for (let k = 0; k < swags; k++) for (let i = 0; i <= 14; i++) {
    const t = i / 14, x = -w / 2 + 0.1 + (k + t) * sw, y = TOP - 0.05 - Math.sin(Math.PI * t) * 0.22, z = d / 2 + 0.05;
    c.inst.add(ROOM, "salao-garlandRose", rose, roseMat, L(f, x, y, z, R() * 6, 0.035 + R() * 0.012, 0.035 + R() * 0.012, 0.035 + R() * 0.012, 1.3, 0), tones[Math.floor(R() * tones.length)]);
    if (i % 2 === 0) c.inst.add(ROOM, "salao-garlandLeaf", leaf, leafMat, L(f, x + 0.03, y - 0.02, z + 0.01, R() * 3, 1, 1, 1, 0.6, R()));
  }
}
