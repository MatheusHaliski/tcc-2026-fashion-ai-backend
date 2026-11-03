/*
 * MET Gala Heist v2 — fachada do museu: geometria de pedra da fachada (pavilhão central, colunas, entablamento, ático, alas, faces
 * leste e norte, pátio e telhados), memorizada por hook e fundida por material.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { archedWall, atticBase, boxGeo, corinthianCapital, flutedShaft, inst, merge, moldingSouth, worldUV } from "./exterior-geometry";
import type { Quality } from "./exterior-textures";
import { ARCHES, CAP_H, COL_R, colZ, DOCK_H, DOCK_X0, DOCK_X1, EAST_X, FACADE_Z, HALF, isFree, NORTH_Z, P_ARCHITRAVE, P_BIGCORNICE, P_CORNICE, P_SILL, P_WATER, PAIR_GAP, PAIRS, WALL_BACK, WEST_END, WING_CORNICE, WING_TOP, Y_ATTIC_TOP, Y_CAP, Y_CORN, Y_ENT, Y_ENT_TOP, Y_FRIEZE, Y_PED, Y_SHAFT, Y_TOP } from "./exterior-facade-dims";

export function useFacadeGeometry(q: Quality) {
  return useMemo(() => {
    const ashlar: THREE.BufferGeometry[] = [], rustic: THREE.BufferGeometry[] = [], stone: THREE.BufferGeometry[] = [], rough: THREE.BufferGeometry[] = [];
    /* --- pavilhão central --- */
    const wall = archedWall(-HALF, HALF, 0, Y_ENT_TOP, ARCHES, FACADE_Z - WALL_BACK);
    wall.translate(0, 0, WALL_BACK); ashlar.push(worldUV(wall));
    // embasamento rusticado (fora da escadaria) com a pingadeira
    for (const [x0, x1] of [[WEST_END, -6], [6, EAST_X]] as const) { rustic.push(boxGeo(x0, -1.62, WALL_BACK, x1, 0, FACADE_Z + 0.12)); stone.push(moldingSouth(P_WATER, x0, x1, FACADE_Z + 0.12, 0)); }
    // arcos: arquivolta, aduela-chave e impostas
    for (const a of ARCHES) {
      const r = a.w / 2, t = new THREE.TorusGeometry(r + 0.2, 0.16, 8, 40, Math.PI); t.translate(a.cx, a.spring, FACADE_Z + 0.02); stone.push(worldUV(t));
      stone.push(boxGeo(a.cx - 0.3, a.spring + r - 0.1, FACADE_Z, a.cx + 0.3, a.spring + r + 0.85, FACADE_Z + 0.3));
      for (const s of [-1, 1]) stone.push(boxGeo(a.cx + s * r - (s > 0 ? 0 : 0.42), a.spring - 0.28, FACADE_Z, a.cx + s * r + (s > 0 ? 0.42 : 0), a.spring, FACADE_Z + 0.16));
    }
    // pares de colunas: pedestal comum, base ática, fuste canelado e capitel (fuste/base/capitel vão instanciados)
    const colMatrices: THREE.Matrix4[] = [];
    for (const px of PAIRS) {
      const z = colZ(px), free = isFree(px), d = free ? 0.66 : 0.45, zc = free ? z : FACADE_Z + d / 2;
      const w = PAIR_GAP + 0.66;
      ashlar.push(boxGeo(px - w, free ? -0.35 : 0, zc - d, px + w, Y_PED - 0.24, zc + d));
      stone.push(boxGeo(px - w - 0.08, Y_PED - 0.24, zc - d - 0.08, px + w + 0.08, Y_PED, zc + d + 0.08));
      stone.push(boxGeo(px - w - 0.06, free ? -0.35 : 0, zc - d - 0.06, px + w + 0.06, (free ? -0.35 : 0) + 0.3, zc + d + 0.06));
      for (const s of [-1, 1]) colMatrices.push(inst(px + s * PAIR_GAP, Y_PED, z));
      // entablamento avança sobre o par
      const front = free ? z + 0.62 : FACADE_Z + 0.58;
      ashlar.push(boxGeo(px - w, Y_ENT, FACADE_Z, px + w, Y_CORN, front));
      stone.push(moldingSouth(P_CORNICE, px - w - 0.1, px + w + 0.1, front, Y_CORN));
      // os blocos brutos (esculturas nunca entalhadas) empilhados sobre o par
      rough.push(boxGeo(px - 1.25, Y_ENT_TOP - 0.15, FACADE_Z + 0.05, px + 1.25, Y_ENT_TOP + 1.25, front - 0.1));
      rough.push(boxGeo(px - 0.95, Y_ENT_TOP + 1.25, FACADE_Z + 0.15, px + 0.75, Y_ENT_TOP + 2.25, front - 0.35));
      rough.push(boxGeo(px - 0.2, Y_ENT_TOP + 2.25, FACADE_Z + 0.25, px + 0.65, Y_ENT_TOP + 2.75, front - 0.55));
    }
    // almofadas (painel em relevo com moldura) nas faces dos pedestais encostados e no tímpano sobre os arcos laterais
    const cushion = (x0: number, x1: number, y0: number, y1: number, z: number) => {
      stone.push(boxGeo(x0 + 0.1, y0 + 0.1, z, x1 - 0.1, y1 - 0.1, z + 0.035));
      for (const [a, b, c2, d] of [[x0, y0, x1, y0 + 0.06], [x0, y1 - 0.06, x1, y1], [x0, y0, x0 + 0.06, y1], [x1 - 0.06, y0, x1, y1]]) stone.push(boxGeo(a, b, z, c2, d, z + 0.06));
    };
    for (const px of PAIRS) if (!isFree(px)) { const w = PAIR_GAP + 0.66; cushion(px - w + 0.2, px + w - 0.2, 0.25, Y_PED - 0.45, FACADE_Z + 0.675); }
    // entablamento corrido: arquitrave, friso, dentículos e cornija
    stone.push(moldingSouth(P_ARCHITRAVE, -HALF, HALF, FACADE_Z, Y_ENT));
    for (let x = -HALF + 0.1; x < HALF - 0.05; x += 0.17) stone.push(boxGeo(x, Y_CORN - 0.11, FACADE_Z + 0.2, x + 0.08, Y_CORN - 0.01, FACADE_Z + 0.29));
    ashlar.push(boxGeo(-HALF, Y_FRIEZE, FACADE_Z, HALF, Y_CORN, FACADE_Z + 0.2));
    stone.push(moldingSouth(P_CORNICE, -HALF - 0.2, HALF + 0.2, FACADE_Z + 0.2, Y_CORN));
    // ático (recuado), painéis rebaixados, friso de cabeças e guirlandas e a cornija de coroamento
    ashlar.push(boxGeo(-HALF, Y_ENT_TOP, 14.5, HALF, Y_ATTIC_TOP, FACADE_Z - 0.05));
    for (let k = 0; k < 7; k++) {
      const x0 = -HALF + 0.6 + k * ((2 * HALF - 1.2) / 7); const x1 = x0 + (2 * HALF - 1.2) / 7 - 0.5;
      stone.push(boxGeo(x0 + 0.25, Y_ENT_TOP + 0.35, FACADE_Z - 0.05, x1 + 0.25, Y_ENT_TOP + 1.55, FACADE_Z + 0.02));
      for (const [a, b, c2, d] of [[x0 + 0.1, Y_ENT_TOP + 0.22, x1 + 0.4, Y_ENT_TOP + 0.3], [x0 + 0.1, Y_ENT_TOP + 1.6, x1 + 0.4, Y_ENT_TOP + 1.68], [x0 + 0.1, Y_ENT_TOP + 0.22, x0 + 0.18, Y_ENT_TOP + 1.68], [x1 + 0.32, Y_ENT_TOP + 0.22, x1 + 0.4, Y_ENT_TOP + 1.68]]) stone.push(boxGeo(a, b, FACADE_Z - 0.05, c2, d, FACADE_Z + 0.06));
    }
    const heads: THREE.BufferGeometry[] = [];
    for (let k = 0; k <= 16; k++) {
      const x = -HALF + 0.9 + k * ((2 * HALF - 1.8) / 16), y = Y_ATTIC_TOP - 0.55;
      const hd = new THREE.SphereGeometry(0.17, 10, 8); hd.scale(1, 1.25, 0.8); hd.translate(x, y, FACADE_Z + 0.05); heads.push(worldUV(hd));
      if (k < 16) { const sw = new THREE.TorusGeometry(((2 * HALF - 1.8) / 16) / 2 - 0.15, 0.07, 6, 16, Math.PI); sw.rotateZ(Math.PI); sw.translate(x + ((2 * HALF - 1.8) / 16) / 2, y + 0.12, FACADE_Z + 0.02); heads.push(worldUV(sw)); }
    }
    stone.push(...heads);
    stone.push(moldingSouth(P_BIGCORNICE, -HALF - 0.4, HALF + 0.4, FACADE_Z - 0.05, Y_ATTIC_TOP));
    stone.push(boxGeo(-HALF - 0.4, Y_ATTIC_TOP + 0.75, 14.2, HALF + 0.4, Y_TOP, FACADE_Z - 0.05));
    /* --- alas (oeste até sumir na névoa; leste até a esquina do beco) --- */
    const wingRuns: [number, number][] = [[WEST_END, -HALF], [HALF, EAST_X]];
    for (const [x0, x1] of wingRuns) {
      if (x0 === WEST_END) {
        // ala oeste: o vão do portão de enrolar da doca (x −21,1…−16,9; até 4,45 m) com verga de pedra por cima
        ashlar.push(boxGeo(x0, 0, WALL_BACK, DOCK_X0, WING_TOP, FACADE_Z), boxGeo(DOCK_X1, 0, WALL_BACK, x1, WING_TOP, FACADE_Z), boxGeo(DOCK_X0, DOCK_H, WALL_BACK, DOCK_X1, WING_TOP, FACADE_Z));
        stone.push(boxGeo(DOCK_X0 - 0.25, DOCK_H, FACADE_Z, DOCK_X1 + 0.25, DOCK_H + 0.42, FACADE_Z + 0.16));
      } else ashlar.push(boxGeo(x0, 0, WALL_BACK, x1, WING_TOP, FACADE_Z));
      stone.push(moldingSouth(P_CORNICE, x0, x1 + (x1 === EAST_X ? 0.62 : 0), FACADE_Z, WING_TOP));
    }
    // face leste (beco) com o vão da porta da escada de incêndio (z −15…−13, y 0…2,2)
    for (const [z0, z1, y0, y1] of [[NORTH_Z, -15, -1.62, WING_TOP], [-13, FACADE_Z, -1.62, WING_TOP], [-15, -13, 2.25, WING_TOP]] as const) {
      ashlar.push(boxGeo(22.05, Math.max(y0, 0), z0, EAST_X, y1, z1)); rustic.push(boxGeo(22.05, y0, z0, EAST_X + 0.1, 0, z1));
    }
    rustic.push(boxGeo(22.05, -1.62, -15, EAST_X + 0.1, 0, -13));
    const eastCornice = moldingSouth(P_CORNICE, -FACADE_Z, -NORTH_Z, 0, WING_TOP); eastCornice.rotateY(Math.PI / 2); eastCornice.translate(EAST_X, 0, 0); stone.push(eastCornice);
    // cunhais da esquina sudeste (blocos alternados)
    for (let k = 0; k < 8; k++) { const y0 = k * 1.35, big = k % 2 === 0; stone.push(boxGeo(EAST_X - (big ? 1.1 : 0.7), y0, FACADE_Z - 0.05, EAST_X + 0.06, y0 + 1.25, FACADE_Z + 0.06)); stone.push(boxGeo(EAST_X - 0.05, y0, FACADE_Z - (big ? 0.7 : 1.1), EAST_X + 0.06, y0 + 1.25, FACADE_Z + 0.06)); }
    // face norte sobre o beiral: desce até o parque (y −10), com os vãos de windowC (x −20…−19) e windowT (19…20)
    const NZ0 = NORTH_Z, NZ1 = -22.05, sill = 0.25, head = 2.05;
    for (const [x0, x1, y0, y1] of [[-22.5, -20, -10, WING_TOP], [-19, 19, -10, WING_TOP], [20, 22.5, -10, WING_TOP], [-20, -19, -10, sill], [-20, -19, head, WING_TOP], [19, 20, -10, sill], [19, 20, head, WING_TOP]] as const) ashlar.push(boxGeo(x0, y0, NZ0, x1, y1, NZ1));
    const northCornice = moldingSouth(P_CORNICE, -EAST_X - 0.62, EAST_X + 0.62, 0, WING_TOP); northCornice.rotateY(Math.PI); northCornice.translate(0, 0, NORTH_Z); stone.push(northCornice);
    // beiral: laje de pedra com pingadeira e consolos, e os encostos nas pontas
    stone.push(boxGeo(-21.4, -0.42, -23.5, 21.4, 0.005, NORTH_Z));
    const ledgeLip = moldingSouth(P_SILL, -21.4, 21.4, 0, -0.42); ledgeLip.rotateY(Math.PI); ledgeLip.translate(0, 0, -23.5); stone.push(ledgeLip);
    for (let x = -20.4; x <= 20.4; x += 1.2) stone.push(boxGeo(x - 0.14, -1.1, -23.25, x + 0.14, -0.42, NORTH_Z));
    for (const s of [-1, 1]) stone.push(boxGeo(s > 0 ? 21 : -21.6, 0, -23.55, s > 0 ? 21.6 : -21, 1.3, NORTH_Z));
    for (const x of [-19.5, 19.5]) { stone.push(boxGeo(x - 0.65, sill - 0.12, NORTH_Z - 0.18, x + 0.65, sill, NORTH_Z)); stone.push(boxGeo(x - 0.65, head, NORTH_Z - 0.12, x + 0.65, head + 0.3, NORTH_Z)); for (const s of [-1, 1]) stone.push(boxGeo(x + s * 0.5 - 0.08, sill, NORTH_Z - 0.1, x + s * 0.5 + 0.08 * s, head, NORTH_Z)); }
    // pátio-jardim (terraço): paredes de cima vistas de dentro, de 5 m até o telhado, 2 cm atrás do plano do interior
    const CY0 = 5, CY1 = WING_TOP + 0.6;
    ashlar.push(boxGeo(12.2, CY0, -22, 12.48, CY1, -6.5), boxGeo(22.02, CY0, -22, 22.3, CY1, -6.5), boxGeo(12.5, CY0, -22.3, 22, CY1, -22.02), boxGeo(12.5, CY0, -6.48, 22, CY1, -6.2));
    /* --- telhados (fecham a silhueta; o pátio fica aberto) --- */
    const roof: THREE.BufferGeometry[] = [boxGeo(WEST_END, WING_CORNICE - 0.05, NORTH_Z, 12.2, WING_CORNICE, WALL_BACK), boxGeo(12.2, WING_CORNICE - 0.05, -6.2, EAST_X, WING_CORNICE, WALL_BACK)];
    return {
      ashlar: merge(ashlar), rustic: merge(rustic), stone: merge(stone), rough: merge(rough), roof: merge(roof), colMatrices,
      shaft: flutedShaft(COL_R, Y_CAP - Y_SHAFT, q === "high" ? 24 : 16, q === "high" ? 14 : 8), base: atticBase(COL_R), capital: corinthianCapital(COL_R * 0.88, CAP_H),
    };
  }, [q]);
}
