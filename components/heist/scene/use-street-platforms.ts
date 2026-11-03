/*
 * MET Gala Heist v2 — avenida: geometria da rampa da doca (cunha, guarda-corpos, faixas) e das arquibancadas dos
 * fotógrafos e da imprensa (deques, guarda-corpos, câmeras, painéis e refletores), memorizada por hook.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { DOCK_RAMP, SIDEWALK_Y } from "@/lib/heist/level";
import { boxGeo, merge, place, tubeThrough, worldUV } from "./exterior-geometry";

/* ---------- rampa da doca ---------- */
export function useDockRamp() {
  return useMemo(() => {
    const { x0, x1, z0, z1 } = DOCK_RAMP, y0 = SIDEWALK_Y, y1 = 0;
    // cunha: piso inclinado (z1 em y0 até z0 em y1) e as duas faces laterais
    const top = new THREE.BufferGeometry();
    const P = (x: number, y: number, z: number) => [x, y, z];
    const v = [P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z1), P(x0, y0, z1)];
    top.setAttribute("position", new THREE.Float32BufferAttribute([...v[0], ...v[2], ...v[1], ...v[0], ...v[3], ...v[2]], 3)); top.computeVertexNormals(); worldUV(top);
    const side = (x: number, flip: boolean) => { const g = new THREE.BufferGeometry(); const a = [x, y0 - 0.3, z0], b = [x, y1, z0], c = [x, y0 - 0.3, z1], d = [x, y0, z1]; const tri = flip ? [...a, ...b, ...c, ...b, ...d, ...c] : [...a, ...c, ...b, ...b, ...c, ...d]; g.setAttribute("position", new THREE.Float32BufferAttribute(tri, 3)); g.computeVertexNormals(); return worldUV(g); };
    const concrete = merge([top, side(x0, false), side(x1, true)]);
    // guarda-corpos de aço dos dois lados (postes a cada 1 m) e as faixas de segurança no topo das laterais
    const rail: THREE.BufferGeometry[] = [];
    for (const x of [x0 + 0.06, x1 - 0.06]) {
      rail.push(tubeThrough([[x, y0 + 0.95, z1], [x, y1 + 0.95, z0 + 0.15]], 0.025, 8, 8), tubeThrough([[x, y0 + 0.5, z1], [x, y1 + 0.5, z0 + 0.15]], 0.018, 8, 8));
      for (let t = 0; t <= 4; t++) { const z = z1 - t * ((z1 - z0 - 0.15) / 4), y = y0 + (y1 - y0) * ((z1 - z) / (z1 - z0)); rail.push(place(new THREE.CylinderGeometry(0.025, 0.025, 0.95, 8), x, y + 0.475, z)); }
    }
    const stripes: THREE.BufferGeometry[] = [];
    for (const x of [x0, x1 - 0.12]) for (let t = 0; t < 8; t++) {
      const za = z1 - t * 0.5, zb = za - 0.25, ya = y0 + (y1 - y0) * ((z1 - za) / (z1 - z0)), yb = y0 + (y1 - y0) * ((z1 - zb) / (z1 - z0));
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute([x, ya + 0.006, za, x + 0.12, ya + 0.006, za, x + 0.12, yb + 0.006, zb, x, ya + 0.006, za, x + 0.12, yb + 0.006, zb, x, yb + 0.006, zb], 3)); g.computeVertexNormals(); stripes.push(worldUV(g));
    }
    return { concrete, rail: merge(rail), stripes: merge(stripes) };
  }, []);
}

/* ---------- arquibancadas dos fotógrafos e da imprensa ---------- */
export function useRisers() {
  return useMemo(() => {
    const deck: THREE.BufferGeometry[] = [], skirt: THREE.BufferGeometry[] = [], rail: THREE.BufferGeometry[] = [], gear: THREE.BufferGeometry[] = [], panels: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const xa = s < 0 ? -12 : 6, xb = s < 0 ? -6 : 12, ya = SIDEWALK_Y + 0.6, yb = SIDEWALK_Y + 1.05, zm = 27.7;
      deck.push(boxGeo(xa, ya - 0.05, 24.5, xb, ya, zm), boxGeo(xa, yb - 0.05, zm, xb, yb, 31));
      skirt.push(boxGeo(xa, SIDEWALK_Y, 24.52, xb, ya - 0.05, zm), boxGeo(xa, SIDEWALK_Y, zm, xb, yb - 0.05, 30.98));
      skirt.push(boxGeo(xa, ya, zm - 0.02, xb, yb - 0.05, zm + 0.02));                                       // espelho entre os dois níveis
      // guarda-corpo: atrás (rua, z 31), no lado de fora (x ±12) e baixo do lado do tapete (x ±6)
      const outX = s < 0 ? xa + 0.05 : xb - 0.05, inX = s < 0 ? xb - 0.05 : xa + 0.05;
      rail.push(tubeThrough([[xa, yb + 1.0, 30.95], [xb, yb + 1.0, 30.95]], 0.025, 4, 8));
      rail.push(tubeThrough([[outX, ya + 1.0, 24.6], [outX, ya + 1.0, zm], [outX, yb + 1.0, zm + 0.01], [outX, yb + 1.0, 30.95]], 0.025, 12, 8));
      rail.push(tubeThrough([[inX, ya + 0.55, 24.6], [inX, ya + 0.55, zm], [inX, yb + 0.55, zm + 0.01], [inX, yb + 0.55, 30.95]], 0.02, 12, 8));
      for (let z = 24.8; z < 31; z += 1.55) { const y = z < zm ? ya : yb; rail.push(place(new THREE.CylinderGeometry(0.022, 0.022, 1.0, 6), outX, y + 0.5, z), place(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 6), inX, y + 0.275, z)); }
      for (let x = xa + 0.4; x < xb; x += 1.5) rail.push(place(new THREE.CylinderGeometry(0.022, 0.022, 1.0, 6), x, yb + 0.5, 30.95));
      // imprensa (direita): câmeras de TV em tripés e painéis de LED virados para o tapete
      if (s > 0) {
        for (const [x, z] of [[8.4, 28.4], [10.8, 29.6]]) {
          const y = yb;
          for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; gear.push(tubeThrough([[x, y + 1.3, z], [x + Math.cos(a) * 0.45, y, z + Math.sin(a) * 0.45]], 0.015, 2, 6)); }
          gear.push(boxGeo(x - 0.35, y + 1.3, z - 0.14, x + 0.28, y + 1.62, z + 0.14));                        // corpo da câmera
          gear.push(place(new THREE.CylinderGeometry(0.09, 0.11, 0.42, 14).rotateZ(Math.PI / 2), x - 0.56, y + 1.47, z));   // objetiva (para o tapete, −x)
        }
        for (const [x, z] of [[6.6, 25.6], [6.6, 29.8]]) {
          const y = z < zm ? ya : yb;
          gear.push(tubeThrough([[x + 0.3, y, z], [x + 0.3, y + 2.3, z]], 0.02, 2, 6));
          gear.push(boxGeo(x + 0.22, y + 1.9, z - 0.42, x + 0.3, y + 2.6, z + 0.42));
          panels.push(boxGeo(x + 0.19, y + 1.96, z - 0.36, x + 0.215, y + 2.54, z + 0.36));
        }
      }
    }
    // refletor de fachada no deque de cima, apontado para as colunas: forquilha, corpo com aletas e a lente
    const flood: THREE.BufferGeometry[] = [], lens: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const x = s * 8.5, y = SIDEWALK_Y + 1.05, z = 30.55, aim = new THREE.Matrix4().makeRotationX(-2.21).setPosition(x, y + 0.42, z);   // lente (+z local) para cima e para o norte
      flood.push(boxGeo(x - 0.22, y, z - 0.14, x + 0.22, y + 0.06, z + 0.14), boxGeo(x - 0.24, y + 0.06, z - 0.03, x - 0.2, y + 0.46, z + 0.03), boxGeo(x + 0.2, y + 0.06, z - 0.03, x + 0.24, y + 0.46, z + 0.03));
      const body = merge([boxGeo(-0.19, -0.16, -0.14, 0.19, 0.16, 0.12), ...[-0.12, -0.04, 0.04, 0.12].map((dx) => boxGeo(dx - 0.012, -0.17, -0.2, dx + 0.012, 0.17, -0.14))]); body.applyMatrix4(aim); flood.push(body);
      const l = boxGeo(-0.16, -0.13, 0.12, 0.16, 0.13, 0.13); l.applyMatrix4(aim); lens.push(l);
    }
    return { deck: merge(deck), skirt: merge(skirt), rail: merge(rail), gear: merge(gear), panels: merge(panels), flood: merge(flood), lens: merge(lens) };
  }, []);
}
