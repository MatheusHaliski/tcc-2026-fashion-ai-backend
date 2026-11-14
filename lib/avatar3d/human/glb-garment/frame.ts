/**
 * Corpo do avatar na pose de exibição, no espaço da malha do corpo (o mesmo do bindMatrix): posições e normais da pele
 * com skinning na CPU, articulações, matrizes dos ossos e busca do vértice de pele mais próximo por região.
 * É a referência para ajustar um .glb estático (sem esqueleto) ao avatar: glb-garment/align.ts e wrap.ts.
 */
import * as THREE from "three";
import type { BodyAsset } from "../asset";
import type { Composed } from "../compose";
import type { BodyParam } from "../garments";
import { baseNormals, type Human } from "../three-human";

/** Grupos do bodyParam: 0 cabeça, 1 tronco, 2 braço, 3 perna, 4 pé, 5 mão. */
export type Groups = readonly number[];

export interface BodyFrame {
  n: number;
  pos: Float32Array;            // pele posada (n × 3)
  nrm: Float32Array;            // normais da pele posada
  group: Uint8Array;
  skinIndex: Uint8Array;        // 4 ossos por vértice da pele
  skinWeight: Float32Array;     // 0–1
  bone: THREE.Matrix4[];        // osso → matriz de skinning (repouso → pose), no espaço do corpo
  joint: (name: string) => THREE.Vector3;
  /** Vértice de pele mais próximo de (x, y, z) entre os grupos pedidos (e do lado pedido: 1 = x ≥ 0, −1 = x < 0); -1 sem vizinho. */
  near: (x: number, y: number, z: number, groups: Groups, side?: number) => number;
}

const CELL = 0.04;

export function boneMatrices(human: Human): THREE.Matrix4[] {
  const sk = human.skeleton;
  sk.bones.forEach((b) => b.updateMatrixWorld(true));
  human.body.updateWorldMatrix(true, false);
  const toBody = human.body.matrixWorld.clone().invert();
  return sk.bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, sk.boneInverses[i])
    .multiply(human.body.bindMatrix).premultiply(toBody));
}

function grid(pos: Float32Array, group: Uint8Array, n: number) {
  const cells = new Map<number, number[]>();
  const key = (i: number, j: number, k: number) => ((i + 512) * 1024 + (j + 512)) * 1024 + (k + 512);
  for (let v = 0; v < n; v++) {
    const k = key(Math.floor(pos[v * 3] / CELL), Math.floor(pos[v * 3 + 1] / CELL), Math.floor(pos[v * 3 + 2] / CELL));
    (cells.get(k) ?? cells.set(k, []).get(k)!).push(v);
  }
  return (x: number, y: number, z: number, groups: Groups, side = 0) => {
    const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL), ck = Math.floor(z / CELL);
    let best = -1, bd = Infinity;
    // anéis crescentes: para no primeiro anel com candidato e confere um anel a mais (o vizinho pode estar na borda)
    for (let r = 0, stop = 12; r <= stop; r++) {
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let c = -r; c <= r; c++) {
        if (Math.max(Math.abs(a), Math.abs(b), Math.abs(c)) !== r) continue;
        for (const v of cells.get(key(ci + a, cj + b, ck + c)) ?? []) {
          if (!groups.includes(group[v]) || (side && (pos[v * 3] >= 0 ? 1 : -1) !== side)) continue;
          const d = (pos[v * 3] - x) ** 2 + (pos[v * 3 + 1] - y) ** 2 + (pos[v * 3 + 2] - z) ** 2;
          if (d < bd) { bd = d; best = v; }
        }
      }
      if (best >= 0 && stop > r + 1) stop = r + 1;
    }
    return best;
  };
}

/** Corpo posado como está agora (chame depois de aplicar a pose de exibição). */
export function bodyFrame(human: Human, asset: BodyAsset, composed: Composed, P: BodyParam): BodyFrame {
  const n = asset.meta.counts.body;
  const skinWeight = Float32Array.from(asset.body.skinWeight.subarray(0, n * 4), (w) => w / 255);
  const skinIndex = asset.body.skinIndex.subarray(0, n * 4);
  const bone = boneMatrices(human);
  const pos = new Float32Array(n * 3); const p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let v = 0; v < n; v++) {
    p.set(composed.body[v * 3], composed.body[v * 3 + 1], composed.body[v * 3 + 2]); let x = 0, y = 0, z = 0;
    for (let k = 0; k < 4; k++) {
      const w = skinWeight[v * 4 + k]; if (!w) continue;
      q.copy(p).applyMatrix4(bone[skinIndex[v * 4 + k]]); x += w * q.x; y += w * q.y; z += w * q.z;
    }
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
  }
  const nrm = baseNormals(pos, asset.body.index, asset.body.renderVertex);
  const toBody = human.body.matrixWorld.clone().invert();
  const joint = (name: string) => human.bone(name).getWorldPosition(new THREE.Vector3()).applyMatrix4(toBody);
  return { n, pos, nrm, group: P.group, skinIndex, skinWeight, bone, joint, near: grid(pos, P.group, n) };
}

/** Extensão em x e z da pele dos grupos pedidos numa faixa de altura (null se a faixa não tem pele). */
export function bandExtent(f: BodyFrame, y: number, half: number, groups: Groups, sideOf?: (x: number) => boolean) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let v = 0; v < f.n; v++) {
    const vy = f.pos[v * 3 + 1]; if (Math.abs(vy - y) > half || !groups.includes(f.group[v])) continue;
    const x = f.pos[v * 3], z = f.pos[v * 3 + 2]; if (sideOf && !sideOf(x)) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  return x0 === Infinity ? null : { x0, x1, z0, z1 };
}
