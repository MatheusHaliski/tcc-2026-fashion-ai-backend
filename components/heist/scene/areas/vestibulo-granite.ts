/*
 * MET Gala Heist v2 — Vestíbulo: o campo de granito polido do piso. Losangos de placas de 60 cm na diagonal, preto
 * absoluto (cristais de mica) e branco salpicado (biotita, quartzo, feldspato rosado), junta de ~2 mm e bisotê; a cor,
 * altura e rugosidade de cada pedra (`graniteAt`) também servem aos ladrilhos de padrão das texturas desenhadas.
 */
import * as THREE from "three";
import type { Quality } from "../interior-tex";
import { fbm, mix, smooth, vMat, vSurface, vnoise, type VSurface } from "./vestibulo-kit";

/** Losango central branco e os quatro cantos pretos (a outra cor) em cada repetição; junta de ~2 mm entre as placas. */
export function graniteFieldSurface(n: number): VSurface {
  return vSurface(`graniteField${n}`, n, n, (u, v, o) => {
    const d = Math.abs(u - 0.5) + Math.abs(v - 0.5), white = d < 0.5, edge = Math.abs(d - 0.5) * 0.7071;
    graniteAt(u, v, white, o);
    if (edge < 0.0016) { o[0] = o[1] = o[2] = white ? 0.26 : 0.2; o[3] = 0.3; o[4] = 0.55; }
    else if (edge < 0.003) { o[3] = 0.47; }                                     // aresta levemente quebrada (bisotê)
  }, 0.5);
}
/** Cor, altura e rugosidade do granito: branco (pintas de biotita, quartzo) ou preto absoluto (cristais de mica). */
export function graniteAt(u: number, v: number, white: boolean, o: Float32Array) {
  if (white) {
    const big = vnoise(u * 150, v * 150, 150, 601), fine = vnoise(u * 360, v * 360, 360, 603), cl = fbm(u, v, 4, 605, 3), q = vnoise(u * 90, v * 90, 90, 607);
    let r = 0.79 + 0.06 * cl, g = 0.78 + 0.06 * cl, b = 0.76 + 0.06 * cl, ro = 0.11;
    if (q > 0.7) { const k = smooth(0.7, 0.8, q) * 0.45; r = mix(r, 0.6, k); g = mix(g, 0.61, k); b = mix(b, 0.63, k); ro = 0.06; }
    if (big > 0.76) { const k = smooth(0.76, 0.81, big); r = mix(r, 0.09, k); g = mix(g, 0.09, k); b = mix(b, 0.1, k); }
    else if (fine > 0.82) { const k = smooth(0.82, 0.88, fine) * 0.8; r = mix(r, 0.16, k); g = mix(g, 0.16, k); b = mix(b, 0.17, k); }
    else if (fine < 0.1) { r = mix(r, 0.86, 0.5); g = mix(g, 0.78, 0.5); b = mix(b, 0.74, 0.5); }      // feldspato rosado
    o[0] = r; o[1] = g; o[2] = b; o[3] = 0.5; o[4] = ro;
  } else {
    const f = vnoise(u * 420, v * 420, 420, 611), cl = fbm(u, v, 5, 613, 3), m = vnoise(u * 210, v * 210, 210, 615);
    let k = 0.028 + 0.014 * cl; if (m > 0.84) k += 0.05 * smooth(0.84, 0.9, m);
    const fleck = f > 0.9;
    o[0] = fleck ? 0.22 : k; o[1] = fleck ? 0.22 : k; o[2] = fleck ? 0.24 : k * 1.12; o[3] = 0.5; o[4] = fleck ? 0.03 : 0.065;
  }
}
/** Material do campo (a casca troca o nome para "floor-vestibulo" e põe o reflexo planar pelo SurfaceOverride). */
export function floorMaterial(q: Quality): THREE.MeshStandardMaterial {
  return vMat(`floorField-${q}`, () => {
    const sf = graniteFieldSurface(q === "high" ? 1024 : 512);
    return new THREE.MeshStandardMaterial({ map: sf.map, normalMap: sf.normalMap, roughnessMap: sf.roughnessMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1, vertexColors: true, envMapIntensity: 1.1 });
  });
}
