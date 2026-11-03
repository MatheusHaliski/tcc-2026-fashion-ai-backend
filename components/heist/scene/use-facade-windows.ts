/*
 * MET Gala Heist v2 — fachada do museu: janelas das alas e das outras faces (matrizes de instância, acesas ou escuras, e as peças da
 * janela no espaço local), memorizadas por hook.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { boxGeo, inst, merge, worldUV } from "./exterior-geometry";
import { BAY, DOCK_X0, DOCK_X1, EAST_X, FACADE_Z, HALF, NORTH_Z, WEST_END } from "./exterior-facade-dims";

/** Janelas das alas e das outras faces: vidro (escuro ou aceso), moldura, peitoril e frontão — tudo instanciado. */
export function useWindows() {
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
