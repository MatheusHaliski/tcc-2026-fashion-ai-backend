/*
 * MET Gala Heist v2 — avenida: mobiliário repetido da avenida — cordões de veludo, grades dos fãs e cavaletes, postes de
 * ferro fundido e de LED, árvores — memorizado por hook (matrizes de instância e geometrias fundidas).
 */
import { useMemo } from "react";
import * as THREE from "three";
import { floorY, SIDEWALK_Y } from "@/lib/heist/level";
import type { Prop } from "@/lib/heist/types";
import { boxGeo, inst, lathe, merge, place, ropeGeo, tubeThrough } from "./exterior-geometry";
import { prng, type Quality } from "./exterior-textures";
import { FAR_END } from "./exterior-street-layout";

/* ---------- cordões de veludo ---------- */
export function useRopes(props: Prop[]) {
  return useMemo(() => {
    const posts: THREE.Matrix4[] = [], ropes: THREE.BufferGeometry[] = [];
    for (const p of props) {
      if (p.kind !== "rope" || p.shape.type !== "box") continue;
      const b = p.shape, alongX = b.x1 - b.x0 > b.z1 - b.z0;
      const a0 = alongX ? b.x0 : b.z0, a1 = alongX ? b.x1 : b.z1, c = alongX ? (b.z0 + b.z1) / 2 : (b.x0 + b.x1) / 2;
      const n = Math.max(1, Math.round((a1 - a0) / 1.45)), pts: THREE.Vector3[] = [];
      for (let k = 0; k <= n; k++) {
        const a = a0 + ((a1 - a0) * k) / n, x = alongX ? a : c, z = alongX ? c : a, y = floorY({ x, z });
        posts.push(inst(x, y, z)); pts.push(new THREE.Vector3(x, y + 0.88, z));
      }
      for (let k = 0; k < pts.length - 1; k++) ropes.push(ropeGeo(pts[k], pts[k + 1], 0.16, 0.022, 10));
    }
    // pedestal de latão: base em disco, haste e a bola em cima com o gancho
    const post = merge([lathe([[0, 0], [0.17, 0], [0.17, 0.03], [0.12, 0.06], [0.03, 0.08], [0.022, 0.1], [0.022, 0.86], [0.04, 0.88], [0.05, 0.93], [0.03, 0.98], [0, 0.99]], 18)]);
    return { posts, post, ropes: merge(ropes) };
  }, [props]);
}

/* ---------- grades dos fãs e bloqueios das pontas ---------- */
export function useBarriers(props: Prop[]) {
  return useMemo(() => {
    const sections: THREE.Matrix4[] = [];
    for (const p of props) {
      if (p.kind !== "barrier" || p.shape.type !== "box") continue;
      const b = p.shape, z = (b.z0 + b.z1) / 2, n = Math.max(1, Math.round((b.x1 - b.x0) / 2.4)), w = (b.x1 - b.x0) / n;
      for (let k = 0; k < n; k++) sections.push(inst(b.x0 + w * (k + 0.5), SIDEWALK_Y, z, 0, [w / 2.4, 1, 1]));
    }
    // seção de grade francesa de 2,4 m: travessas, barras verticais a cada 10 cm e pés chatos
    const parts: THREE.BufferGeometry[] = [];
    parts.push(tubeThrough([[-1.18, 0.12, 0], [-1.18, 1.08, 0], [1.18, 1.08, 0], [1.18, 0.12, 0]], 0.022, 16, 8));
    parts.push(tubeThrough([[-1.18, 0.22, 0], [1.18, 0.22, 0]], 0.016, 2, 6));
    for (let x = -1.08; x <= 1.081; x += 0.1) parts.push(place(new THREE.CylinderGeometry(0.008, 0.008, 0.86, 5), x, 0.65, 0));
    for (const x of [-1.05, 1.05]) parts.push(boxGeo(x - 0.03, 0, -0.32, x + 0.03, 0.04, 0.32), place(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 5), x, 0.12, 0));
    // cavaletes "VIA INTERDITADA" fechando a avenida nas pontas (fora da área jogável)
    const saw: THREE.Matrix4[] = [];
    for (const x of [-30.7, 30.7]) for (let z = 25; z < FAR_END - 0.5; z += 2.6) saw.push(inst(x, floorY({ x: Math.sign(x) * 29.9, z }), z, Math.PI / 2));
    const sawGeo = merge([boxGeo(-1.2, 0.72, -0.02, 1.2, 0.98, 0.02), boxGeo(-1.2, 0.38, -0.02, 1.2, 0.56, 0.02)]);
    const sawLegs = merge([-1.05, 1.05].flatMap((x) => [tubeThrough([[x, 1.0, 0], [x - 0.12, 0, -0.3]], 0.025, 2, 6), tubeThrough([[x, 1.0, 0], [x + 0.12, 0, 0.3]], 0.025, 2, 6)]));
    return { sections, section: merge(parts), saw, sawGeo, sawLegs };
  }, [props]);
}


/* ---------- postes de ferro fundido ---------- */
export function useLamps(props: Prop[]) {
  return useMemo(() => {
    const at = props.filter((p) => p.kind === "lampPost" && p.shape.type === "circle").map((p) => p.shape as { x: number; z: number });
    const posts = at.filter((s) => s.z < 38).map((s) => inst(s.x, floorY(s), s.z, 0));
    const leds = at.filter((s) => s.z >= 38).map((s) => inst(s.x, floorY(s), s.z, Math.PI));
    // base canelada, haste afinando, colar e a lanterna de quatro vidros com o teto em cúpula
    const iron = merge([
      lathe([[0, 0], [0.26, 0], [0.26, 0.12], [0.2, 0.18], [0.21, 0.5], [0.16, 0.62], [0.12, 0.66], [0.1, 0.9], [0.075, 3.9], [0.1, 3.96], [0.1, 4.04], [0.06, 4.1], [0, 4.1]], 16),
      lathe([[0, 4.1], [0.12, 4.1], [0.2, 4.14], [0.22, 4.18], [0.16, 4.2], [0, 4.2]], 12),
      lathe([[0, 4.92], [0.26, 4.92], [0.28, 4.96], [0.2, 5.05], [0.1, 5.16], [0.04, 5.3], [0.05, 5.36], [0, 5.42]], 12),
      ...[0, 1, 2, 3].map((k) => { const a = (k * Math.PI) / 2 + Math.PI / 4; return place(new THREE.BoxGeometry(0.025, 0.74, 0.025), Math.cos(a) * 0.19, 4.56, Math.sin(a) * 0.19); }),
    ]);
    const glass = lathe([[0.12, 4.2], [0.2, 4.4], [0.2, 4.9], [0.17, 4.92]], 4, Math.PI / 4);
    // poste de aço galvanizado de 8 m (octogonal, afinando), porta de inspeção, braço curvo e a luminária de LED
    const steel = merge([
      boxGeo(-0.22, 0, -0.22, 0.22, 0.04, 0.22),
      lathe([[0, 0.04], [0.12, 0.04], [0.115, 1.0], [0.07, 8.1], [0, 8.12]], 8),
      boxGeo(-0.06, 0.45, 0.1, 0.06, 0.85, 0.125),
      tubeThrough([[0, 7.75, 0], [0, 8.2, 0.6], [0, 8.3, 1.3], [0, 8.32, 1.65]], 0.045, 10, 8),
      place(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.24, 0.12, 0.42), 0, 8.22, 1.85),
    ]);
    const lens = boxGeo(-0.17, 8.2, 1.55, 0.17, 8.215, 2.15);
    return { posts, leds, iron, glass, steel, lens };
  }, [props]);
}

/* ---------- árvores ---------- */
export function useTrees(props: Prop[], q: Quality) {
  return useMemo(() => {
    const trunks: THREE.BufferGeometry[] = [], grates: THREE.BufferGeometry[] = [], cards: THREE.Matrix4[] = [];
    const r = prng(23);
    for (const p of props) {
      if (p.kind !== "tree" || p.shape.type !== "circle") continue;
      const { x, z } = p.shape, y = floorY({ x, z });
      // tronco de plátano com a casca clara manchada, dois galhos principais
      trunks.push(place(lathe([[0, 0], [0.2, 0], [0.16, 0.4], [0.14, 2.6], [0.11, 3.6], [0, 3.7]], 10), x, y, z));
      for (let k = 0; k < 4; k++) { const a = r() * Math.PI * 2, h = 2.4 + r() * 1.1; trunks.push(tubeThrough([[x, y + h, z], [x + Math.cos(a) * 1.4, y + h + 1.4, z + Math.sin(a) * 1.4], [x + Math.cos(a) * 2.1, y + h + 2.6, z + Math.sin(a) * 2.1]], 0.07, 6, 6)); }
      // grade de ferro em volta do canteiro
      grates.push(boxGeo(x - 0.8, y, z - 0.8, x + 0.8, y + 0.02, z + 0.8));
      for (const [ax, az, bx, bz] of [[-0.8, -0.8, 0.8, -0.8], [0.8, -0.8, 0.8, 0.8], [0.8, 0.8, -0.8, 0.8], [-0.8, 0.8, -0.8, -0.8]]) grates.push(tubeThrough([[x + ax, y + 0.42, z + az], [x + bx, y + 0.42, z + bz]], 0.012, 2, 5));
      // copa: cartões de folhas espalhados num elipsoide (mais cheio em cima)
      const n = q === "high" ? 140 : 70;
      for (let k = 0; k < n; k++) {
        const u = r() * Math.PI * 2, v = Math.acos(2 * r() - 1), rr = Math.cbrt(r());
        const cx = x + Math.sin(v) * Math.cos(u) * 2.6 * rr, cy = y + 5.1 + Math.cos(v) * 1.8 * rr, cz = z + Math.sin(v) * Math.sin(u) * 2.6 * rr;
        cards.push(new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * Math.PI, r() * Math.PI, r() * Math.PI)), new THREE.Vector3(1, 1, 1).multiplyScalar(0.9 + r() * 0.7)));
      }
    }
    return { trunks: merge(trunks), grates: merge(grates), cards };
  }, [props, q]);
}
