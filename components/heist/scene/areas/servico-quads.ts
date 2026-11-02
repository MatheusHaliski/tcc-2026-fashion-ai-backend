/*
 * MET Gala Heist v2 — Labirinto de serviço: a altura do forro e a montagem dos quads com UV no mundo (piso, forro e
 * faces de parede) e a divisão das faces pela zona do piso em frente (copa x corredor). Saiu de servico.ts sem mudança.
 */
import { QuadBuilder } from "../interior-batch";
import { zoneOf, type WFace } from "./servico-kit";

export const H = 3.2;                                                                   // forro = topo das divisórias
/** Quad horizontal (piso ou forro) com UV no mundo (`tu` m por repetição). */
export function flatQuad(b: QuadBuilder, x0: number, z0: number, x1: number, z1: number, y: number, up: boolean, tu: number, rot = false) {
  const uv = (x: number, z: number) => (rot ? [z / tu, x / tu] : [x / tu, z / tu]);
  if (up) b.quad([[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], [0, 1, 0], [uv(x0, -z1), uv(x1, -z1), uv(x1, -z0), uv(x0, -z0)]);
  else b.quad([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [0, -1, 0], [uv(x0, z0), uv(x1, z0), uv(x1, z1), uv(x0, z1)]);
}
/** Quad vertical colado na face da parede (afastado `off`), de y0 a y1, UV no mundo. */
export function wallQuad(b: QuadBuilder, f: { axis: "x" | "z"; plane: number; dir: number }, a: number, c: number, y0: number, y1: number, off: number, tu: number, tv: number) {
  if (f.axis === "x") {
    const x = f.plane + f.dir * off, n = [f.dir, 0, 0];
    const p = f.dir > 0 ? [[x, y0, c], [x, y0, a], [x, y1, a], [x, y1, c]] : [[x, y0, a], [x, y0, c], [x, y1, c], [x, y1, a]];
    b.quad(p, n, p.map((v) => [v[2] / tu, v[1] / tv]));
  } else {
    const z = f.plane + f.dir * off, n = [0, 0, f.dir];
    const p = f.dir > 0 ? [[a, y0, z], [c, y0, z], [c, y1, z], [a, y1, z]] : [[c, y0, z], [a, y0, z], [a, y1, z], [c, y1, z]];
    b.quad(p, n, p.map((v) => [v[0] / tu, v[1] / tv]));
  }
}
/** Divide a face em trechos de 0,5 m pela zona do piso em frente (copa x corredor). */
export function faceZones(f: WFace): { a: number; b: number; zone: string }[] {
  const out: { a: number; b: number; zone: string }[] = [];
  for (let s = f.a; s < f.b - 1e-6; s += 0.5) {
    const m = s + 0.25, x = f.axis === "x" ? f.plane + f.dir * 0.25 : m, z = f.axis === "x" ? m : f.plane + f.dir * 0.25, zone = zoneOf(x, z), last = out[out.length - 1];
    if (last && last.zone === zone && Math.abs(last.b - s) < 1e-6) last.b = s + 0.5; else out.push({ a: s, b: s + 0.5, zone });
  }
  return out;
}
