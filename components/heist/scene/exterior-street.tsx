"use client";
/*
 * MET Gala Heist v2 — o chão e o mobiliário da avenida na noite da gala: calçadas de placas, meio-fio de granito, pista
 * molhada com faixas e a faixa de pedestres, a escadaria de 12 degraus com o tapete da gala subindo do meio-fio até as
 * portas, a rampa da doca, as arquibancadas dos fotógrafos e da imprensa (câmeras de TV, painéis de luz), os cordões de
 * veludo com pedestais de latão (tapete e fila), o pódio da recepção, os arranjos florais, as grades azuis dos fãs, os
 * bloqueios "VIA INTERDITADA" nas pontas da avenida, os postes de ferro fundido, as árvores, o hidrante, a barraca do
 * revendedor e a sinalização do que é público e do que é restrito.
 *
 * Tudo que tem colisão segue baseProps() (lib/heist/level.ts): cada peça é desenhada na caixa/círculo dela. O que não
 * tem colisão fica onde ninguém anda (cercados, fachadas, fora da área jogável).
 */
import { useMemo } from "react";
import * as THREE from "three";
import { baseProps, CIVILIANS, floorY, SIDEWALK_Y, ROAD_Y, STAIRS, DOCK_RAMP } from "@/lib/heist/level";
import type { Prop } from "@/lib/heist/types";
import { boxGeo, inst, lathe, merge, place, ropeGeo, tubeThrough, worldUV } from "./exterior-geometry";
import { exteriorMaterials, type ExteriorMaterials } from "./exterior-materials";
import { fanSignTex, leafTex, signTex, SIGNAGE, prng, type Quality } from "./exterior-textures";
import { Instanced } from "./exterior-facade";

export const X_FAR = 90;                           // até onde a avenida segue (some na névoa)
const CURB0 = 32.85, CURB1 = 33.05, FAR0 = 42.95, FAR1 = 43.15, FAR_END = 53;
const STEP_D = (STAIRS.bottom - STAIRS.top) / STAIRS.steps;
const stepY = (k: number) => (SIDEWALK_Y * k) / STAIRS.steps;     // degrau k (1…12): 0 = patamar

export const streetProps = (): Prop[] => baseProps().filter((p) => p.room === "rua" || p.room === "beco");
/** Plano da pista (reflexo real no "high": exterior.tsx escolhe o material). */
let roadGeo: THREE.BufferGeometry | null = null;
export function roadGeometry(): THREE.BufferGeometry {
  if (!roadGeo) { roadGeo = new THREE.PlaneGeometry(X_FAR * 2, FAR0 - CURB1, 1, 1); roadGeo.rotateX(-Math.PI / 2); roadGeo.translate(0, ROAD_Y, (CURB1 + FAR0) / 2); worldUV(roadGeo); }
  return roadGeo;
}

/* ---------- chão ---------- */
function useGround() {
  return useMemo(() => {
    const sidewalk: THREE.BufferGeometry[] = [], curb: THREE.BufferGeometry[] = [];
    // calçada do museu (fora da escadaria e da rampa da doca), do meio-fio até a fachada
    for (const [x0, x1, z0] of [[-X_FAR, DOCK_RAMP.x0, 24.5], [DOCK_RAMP.x0, DOCK_RAMP.x1, DOCK_RAMP.z1], [DOCK_RAMP.x1, STAIRS.x0, 24.5], [STAIRS.x0, STAIRS.x1, STAIRS.bottom], [STAIRS.x1, X_FAR, 24.5]] as const) sidewalk.push(boxGeo(x0, SIDEWALK_Y - 0.3, z0, x1, SIDEWALK_Y, CURB0));
    // calçada de lá (fãs, revendedor)
    sidewalk.push(boxGeo(-X_FAR, SIDEWALK_Y - 0.3, FAR1, X_FAR, SIDEWALK_Y, FAR_END));
    // meio-fio de granito dos dois lados (a face desce até a pista)
    curb.push(boxGeo(-X_FAR, ROAD_Y - 0.2, CURB0, X_FAR, SIDEWALK_Y, CURB1), boxGeo(-X_FAR, ROAD_Y - 0.2, FAR0, X_FAR, SIDEWALK_Y, FAR1));
    // faixas: linha dupla amarela no meio, tracejadas brancas, faixa de pedestres a oeste e as linhas de retenção
    const yellow: THREE.BufferGeometry[] = [], white: THREE.BufferGeometry[] = [];
    const stripe = (x0: number, z0: number, x1: number, z1: number, to: THREE.BufferGeometry[]) => { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, ROAD_Y + 0.004, (z0 + z1) / 2); to.push(worldUV(g)); };
    stripe(-X_FAR, 37.86, -29.4, 37.96, yellow); stripe(-24.6, 37.86, X_FAR, 37.96, yellow); stripe(-X_FAR, 38.06, -29.4, 38.16, yellow); stripe(-24.6, 38.06, X_FAR, 38.16, yellow);
    for (let x = -X_FAR; x < X_FAR; x += 6) { if (x > -31 && x < -23) continue; stripe(x, 35.42, x + 3, 35.52, white); stripe(x, 40.52, x + 3, 40.62, white); }
    for (let z = CURB1 + 0.3; z < FAR0 - 0.4; z += 1.1) stripe(-29, z, -25, z + 0.6, white);                  // faixa de pedestres
    stripe(-29.6, CURB1 + 0.2, -29.3, 37.8, white); stripe(-24.7, 38.2, -24.4, FAR0 - 0.2, white);
    // tampas de bueiro e grelhas de drenagem no meio-fio
    const iron: THREE.BufferGeometry[] = [];
    for (const [x, z] of [[-12, 36.4], [14, 39.6], [27, 36.8], [-40, 39.2]]) { const c = new THREE.CylinderGeometry(0.34, 0.34, 0.02, 24); c.translate(x, ROAD_Y + 0.006, z); iron.push(worldUV(c)); }
    for (const x of [-34, -18.5, -1, 13.5, 26]) iron.push(boxGeo(x - 0.45, ROAD_Y + 0.001, CURB1, x + 0.45, ROAD_Y + 0.012, CURB1 + 0.35));
    return { sidewalk: merge(sidewalk), curb: merge(curb), yellow: merge(yellow), white: merge(white), iron: merge(iron) };
  }, []);
}

/* ---------- escadaria e tapete ---------- */
function useStairs() {
  return useMemo(() => {
    const steps: THREE.BufferGeometry[] = [], nosing: THREE.BufferGeometry[] = [];
    steps.push(boxGeo(STAIRS.x0, SIDEWALK_Y - 0.02, 24.5, STAIRS.x1, 0, STAIRS.top));                  // patamar
    for (let k = 1; k <= STAIRS.steps; k++) {
      const z0 = STAIRS.top + (k - 1) * STEP_D, z1 = STAIRS.top + k * STEP_D, y = stepY(k);
      steps.push(boxGeo(STAIRS.x0, SIDEWALK_Y - 0.02, z0, STAIRS.x1, y, z1));
      nosing.push(boxGeo(STAIRS.x0, y - 0.035, z0 - 0.025, STAIRS.x1, y + 0.004, z0 + 0.03));          // focinho do degrau
    }
    // tapete: polilinha (z, y) do meio-fio até as portas, com pisos e espelhos; estendida em x de −2,4 a 2,4
    const line: [number, number][] = [[CURB1, SIDEWALK_Y]];
    let cz = STAIRS.bottom - STEP_D, cy = SIDEWALK_Y; line.push([cz, cy]);
    for (let k = STAIRS.steps - 1; k >= 0; k--) { const y = k === 0 ? 0 : stepY(k); line.push([cz, y]); cz = k === 0 ? 24.5 : cz - STEP_D; line.push([cz, y]); cy = y; }
    const W = 2.4, pos: number[] = [], uv: number[] = [], nor: number[] = [];
    let len = 0;
    for (let i = 0; i < line.length - 1; i++) {
      const [za, ya] = line[i], [zb, yb] = line[i + 1];
      const seg = Math.hypot(zb - za, yb - ya); if (seg < 1e-4) continue;
      const vertical = Math.abs(yb - ya) > Math.abs(zb - za);
      const off = vertical ? [0, 0, 0.007] : [0, 0.007, 0];                                             // tapete por cima da pedra
      const n = vertical ? [0, 0, 1] : [0, 1, 0];
      const quad = [[-W, za, ya, len], [W, za, ya, len], [W, zb, yb, len + seg], [-W, zb, yb, len + seg]];
      for (const k of [0, 1, 2, 0, 2, 3]) { const [x, z, y, l] = quad[k]; pos.push(x + off[0], y + off[1], z + off[2]); uv.push((x + W) / (2 * W), l / 2); nor.push(n[0], n[1], n[2]); }
      len += seg;
    }
    const carpet = new THREE.BufferGeometry();
    carpet.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); carpet.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); carpet.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    return { steps: merge(steps), nosing: merge(nosing), carpet };
  }, []);
}

/* ---------- rampa da doca ---------- */
function useDockRamp() {
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
function useRisers() {
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
    return { deck: merge(deck), skirt: merge(skirt), rail: merge(rail), gear: merge(gear), panels: merge(panels) };
  }, []);
}

/* ---------- cordões de veludo ---------- */
function useRopes(props: Prop[]) {
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
function useBarriers(props: Prop[]) {
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
export function lampPositions(props: Prop[]): THREE.Vector3[] { return props.filter((p) => p.kind === "lampPost" && p.shape.type === "circle").map((p) => { const s = p.shape as { x: number; z: number }; return new THREE.Vector3(s.x, floorY(s) + 4.55, s.z); }); }
function useLamps(props: Prop[]) {
  return useMemo(() => {
    const at = props.filter((p) => p.kind === "lampPost" && p.shape.type === "circle").map((p) => p.shape as { x: number; z: number });
    const posts = at.map((s) => inst(s.x, floorY(s), s.z, s.z < 38 ? 0 : Math.PI));
    // base canelada, haste afinando, colar e a lanterna de quatro vidros com o teto em cúpula
    const iron = merge([
      lathe([[0, 0], [0.26, 0], [0.26, 0.12], [0.2, 0.18], [0.21, 0.5], [0.16, 0.62], [0.12, 0.66], [0.1, 0.9], [0.075, 3.9], [0.1, 3.96], [0.1, 4.04], [0.06, 4.1], [0, 4.1]], 16),
      lathe([[0, 4.1], [0.12, 4.1], [0.2, 4.14], [0.22, 4.18], [0.16, 4.2], [0, 4.2]], 12),
      lathe([[0, 4.92], [0.26, 4.92], [0.28, 4.96], [0.2, 5.05], [0.1, 5.16], [0.04, 5.3], [0.05, 5.36], [0, 5.42]], 12),
      ...[0, 1, 2, 3].map((k) => { const a = (k * Math.PI) / 2 + Math.PI / 4; return place(new THREE.BoxGeometry(0.025, 0.74, 0.025), Math.cos(a) * 0.19, 4.56, Math.sin(a) * 0.19); }),
    ]);
    const glass = lathe([[0.12, 4.2], [0.2, 4.4], [0.2, 4.9], [0.17, 4.92]], 4, Math.PI / 4);
    return { posts, iron, glass };
  }, [props]);
}

/* ---------- árvores ---------- */
function useTrees(props: Prop[], q: Quality) {
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

/* ---------- carros parados não ficam aqui (exterior-vehicles.tsx) ---------- */

/** Pódio da recepção: laca preta com filete de latão, luminária de mesa e a placa da recepção. */
function Podium({ m }: { m: ExteriorMaterials }) {
  const geo = useMemo(() => {
    const body = merge([boxGeo(-0.3, 0, -0.22, 0.3, 1.05, 0.22), boxGeo(-0.36, 1.05, -0.3, 0.36, 1.12, 0.26)]);
    const trim = merge([boxGeo(-0.31, 0.06, -0.23, 0.31, 0.09, 0.23), boxGeo(-0.37, 1.1, -0.31, 0.37, 1.125, 0.27)]);
    const lamp = merge([tubeThrough([[0.2, 1.12, -0.18], [0.2, 1.42, -0.18], [0.05, 1.5, -0.18]], 0.01, 8, 5)]);
    return { body, trim, lamp };
  }, []);
  const sign = useMemo(() => new THREE.MeshStandardMaterial({ map: signTex("reception", [SIGNAGE.reception, SIGNAGE.gala], { w: 512, h: 256, bg: "#0c0b0a", ink: "#d9b779", font: "serif", border: "#b8913f" }), roughness: 0.5 }), []);
  const lacquer = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#060606", roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }), []);
  return (
    <group position={[-2.3, SIDEWALK_Y, 32.1]} rotation={[0, Math.PI, 0]}>
      <mesh geometry={geo.body} material={lacquer} castShadow receiveShadow />
      <mesh geometry={geo.trim} material={m.brass} />
      <mesh geometry={geo.lamp} material={m.brass} />
      <mesh position={[0.05, 1.47, -0.18]} material={m.lampGlow}><sphereGeometry args={[0.04, 10, 8]} /></mesh>
      <mesh position={[0, 0.66, -0.225]} rotation={[0, Math.PI, 0]} material={sign}><planeGeometry args={[0.52, 0.26]} /></mesh>
    </group>
  );
}

/** Urnas de pedra com a massa de flores (peônias e rosas brancas e blush, folhagem escura). Ficam dentro dos cercados. */
function Florals({ m, q }: { m: ExteriorMaterials; q: Quality }) {
  const data = useMemo(() => {
    const urn = lathe([[0, 0], [0.32, 0], [0.34, 0.06], [0.22, 0.14], [0.24, 0.5], [0.42, 0.78], [0.46, 0.86], [0.4, 0.9], [0, 0.9]], 24);
    const r = prng(5), blooms: THREE.Matrix4[] = [], colors: THREE.Color[] = [], leaves: THREE.Matrix4[] = [];
    const palette = ["#f7efe9", "#f3d9d4", "#ead0c8", "#fbf6ef", "#e9b9b6", "#d8a7a0"].map((c) => new THREE.Color(c));
    for (const [x, z] of [[-3.25, 30.45], [3.25, 30.45]]) {
      const y = floorY({ x, z }) + 0.86;
      for (let k = 0; k < (q === "high" ? 160 : 80); k++) {
        const u = r() * Math.PI * 2, v = Math.acos(2 * r() * 0.9 - 0.9), rr = 0.55 + r() * 0.35;
        const p = new THREE.Vector3(x + Math.sin(v) * Math.cos(u) * rr, y + 0.35 + Math.cos(v) * rr * 0.85, z + Math.sin(v) * Math.sin(u) * rr);
        blooms.push(new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6)), new THREE.Vector3(1, 0.75, 1).multiplyScalar(0.07 + r() * 0.06)));
        colors.push(palette[Math.floor(r() * palette.length)]);
      }
      for (let k = 0; k < 40; k++) { const u = r() * Math.PI * 2; leaves.push(new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(u) * (0.55 + r() * 0.4), y + 0.1 + r() * 0.7, z + Math.sin(u) * (0.55 + r() * 0.4)), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6)), new THREE.Vector3(0.5, 0.5, 0.5))); }
    }
    const urns = [[-3.25, 30.45], [3.25, 30.45]].map(([x, z]) => inst(x, floorY({ x, z }), z));
    return { urn, urns, blooms, colors, leaves };
  }, [q]);
  const bloomGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const bloomMesh = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0 });
    const mesh = new THREE.InstancedMesh(bloomGeo, mat, data.blooms.length);
    data.blooms.forEach((x, i) => { mesh.setMatrixAt(i, x); mesh.setColorAt(i, data.colors[i]); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.castShadow = true; return mesh;
  }, [data, bloomGeo]);
  const leafMat = useMemo(() => new THREE.MeshStandardMaterial({ map: leafTex(q, "dark"), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 }), [q]);
  const leafGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  return (
    <group>
      <Instanced geometry={data.urn} material={m.stone} matrices={data.urns} shadow />
      <primitive object={bloomMesh} />
      <Instanced geometry={leafGeo} material={leafMat} matrices={data.leaves} />
    </group>
  );
}

/** Barraca do revendedor: lona listrada sobre quatro postes, araras de roupa de grife, balcão, cordão de lâmpadas e a
 * placa pintada à mão. A frente (balcão) dá para a calçada (−z). */
function VendorStand({ m, q }: { m: ExteriorMaterials; q: Quality }) {
  const X0 = -30, X1 = -26.4, Z0 = 47.6, Z1 = 50.4, y = SIDEWALK_Y;
  const data = useMemo(() => {
    const poles: THREE.BufferGeometry[] = [], frame: THREE.BufferGeometry[] = [], counter: THREE.BufferGeometry[] = [], racks: THREE.BufferGeometry[] = [];
    for (const [x, z] of [[X0 + 0.1, Z0 + 0.05], [X1 - 0.1, Z0 + 0.05], [X0 + 0.1, Z1 - 0.1], [X1 - 0.1, Z1 - 0.1]]) poles.push(place(new THREE.CylinderGeometry(0.03, 0.03, 2.55, 8), x, y + 1.275, z));
    frame.push(tubeThrough([[X0 + 0.1, y + 2.55, Z0 + 0.05], [X1 - 0.1, y + 2.55, Z0 + 0.05]], 0.02, 2, 6), tubeThrough([[X0 + 0.1, y + 2.55, Z1 - 0.1], [X1 - 0.1, y + 2.55, Z1 - 0.1]], 0.02, 2, 6));
    counter.push(boxGeo(X0 + 0.3, y, Z0 + 0.1, X1 - 0.3, y + 0.95, Z0 + 0.65), boxGeo(X0 + 0.25, y + 0.95, Z0 + 0.05, X1 - 0.25, y + 1.0, Z0 + 0.7));
    // duas araras atrás do balcão (ao longo de x) e uma lateral
    for (const z of [49.3, 50.0]) racks.push(tubeThrough([[X0 + 0.5, y, z], [X0 + 0.5, y + 1.75, z], [X1 - 0.5, y + 1.75, z], [X1 - 0.5, y, z]], 0.018, 16, 6));
    return { poles: merge(poles), frame: merge(frame), counter: merge(counter), racks: merge(racks) };
  }, []);
  // lona listrada: telhado de duas águas (a frente mais baixa) com a sanefa recortada
  const canopy = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d")!;
    for (let k = 0; k < 16; k++) { g.fillStyle = k % 2 ? "#e8e1d2" : "#5b1420"; g.fillRect(k * 16, 0, 16, 64); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.DoubleSide });
    const roof = new THREE.PlaneGeometry(X1 - X0 + 0.3, Z1 - Z0 + 0.5, 1, 1); roof.rotateX(-Math.PI / 2 + 0.16); roof.translate((X0 + X1) / 2, y + 2.7, (Z0 + Z1) / 2);
    const valance = new THREE.PlaneGeometry(X1 - X0 + 0.3, 0.32); valance.translate((X0 + X1) / 2, y + 2.38, Z0 - 0.18);
    return { mat, roof, valance };
  }, []);
  // roupas penduradas: capas e vestidos (caixas finas de alturas variadas, cores de grife)
  const clothes = useMemo(() => {
    const r = prng(91), list: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const cols = ["#121212", "#6b0f1a", "#c9b38a", "#1d2a4a", "#e9e2d6", "#2f4b3a", "#8a6a3a", "#3b2a4f", "#b3122e"].map((x) => new THREE.Color(x));
    for (const z of [49.3, 50.0]) for (let x = X0 + 0.7; x < X1 - 0.6; x += 0.17) {
      const h = 0.8 + r() * 0.7;
      list.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, y + 1.72 - h / 2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 + (r() - 0.5) * 0.3), new THREE.Vector3(0.05, h, 0.42 + r() * 0.12)), c: cols[Math.floor(r() * cols.length)] });
    }
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshPhysicalMaterial({ roughness: 0.6, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color("#ffffff") }), list.length);
    list.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, it.c); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.castShadow = true;
    return mesh;
  }, []);
  // cordão de lâmpadas na beira da lona
  const bulbs = useMemo(() => { const out: THREE.Matrix4[] = []; for (let k = 0; k <= 12; k++) { const t = k / 12, x = X0 + t * (X1 - X0); out.push(inst(x, y + 2.42 - Math.sin(t * Math.PI) * 0.12, Z0 - 0.22)); } return out; }, []);
  const bulbGeo = useMemo(() => new THREE.SphereGeometry(0.045, 8, 6), []);
  const sign = useMemo(() => new THREE.MeshStandardMaterial({ map: signTex("vendor", [SIGNAGE.vendor, `${SIGNAGE.vendorSub} · ${SIGNAGE.vendorTag}`], { w: 768, h: 256, bg: "#f1e7cf", ink: "#3a0e12", font: "hand", border: "#3a0e12" }), roughness: 0.8 }), []);
  return (
    <group>
      <mesh geometry={data.poles} material={m.galvanized} castShadow />
      <mesh geometry={data.frame} material={m.galvanized} />
      <mesh geometry={data.counter} material={m.plywood} castShadow receiveShadow />
      <mesh geometry={data.racks} material={m.chrome} />
      <primitive object={clothes} />
      <mesh geometry={canopy.roof} material={canopy.mat} castShadow receiveShadow />
      <mesh geometry={canopy.valance} material={canopy.mat} />
      <Instanced geometry={bulbGeo} material={m.lampGlow} matrices={bulbs} />
      <mesh position={[(X0 + X1) / 2, y + 2.05, Z0 + 0.02]} rotation={[0, Math.PI, 0]} material={sign}><planeGeometry args={[2.6, 0.62]} /></mesh>
      {/* espelho de chão e o caixa sobre o balcão */}
      <mesh position={[X1 - 0.35, y + 0.95, 49.0]} rotation={[0, -Math.PI / 2, 0]} material={m.chrome}><planeGeometry args={[0.6, 1.7]} /></mesh>
      <mesh position={[X0 + 0.9, y + 1.08, Z0 + 0.4]} material={m.blackMetal}><boxGeometry args={[0.36, 0.14, 0.28]} /></mesh>
      {q === "high" && <mesh position={[X0 + 1.8, y + 1.02, Z0 + 0.4]} material={m.lampGlow}><boxGeometry args={[0.18, 0.04, 0.12]} /></mesh>}
    </group>
  );
}

/** Placas que separam o público do restrito: convite no portão, imprensa nas arquibancadas, entrada de serviço, fila. */
function Signage({ m }: { m: ExteriorMaterials }) {
  const mats = useMemo(() => {
    const mk = (tex: THREE.Texture, glow = 0) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissive: glow ? new THREE.Color("#ffffff") : new THREE.Color("#000000"), emissiveMap: glow ? tex : null, emissiveIntensity: glow });
    return {
      invite: mk(signTex("invite", [SIGNAGE.invite, SIGNAGE.gala], { w: 640, h: 256, bg: "#0d0b09", ink: "#e2c27e", font: "serif", border: "#b8913f" }), 0.25),
      press: mk(signTex("press", [SIGNAGE.press], { w: 1024, h: 128, bg: "#101010", ink: "#f2f2f2", font: "sans" })),
      restricted: mk(signTex("restricted", [SIGNAGE.restricted], { w: 1024, h: 128, bg: "#8d1220", ink: "#ffffff", font: "sans" })),
      service: mk(signTex("service", [`${SIGNAGE.serviceArrow}  ${SIGNAGE.service}`, SIGNAGE.staffOnly], { w: 640, h: 256, bg: "#f2c230", ink: "#111111", font: "sans" }), 0.08),
      queue: mk(signTex("queue", [SIGNAGE.queue, SIGNAGE.invite], { w: 640, h: 256, bg: "#0d0b09", ink: "#e2c27e", font: "serif", border: "#b8913f" }), 0.25),
      closed: mk(signTex("closed", [SIGNAGE.closed], { w: 512, h: 128, bg: "#ffffff", ink: "#c1121f", font: "sans", border: "#c1121f" })),
    };
  }, []);
  const Stand = ({ x, z, rot, mat, w = 0.6, h = 0.24 }: { x: number; z: number; rot: number; mat: THREE.Material; w?: number; h?: number }) => {
    const y = floorY({ x, z });
    return (
      <group position={[x, y, z]} rotation={[0, rot, 0]}>
        <mesh material={m.brass} position={[0, 0.5, 0]}><cylinderGeometry args={[0.018, 0.018, 1.0, 8]} /></mesh>
        <mesh material={m.brass} position={[0, 0.01, 0]}><cylinderGeometry args={[0.16, 0.18, 0.02, 18]} /></mesh>
        <mesh material={m.brass} position={[0, 1.0 + h / 2, -0.012]}><boxGeometry args={[w + 0.04, h + 0.04, 0.012]} /></mesh>
        <mesh material={mat} position={[0, 1.0 + h / 2, 0]}><planeGeometry args={[w, h]} /></mesh>
      </group>
    );
  };
  return (
    <group>
      {/* convite: no pé do tapete, dos dois lados do portão (dentro dos cercados) */}
      <Stand x={-1.95} z={31.25} rot={0} mat={mats.invite} />
      <Stand x={1.95} z={31.25} rot={0} mat={mats.invite} />
      {/* fim da fila: no último pedestal do cordão, voltada para a calçada */}
      <Stand x={15.0} z={32.7} rot={0} mat={mats.queue} />
      {/* imprensa e restrito: nas saias das arquibancadas viradas para a rua e para a calçada */}
      {[-9, 9].map((x) => <mesh key={x} material={mats.press} position={[x, SIDEWALK_Y + 0.62, 31.02]}><planeGeometry args={[4.6, 0.58]} /></mesh>)}
      <mesh material={mats.restricted} position={[-12.02, SIDEWALK_Y + 0.42, 27.8]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[3.6, 0.45]} /></mesh>
      <mesh material={mats.restricted} position={[12.02, SIDEWALK_Y + 0.42, 27.8]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[3.6, 0.45]} /></mesh>
      {/* entrada de serviço: placa em poste na calçada, ao lado da rampa, apontando para a doca */}
      <group position={[-15.6, SIDEWALK_Y, 25.2]}>
        <mesh material={m.galvanized} position={[0, 1.1, 0]}><cylinderGeometry args={[0.03, 0.03, 2.2, 8]} /></mesh>
        <mesh material={mats.service} position={[0, 2.0, 0.02]}><planeGeometry args={[0.8, 0.32]} /></mesh>
      </group>
      {/* "VIA INTERDITADA" nos cavaletes das pontas */}
      {[-30.75, 30.75].map((x) => [37.9, 30, 46].map((z) => <mesh key={`${x}:${z}`} material={mats.closed} position={[x + (x < 0 ? -0.04 : 0.04), floorY({ x: Math.sign(x) * 29.9, z }) + 0.85, z]} rotation={[0, x < 0 ? -Math.PI / 2 : Math.PI / 2, 0]}><planeGeometry args={[1.8, 0.45]} /></mesh>))}
    </group>
  );
}

/** Cartazes dos fãs presos nas grades (os fãs, de verdade, são do HeistPeople). */
function FanSigns() {
  const list = useMemo(() => { const r = prng(4); const out: { x: number; k: number; tilt: number }[] = []; for (let x = -23; x < 29; x += 3.4 + r() * 3) out.push({ x, k: out.length, tilt: (r() - 0.5) * 0.25 }); return out; }, []);
  return <group>{list.map((s) => <mesh key={s.x} position={[s.x, SIDEWALK_Y + 0.72, 43.1]} rotation={[0, Math.PI, s.tilt]}><planeGeometry args={[0.56, 0.35]} /><meshStandardMaterial map={fanSignTex(s.k)} roughness={0.85} side={THREE.DoubleSide} /></mesh>)}</group>;
}

/** Hidrante de ferro fundido (vermelho escuro, tampas de latão). */
function Hydrant({ m, x, z }: { m: ExteriorMaterials; x: number; z: number }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#6d1414", roughness: 0.55, metalness: 0.35 }), []);
  const geo = useMemo(() => merge([lathe([[0, 0], [0.2, 0], [0.2, 0.06], [0.14, 0.09], [0.13, 0.55], [0.15, 0.58], [0.15, 0.64], [0.1, 0.72], [0.04, 0.78], [0, 0.8]], 16), place(new THREE.CylinderGeometry(0.06, 0.06, 0.38, 10).rotateZ(Math.PI / 2), 0, 0.45, 0)]), []);
  return (
    <group position={[x, SIDEWALK_Y, z]}>
      <mesh geometry={geo} material={mat} castShadow />
      {[-1, 1].map((s) => <mesh key={s} position={[s * 0.2, 0.45, 0]} rotation={[0, 0, Math.PI / 2]} material={m.brass}><cylinderGeometry args={[0.055, 0.055, 0.04, 10]} /></mesh>)}
    </group>
  );
}

export function HeistStreet({ q, m }: { q: Quality; m: ExteriorMaterials }) {
  const props = useMemo(streetProps, []);
  const paint = useMemo(() => ({
    yellow: new THREE.MeshStandardMaterial({ color: "#c9961c", roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    white: new THREE.MeshStandardMaterial({ color: "#d9d6cc", roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    hazard: new THREE.MeshStandardMaterial({ color: "#e8b81c", roughness: 0.6 }),
  }), []);
  const ground = useGround(), stairs = useStairs(), ramp = useDockRamp(), risers = useRisers(), ropes = useRopes(props), barriers = useBarriers(props), lamps = useLamps(props), trees = useTrees(props, q);
  const ironMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1c1c1c", roughness: 0.4, metalness: 0.8 }), []);
  const ledPanel = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: new THREE.Color("#f4f6ff"), emissiveIntensity: 3.2 }), []);
  const blueBarrier = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2f5f9b", roughness: 0.45, metalness: 0.6, normalMap: m.galvanized.normalMap, normalScale: new THREE.Vector2(0.2, 0.2) }), [m]);
  const sawMat = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 128; c.height = 32; const g = c.getContext("2d")!;
    for (let k = -2; k < 12; k++) { g.fillStyle = k % 2 ? "#f2f2f2" : "#e05a12"; g.beginPath(); g.moveTo(k * 16, 0); g.lineTo(k * 16 + 16, 0); g.lineTo(k * 16 + 32, 32); g.lineTo(k * 16 + 16, 32); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(1 / 2.4, 1 / 0.3);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
  }, []);
  const leafMat = useMemo(() => new THREE.MeshStandardMaterial({ map: leafTex(q, "green"), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, color: new THREE.Color("#c9d8b8") }), [q]);
  const leafGeo = useMemo(() => new THREE.PlaneGeometry(0.9, 0.9), []);
  return (
    <group>
      {/* chão */}
      <mesh geometry={ground.sidewalk} material={m.sidewalk} receiveShadow />
      <mesh geometry={ground.curb} material={m.granite} receiveShadow />
      <mesh geometry={ground.yellow} material={paint.yellow} receiveShadow />
      <mesh geometry={ground.white} material={paint.white} receiveShadow />
      <mesh geometry={ground.iron} material={ironMat} receiveShadow />
      {/* escadaria, tapete e rampa */}
      <mesh geometry={stairs.steps} material={m.stone} receiveShadow castShadow />
      <mesh geometry={stairs.nosing} material={m.stone} receiveShadow />
      <mesh geometry={stairs.carpet} material={m.carpet} receiveShadow />
      <mesh geometry={ramp.concrete} material={m.concrete} receiveShadow castShadow />
      <mesh geometry={ramp.rail} material={m.galvanized} castShadow />
      <mesh geometry={ramp.stripes} material={paint.hazard} />
      {/* arquibancadas */}
      <mesh geometry={risers.deck} material={m.plywood} receiveShadow castShadow />
      <mesh geometry={risers.skirt} material={m.blackFabric} receiveShadow />
      <mesh geometry={risers.rail} material={m.blackMetal} castShadow />
      <mesh geometry={risers.gear} material={m.blackMetal} castShadow />
      <mesh geometry={risers.panels} material={ledPanel} />
      {/* cordões de veludo */}
      <Instanced geometry={ropes.post} material={m.brass} matrices={ropes.posts} shadow />
      <mesh geometry={ropes.ropes} material={m.velvet} castShadow />
      {/* grades dos fãs e os cavaletes das pontas */}
      <Instanced geometry={barriers.section} material={blueBarrier} matrices={barriers.sections} shadow />
      <Instanced geometry={barriers.sawGeo} material={sawMat} matrices={barriers.saw} />
      <Instanced geometry={barriers.sawLegs} material={m.whitePaint} matrices={barriers.saw} />
      {/* postes */}
      <Instanced geometry={lamps.iron} material={m.castIron} matrices={lamps.posts} shadow />
      <Instanced geometry={lamps.glass} material={m.glassFrosted} matrices={lamps.posts} />
      {/* árvores */}
      <mesh geometry={trees.trunks} material={m.bark} castShadow />
      <mesh geometry={trees.grates} material={m.castIron} receiveShadow />
      <Instanced geometry={leafGeo} material={leafMat} matrices={trees.cards} shadow />
      <Podium m={m} />
      <Florals m={m} q={q} />
      <VendorStand m={m} q={q} />
      <Signage m={m} />
      <FanSigns />
      <Hydrant m={m} x={-10.5} z={43.9} />
    </group>
  );
}

/** Posições de quem fotografa (para os flashes) e onde estão as luzes do chão. */
export const PAPARAZZI = CIVILIANS.filter((c) => c.role === "paparazzo").map((c) => ({ x: c.pos.x, y: (c.y ?? floorY(c.pos)) + 1.62, z: c.pos.z, yaw: c.yaw }));
