"use client";
/*
 * MET Gala Heist v2 — a pele de fora do Museu Vesper: fachada Beaux-Arts da avenida (pavilhão central com três arcos entre
 * quatro pares de colunas coríntias sobre pedestais altos, entablamento que avança sobre cada par, os blocos de pedra
 * brutos em cima dos pares — esculturas que nunca foram feitas —, ático com friso de guirlandas e cornija), as alas com
 * janelas de frontão, os banners da exposição, as portas de bronze e vidro (`front`) e o portão de enrolar da doca
 * (`dockGate`), a face leste do beco (com a porta da escada de incêndio), a face norte sobre o beiral (com as janelas
 * windowT/windowC), o pátio-jardim a céu aberto visto de dentro acima de 5 m e os telhados.
 *
 * Divisa com o interior: tudo aqui fica do lado de fora do plano das paredes (z ≥ 24,05 na fachada sul, x ≤ 22,5 no
 * leste…); os vãos de porta e janela são abertos (as folhas internas são do interior), exceto as da fachada.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SceneView } from "@/lib/heist/view";
import { archedWall, atticBase, boxGeo, corinthianCapital, flutedShaft, inst, lathe, merge, moldingSouth, worldUV } from "./exterior-geometry";
import { exteriorMaterials } from "./exterior-materials";
import { bannerTex, inscriptionTex, plaqueTex, signTex, SIGNAGE, type Quality } from "./exterior-textures";

/* ---------- medidas da fachada (m) ---------- */
export const FACADE_Z = 24.5;
const WALL_BACK = 24.05;                      // a face interna (z = 24) é do interior
const EAST_X = 22.5, NORTH_Z = -22.5, WEST_END = -60;
const HALF = 15.6;                            // meia largura do pavilhão central
const PAIRS = [-13.4, -4.6, 4.6, 13.4];       // centros dos pares de colunas
const PAIR_GAP = 0.65;                         // meia distância entre as duas colunas do par
const COL_R = 0.48;
const isFree = (x: number) => Math.abs(x) < 10;   // os pares de dentro ficam soltos no patamar; os de fora, encostados
const colZ = (x: number) => (isFree(x) ? 25.15 : FACADE_Z + 0.2);
const Y_PED = 1.7, Y_SHAFT = Y_PED + 0.42, Y_CAP = 8.9, CAP_H = 1.1, Y_ENT = Y_CAP + CAP_H, Y_FRIEZE = Y_ENT + 0.6, Y_CORN = Y_FRIEZE + 0.6, Y_ENT_TOP = Y_CORN + 0.6;
const Y_ATTIC_TOP = 14.6, Y_TOP = 15.35;
const ARCHES = [{ cx: -9, w: 4.2, spring: 5.9 }, { cx: 0, w: 4.2, spring: 5.9 }, { cx: 9, w: 4.2, spring: 5.9 }];
const WING_TOP = 11.0, WING_CORNICE = 11.6, WING_BAL = 12.55;
/** Janelas das alas: vão de 3,6 m, janela do piso nobre com frontão e a de cima, menor. */
const BAY = 3.6;
/** Vão do portão da doca na ala oeste. */
const DOCK_X0 = -21.1, DOCK_X1 = -16.9, DOCK_H = 4.45;

/* perfis de moldura (z para fora, y para cima) */
const P_CORNICE: [number, number][] = [[0, 0], [0.08, 0], [0.1, 0.06], [0.16, 0.1], [0.18, 0.18], [0.42, 0.24], [0.5, 0.3], [0.62, 0.36], [0.62, 0.46], [0, 0.46]];
const P_ARCHITRAVE: [number, number][] = [[0, 0], [0.18, 0], [0.18, 0.18], [0.21, 0.2], [0.21, 0.38], [0.25, 0.42], [0.25, 0.6], [0, 0.6]];
const P_WATER: [number, number][] = [[0, 0], [0.14, 0], [0.14, 0.05], [0.06, 0.16], [0, 0.18]];
const P_BIGCORNICE: [number, number][] = [[0, 0], [0.1, 0], [0.14, 0.08], [0.22, 0.14], [0.26, 0.24], [0.6, 0.32], [0.7, 0.42], [0.86, 0.5], [0.86, 0.66], [0.7, 0.72], [0, 0.75]];
const P_SILL: [number, number][] = [[0, 0], [0.16, 0.02], [0.18, 0.1], [0.12, 0.14], [0, 0.14]];

function useFacadeGeometry(q: Quality) {
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

/** Janelas das alas e das outras faces: vidro (escuro ou aceso), moldura, peitoril e frontão — tudo instanciado. */
function useWindows() {
  return useMemo(() => {
    const big: THREE.Matrix4[] = [], small: THREE.Matrix4[] = [], litBig: THREE.Matrix4[] = [], litSmall: THREE.Matrix4[] = [];
    let n = 0; const lit = () => (n++ * 7919) % 11 < 3;
    const put = (m: THREE.Matrix4, isBig: boolean) => { if (lit()) (isBig ? litBig : litSmall).push(m); else (isBig ? big : small).push(m); };
    // sul: ala oeste e ala leste (vão de 3,6 m entre pilastras)
    for (let x = -HALF - BAY / 2; x > WEST_END + 1; x -= BAY) { if (x > DOCK_X0 - 1.2 && x < DOCK_X1 + 1.2) { put(inst(x, 5.6, FACADE_Z, 0, [0.85, 0.75, 1]), false); continue; } put(inst(x, 0, FACADE_Z, 0), true); put(inst(x, 5.6, FACADE_Z, 0, [0.85, 0.75, 1]), false); }
    for (const x of [HALF + 1.7, HALF + 5.2]) { put(inst(x, 0, FACADE_Z, 0), true); put(inst(x, 5.6, FACADE_Z, 0, [0.85, 0.75, 1]), false); }
    // leste (beco): janelas ao longo de z, menos onde fica a porta da escada de incêndio
    for (let z = 22.4; z > NORTH_Z + 1; z -= BAY) { if (z > -16.5 && z < -11.5) continue; put(inst(EAST_X, 0, z, Math.PI / 2), true); put(inst(EAST_X, 5.6, z, Math.PI / 2, [0.85, 0.75, 1]), false); }
    put(inst(EAST_X, 5.6, -14, Math.PI / 2, [0.85, 0.75, 1]), false);
    // norte (sobre o beiral e abaixo dele, até o parque)
    for (let x = -18; x <= 18.01; x += BAY) { put(inst(x, 2.6, NORTH_Z, Math.PI, [0.85, 0.75, 1]), false); put(inst(x, -5.2, NORTH_Z, Math.PI, [0.85, 0.75, 1]), false); put(inst(x, -9.4, NORTH_Z, Math.PI, [0.85, 0.6, 1]), false); }
    // pátio (paredes de cima, viradas para dentro)
    for (let z = -20; z <= -8; z += BAY) { put(inst(12.48, 5.4, z, Math.PI / 2, [0.85, 0.75, 1]), false); put(inst(22.02, 5.4, z, -Math.PI / 2, [0.85, 0.75, 1]), false); }
    for (let x = 14.5; x <= 20.5; x += 3) { put(inst(x, 5.4, -22.02, 0, [0.85, 0.75, 1]), false); put(inst(x, 5.4, -6.48, Math.PI, [0.85, 0.75, 1]), false); }
    // peças da janela no espaço local (fachada sul, base em y = 0): vidro 1,7 × 3,4, moldura, peitoril e frontão
    const glass = boxGeo(-0.85, 1.0, 0.0, 0.85, 4.4, 0.03);
    const frame = merge([boxGeo(-1.05, 0.85, 0, 1.05, 1.0, 0.16), boxGeo(-1.05, 4.4, 0, 1.05, 4.6, 0.12), boxGeo(-1.05, 1.0, 0, -0.85, 4.4, 0.12), boxGeo(0.85, 1.0, 0, 1.05, 4.4, 0.12)]);
    const ped = new THREE.Shape([new THREE.Vector2(-1.25, 0), new THREE.Vector2(1.25, 0), new THREE.Vector2(0, 0.62)]);
    const pg = new THREE.ExtrudeGeometry(ped, { depth: 0.22, bevelEnabled: false }); pg.translate(0, 4.62, 0);
    const pediment = merge([worldUV(pg), boxGeo(-1.3, 4.6, 0, 1.3, 4.68, 0.26)]);
    const mullion = merge([boxGeo(-0.03, 1.0, 0.02, 0.03, 4.4, 0.06), boxGeo(-0.85, 2.9, 0.02, 0.85, 2.95, 0.06)]);
    return { big, small, litBig, litSmall, glass, frame, pediment, mullion };
  }, []);
}

export function Instanced({ geometry, material, matrices, shadow = false }: { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[]; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mesh = useMemo(() => { const m = new THREE.InstancedMesh(geometry, material, Math.max(1, matrices.length)); matrices.forEach((x, i) => m.setMatrixAt(i, x)); m.count = matrices.length; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); m.castShadow = shadow; m.receiveShadow = true; return m; }, [geometry, material, matrices, shadow]);
  return <primitive ref={ref} object={mesh} />;
}

/** Banners da fachada: [tipo, x, y0, y1, largura, z]. Os três do Instituto dividem a textura (uma malha só). */
const BANNERS: { kind: "aurora" | "lumiere" | "institute" | "marquee"; x: number; y0: number; y1: number; w: number; z: number }[] = [
  { kind: "aurora", x: -9, y0: 2.2, y1: 9.75, w: 3.6, z: FACADE_Z + 0.12 }, { kind: "lumiere", x: 9, y0: 2.2, y1: 9.75, w: 3.6, z: FACADE_Z + 0.12 },
  { kind: "marquee", x: 0, y0: 8.95, y1: 9.85, w: 3.6, z: FACADE_Z + 0.32 },
  ...[-21.6, -36, -50.4].map((x) => ({ kind: "institute" as const, x, y0: 5.4, y1: 10.6, w: 1.7, z: FACADE_Z + 0.14 })),
];
/** Tecido dos banners (leve ondulação), um lote por desenho, e as hastes e ponteiras de latão de todos num lote só. */
function Banners({ q }: { q: Quality }) {
  const m = exteriorMaterials(q);
  const data = useMemo(() => {
    const cloth = new Map<string, THREE.BufferGeometry[]>(), brass: THREE.BufferGeometry[] = [];
    for (const b of BANNERS) {
      const h = b.y1 - b.y0, g = new THREE.PlaneGeometry(b.w, h, 10, 16), p = g.getAttribute("position");
      for (let i = 0; i < p.count; i++) { const u = p.getX(i) / b.w + 0.5, v = p.getY(i) / h + 0.5; p.setZ(i, 0.045 * Math.sin(u * Math.PI * 4 + v * 1.3) * (0.4 + 0.6 * (1 - v))); }
      g.computeVertexNormals(); g.translate(b.x, (b.y0 + b.y1) / 2, b.z);
      (cloth.get(b.kind) ?? cloth.set(b.kind, []).get(b.kind)!).push(g);
      const rod = (y: number, r: number, len: number, dz: number) => { const c = new THREE.CylinderGeometry(r, r, len, 10); c.rotateZ(Math.PI / 2); c.translate(b.x, y, b.z + dz); return c; };
      brass.push(rod(b.y1 + 0.06, 0.035, b.w + 0.3, 0), rod(b.y0 - 0.04, 0.025, b.w + 0.1, 0.02));
      for (const s of [-1, 1]) { const f = new THREE.SphereGeometry(0.06, 10, 8); f.translate(b.x + s * (b.w / 2 + 0.15), b.y1 + 0.06, b.z); brass.push(f); }
    }
    return { cloth: [...cloth.entries()].map(([k, l]) => ({ k: k as (typeof BANNERS)[number]["kind"], geo: merge(l) })), brass: merge(brass) };
  }, []);
  const mats = useMemo(() => Object.fromEntries(data.cloth.map(({ k }) => [k, new THREE.MeshStandardMaterial({ map: bannerTex(q, k), roughness: 0.82, side: THREE.DoubleSide, envMapIntensity: 0.3 })])), [q, data]);
  return (<>
    {data.cloth.map(({ k, geo }) => <mesh key={k} geometry={geo} material={mats[k]} castShadow receiveShadow />)}
    <mesh geometry={data.brass} material={m.brass} />
  </>);
}

/** Portas de bronze e vidro do arco central: duas folhas que abrem para dentro (dobradiças nas pontas). */
function FrontDoors({ q, view }: { q: Quality; view: React.MutableRefObject<SceneView> }) {
  const m = exteriorMaterials(q);
  const left = useRef<THREE.Group>(null), right = useRef<THREE.Group>(null), open = useRef(0);
  const leaf = useMemo(() => {
    const frame = merge([boxGeo(0, 0, -0.04, 2, 0.22, 0.04), boxGeo(0, 3.98, -0.04, 2, 4.2, 0.04), boxGeo(0, 0, -0.04, 0.12, 4.2, 0.04), boxGeo(1.88, 0, -0.04, 2, 4.2, 0.04), boxGeo(0.12, 2.05, -0.04, 1.88, 2.15, 0.04),
      // almofada de bronze na parte de baixo: painel com moldura em relevo
      boxGeo(0.12, 0.22, -0.03, 1.88, 1.1, 0.03), boxGeo(0.3, 0.38, 0.03, 1.7, 0.94, 0.05), boxGeo(0.22, 0.3, 0.03, 1.78, 0.36, 0.06), boxGeo(0.22, 0.96, 0.03, 1.78, 1.02, 0.06), boxGeo(0.22, 0.3, 0.03, 0.28, 1.02, 0.06), boxGeo(1.72, 0.3, 0.03, 1.78, 1.02, 0.06), boxGeo(0.12, 1.1, -0.04, 1.88, 1.16, 0.04)]);
    const glass = merge([boxGeo(0.12, 1.16, -0.012, 1.88, 2.05, 0.012), boxGeo(0.12, 2.15, -0.012, 1.88, 3.98, 0.012)]);
    const bar = merge([boxGeo(1.62, 0.95, 0.05, 1.66, 2.2, 0.09), boxGeo(1.6, 0.95, 0.03, 1.68, 1.0, 0.09), boxGeo(1.6, 2.15, 0.03, 1.68, 2.2, 0.09)]);
    return { frame, glass, bar };
  }, []);
  const glass = useMemo(() => { const g = m.glassWarm.clone(); g.emissiveIntensity = 0.55; g.transparent = true; g.opacity = 0.75; return g; }, [m]);
  useFrame((_, dt) => {
    const target = view.current.doors.front ? 1 : 0; open.current += (target - open.current) * Math.min(1, dt * 3);
    const a = open.current * 1.45;
    if (left.current) left.current.rotation.y = a; if (right.current) right.current.rotation.y = -a;
  });
  const Leaf = () => (<>
    <mesh geometry={leaf.frame} material={m.bronze} castShadow /><mesh geometry={leaf.glass} material={glass} /><mesh geometry={leaf.bar} material={m.brass} />
  </>);
  return (
    <group position={[0, 0, 24.28]}>
      <group ref={left} position={[-2, 0, 0]}><Leaf /></group>
      <group ref={right} position={[2, 0, 0]} scale={[-1, 1, 1]}><Leaf /></group>
    </group>
  );
}

/** Vidraça em arco (bandeira sobre as portas, arcos laterais): vidro fosco aceso e caixilhos de bronze. */
function ArchGlazing({ q, cx, spring, w, from }: { q: Quality; cx: number; spring: number; w: number; from: number }) {
  const m = exteriorMaterials(q);
  const { glass, bars } = useMemo(() => {
    const r = w / 2, sh = new THREE.Shape(); sh.moveTo(-r, from); sh.lineTo(r, from); sh.lineTo(r, spring); sh.absarc(0, spring, r, 0, Math.PI, false); sh.closePath();
    const g = new THREE.ShapeGeometry(sh, 24); g.translate(cx, 0, 24.24);
    const parts: THREE.BufferGeometry[] = [boxGeo(cx - r, from - 0.12, 24.22, cx + r, from, 24.3)];
    for (let k = 1; k < 6; k++) { const a = (k / 6) * Math.PI, b = new THREE.BoxGeometry(0.06, r, 0.06); b.translate(0, r / 2, 0); b.rotateZ(a - Math.PI / 2); b.translate(cx, spring, 24.27); parts.push(worldUV(b)); }
    parts.push(boxGeo(cx - 0.03, from, 24.24, cx + 0.03, spring, 24.3));
    const arc = new THREE.TorusGeometry(r * 0.45, 0.035, 6, 24, Math.PI); arc.translate(cx, spring, 24.27); parts.push(worldUV(arc));
    return { glass: g, bars: merge(parts) };
  }, [cx, spring, w, from]);
  const lit = useMemo(() => { const g = m.glassFrosted.clone(); g.emissiveIntensity = 1.05; return g; }, [m]);
  return (<><mesh geometry={glass} material={lit} /><mesh geometry={bars} material={m.bronze} /></>);
}

/** Portão de enrolar da doca: as ripas sobem para o rolo quando `dockGate` abre. */
function DockGate({ q, view }: { q: Quality; view: React.MutableRefObject<SceneView> }) {
  const m = exteriorMaterials(q);
  const slats = useRef<THREE.Mesh>(null), open = useRef(0);
  const geo = useMemo(() => { const parts: THREE.BufferGeometry[] = []; for (let k = 0; k < 40; k++) parts.push(boxGeo(-2, k * 0.1, -0.02, 2, k * 0.1 + 0.085, 0.02)); return merge(parts); }, []);
  const panel = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8d9296", metalness: 0.7, roughness: 0.45 }), []);
  useFrame((_, dt) => {
    const target = view.current.doors.dockGate ? 1 : 0; open.current += (target - open.current) * Math.min(1, dt * 1.6);
    if (slats.current) { const s = Math.max(0.02, 1 - open.current); slats.current.scale.y = s; slats.current.position.y = 4 * (1 - s); }
  });
  const sign = signTex("dock", [SIGNAGE.dock, SIGNAGE.staffOnly], { w: 512, h: 128, bg: "#f2c230", ink: "#151515" });
  return (
    <group position={[-19, 0, 24.32]}>
      <mesh ref={slats} geometry={geo} material={panel} castShadow />
      <mesh material={m.galvanized} position={[0, 4.2, 0.05]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.24, 0.24, 4.3, 16]} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} material={m.galvanized} position={[s * 2.08, 2.1, 0.06]}><boxGeometry args={[0.16, 4.3, 0.12]} /></mesh>)}
      {/* para-choques de borracha da doca e faixas de segurança */}
      {[-1, 1].map((s) => <mesh key={`b${s}`} material={m.rubber} position={[s * 2.35, 0.35, 0.25]}><boxGeometry args={[0.25, 0.5, 0.25]} /></mesh>)}
      <mesh position={[0, 4.75, 0.06]}><planeGeometry args={[2.6, 0.65]} /><meshStandardMaterial map={sign} roughness={0.6} /></mesh>
      {/* interfone da doca (interação dockIntercom em x −16,4) */}
      <group position={[2.6, 1.2, 0.08]}>
        <mesh material={m.galvanized}><boxGeometry args={[0.22, 0.34, 0.08]} /></mesh>
        <mesh position={[0, 0.06, 0.045]}><circleGeometry args={[0.035, 16]} /><meshStandardMaterial emissive="#7cff9a" emissiveIntensity={3} color="#0a2a12" /></mesh>
      </group>
    </group>
  );
}

/** Porta da escada de incêndio (beco): batente de aço e a placa de saída acesa. A folha é do interior. */
function FireDoorFrame({ q }: { q: Quality }) {
  const m = exteriorMaterials(q);
  const sign = signTex("exit", [SIGNAGE.exit], { w: 512, h: 96, bg: "#0b7a3b", ink: "#ffffff" });
  return (
    <group>
      {[-15.08, -12.92].map((z) => <mesh key={z} material={m.galvanized} position={[22.56, 1.12, z]}><boxGeometry args={[0.14, 2.3, 0.16]} /></mesh>)}
      <mesh material={m.galvanized} position={[22.56, 2.3, -14]}><boxGeometry args={[0.14, 0.14, 2.3]} /></mesh>
      <mesh position={[22.58, 2.75, -14]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[1.5, 0.28]} /><meshStandardMaterial map={sign} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={1.4} /></mesh>
      <mesh material={m.lampGlow} position={[22.62, 2.55, -15.4]}><boxGeometry args={[0.12, 0.18, 0.3]} /></mesh>
    </group>
  );
}

export function HeistFacade({ q, view }: { q: Quality; view: React.MutableRefObject<SceneView> }) {
  const m = exteriorMaterials(q);
  const g = useFacadeGeometry(q);
  const w = useWindows();
  const inscription = useMemo(() => new THREE.MeshStandardMaterial({ map: inscriptionTex(q, SIGNAGE.museum), transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), [q]);
  const plaques = useMemo(() => ({ museum: plaqueTex(q, "museum", [SIGNAGE.museum, "FUNDADO EM MCMXXXI", "ARTE · TRAJE · CIDADE"]), gala: plaqueTex(q, "gala", [SIGNAGE.institute, "GALA LUMIÈRE · ENTRADA", "SOMENTE COM CONVITE"]) }), [q]);
  return (
    <group>
      <mesh geometry={g.ashlar} material={m.ashlar} castShadow receiveShadow />
      <mesh geometry={g.rustic} material={m.rustic} castShadow receiveShadow />
      <mesh geometry={g.stone} material={m.stone} castShadow receiveShadow />
      <mesh geometry={g.rough} material={m.roughStone} castShadow receiveShadow />
      <mesh geometry={g.roof} material={m.roof} receiveShadow />
      <Instanced geometry={g.shaft} material={m.stone} matrices={g.colMatrices.map((x) => x.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.42, 0)))} shadow />
      <Instanced geometry={g.base} material={m.stone} matrices={g.colMatrices} shadow />
      <Instanced geometry={g.capital} material={m.stoneDouble} matrices={g.colMatrices.map((x) => x.clone().multiply(new THREE.Matrix4().makeTranslation(0, Y_CAP - Y_PED, 0)))} shadow />
      {/* janelas */}
      <Instanced geometry={w.glass} material={m.glassDark} matrices={[...w.big]} />
      <Instanced geometry={w.glass} material={m.glassWarm} matrices={[...w.litBig]} />
      <Instanced geometry={w.glass} material={m.glassDark} matrices={[...w.small]} />
      <Instanced geometry={w.glass} material={m.glassWarm} matrices={[...w.litSmall]} />
      <Instanced geometry={w.mullion} material={m.bronze} matrices={[...w.big, ...w.litBig, ...w.small, ...w.litSmall]} />
      <Instanced geometry={w.frame} material={m.stone} matrices={[...w.big, ...w.litBig, ...w.small, ...w.litSmall]} />
      <Instanced geometry={w.pediment} material={m.stone} matrices={[...w.big, ...w.litBig]} />
      {/* placas de bronze nos pedestais dos pares soltos (nome do museu e a entrada da gala) */}
      {[[-4.6, "museum"], [4.6, "gala"]].map(([x, k]) => <mesh key={k as string} position={[x as number, 0.62, 25.82]}><boxGeometry args={[1.05, 0.65, 0.035]} /><meshStandardMaterial map={k === "museum" ? plaques.museum : plaques.gala} metalness={0.55} roughness={0.42} /></mesh>)}
      {/* inscrição no friso, entre os pares de dentro */}
      <mesh material={inscription} position={[0, Y_FRIEZE + 0.3, FACADE_Z + 0.205]}><planeGeometry args={[7.6, 0.475]} /></mesh>
      {/* vãos: portas centrais, bandeira e os arcos laterais envidraçados */}
      <FrontDoors q={q} view={view} />
      <mesh material={m.bronze} position={[0, 4.32, 24.27]}><boxGeometry args={[4.2, 0.24, 0.1]} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} material={m.bronze} position={[s * 2.05, 2.1, 24.27]}><boxGeometry args={[0.1, 4.2, 0.1]} /></mesh>)}
      <ArchGlazing q={q} cx={0} spring={5.9} w={4.2} from={4.44} />
      {[-9, 9].map((cx) => <ArchGlazing key={cx} q={q} cx={cx} spring={5.9} w={4.2} from={0} />)}
      {/* banners da exposição entre os pares e a faixa sobre o arco central */}
      <Banners q={q} />
      <DockGate q={q} view={view} />
      <FireDoorFrame q={q} />
    </group>
  );
}
