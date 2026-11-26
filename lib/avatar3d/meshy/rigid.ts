/**
 * Calçado e acessório da Meshy viram malha presa ao esqueleto do avatar:
 *
 * - rígido: todos os vértices com peso 1 no osso de âncora (pé, cabeça, antebraço, mão, quadril, peito) — a peça anda
 *   inteira com o osso, sem deformar (sapato, óculos, pulseira, bolsa);
 * - flexível (`conform`): colisão com a pele e pesos transferidos da pele mais próxima (glb-garment/wrap.ts).
 *
 * A posição de repouso é a posada desfeita pela matriz do osso (a mesma volta do glb-garment), e a malha usa o MESMO
 * esqueleto e bindMatrix do corpo: dispensa sincronizar a peça com a pose a cada quadro.
 */
import * as THREE from "three";
import type { BodyFrame } from "../human/glb-garment/frame";
import type { GlbSource } from "../human/glb-garment";
import { conformGarment } from "../human/glb-garment/wrap";
import type { MeshyManifest } from "./manifest";
import type { Placed } from "./place";

const TORSO = 1, LEG = 3, FOOT = 4;
/** Folga (m) do acessório flexível até a pele: por cima da roupa. */
export const OVER_CLOTHES = 0.035;

/** Triângulos da fonte cujos três vértices estão na peça posta, já no índice local dela (com a ordem invertida se espelhada). */
export function subsetOf(src: GlbSource, placed: Placed) {
  const local = new Int32Array(src.position.length / 3).fill(-1);
  placed.vertices.forEach((v, k) => { local[v] = k; });
  const index: number[] = [], groups: GlbSource["groups"] = [];
  const ranges = src.groups.length ? src.groups : [{ start: 0, count: src.index.length, materialIndex: 0 }];
  for (const g of ranges) {
    const start = index.length;
    for (let t = g.start; t < g.start + g.count; t += 3) {
      const a = local[src.index[t]], b = local[src.index[t + 1]], c = local[src.index[t + 2]];
      if (a < 0 || b < 0 || c < 0) continue;
      if (placed.mirrored) index.push(a, c, b); else index.push(a, b, c);
    }
    groups.push({ start, count: index.length - start, materialIndex: g.materialIndex });
  }
  return { index: Uint32Array.from(index), groups };
}

/** Repouso de um vértice preso a um só osso: a inversa da matriz de skinning desse osso. */
function unskinRigid(pos: Float32Array, bone: THREE.Matrix4): Float32Array {
  const inv = bone.clone().invert(), out = new Float32Array(pos.length), v = new THREE.Vector3();
  for (let i = 0; i < pos.length; i += 3) {
    v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(inv);
    out[i] = v.x; out[i + 1] = v.y; out[i + 2] = v.z;
  }
  return out;
}

/**
 * Geometria presa ao esqueleto. `boneIndex`: índice do osso pelo nome curto (Head, LeftFoot…), -1 se não existe.
 * null quando o osso não existe ou a peça ficou sem triângulos.
 */
export function wornGeometry(src: GlbSource, placed: Placed, m: MeshyManifest, f: BodyFrame, boneIndex: (name: string) => number): THREE.BufferGeometry | null {
  const { index, groups } = subsetOf(src, placed); if (!index.length) return null;
  const n = placed.vertices.length; let rest: Float32Array, skinIndex: Uint16Array, skinWeight: Float32Array;
  if (m.attach === "conform") {
    // colar e cachecol vão por cima da roupa: a folga até a pele é a de um casaco (a roupa da Meshy fica a 1–3 cm)
    const c = conformGarment(placed.pos, index, f, [TORSO], OVER_CLOTHES);
    rest = c.rest; skinIndex = c.skinIndex; skinWeight = c.skinWeight;
  } else {
    const b = boneIndex(placed.bone); if (b < 0 || !f.bone[b]) return null;
    rest = unskinRigid(placed.pos, f.bone[b]);
    skinIndex = new Uint16Array(n * 4); skinWeight = new Float32Array(n * 4);
    for (let v = 0; v < n; v++) { skinIndex[v * 4] = b; skinWeight[v * 4] = 1; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(rest, 3));
  if (src.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(uvOf(src.uv, placed.vertices), 2));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  for (const gr of groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  g.computeVertexNormals();
  return g;
}

function uvOf(uv: Float32Array, vertices: Uint32Array): Float32Array {
  const out = new Float32Array(vertices.length * 2);
  vertices.forEach((v, k) => { out[k * 2] = uv[v * 2]; out[k * 2 + 1] = uv[v * 2 + 1]; });
  return out;
}

/**
 * Pele debaixo do calçado fechado (1 por vértice do corpo): o pé daquele lado e a perna abaixo da boca do cano, dentro
 * da caixa do calçado. Calçado aberto (sandália, chinelo, salto aberto) não esconde pele.
 */
export function coveredByShoe(placed: Placed, m: MeshyManifest, f: BodyFrame): Uint8Array | null {
  if (m.slot !== "feet" || m.dicas.aberto || !placed.side) return null;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, top = -Infinity;
  for (let i = 0; i < placed.pos.length; i += 3) {
    x0 = Math.min(x0, placed.pos[i]); x1 = Math.max(x1, placed.pos[i]); top = Math.max(top, placed.pos[i + 1]);
    z0 = Math.min(z0, placed.pos[i + 2]); z1 = Math.max(z1, placed.pos[i + 2]);
  }
  const out = new Uint8Array(f.n);
  for (let v = 0; v < f.n; v++) {
    const x = f.pos[v * 3], y = f.pos[v * 3 + 1], z = f.pos[v * 3 + 2];
    if ((x >= 0 ? 1 : -1) !== placed.side) continue;
    const inside = x > x0 - 0.005 && x < x1 + 0.005 && z > z0 - 0.005 && z < z1 + 0.005 && y < top - 0.015;
    if (f.group[v] === FOOT || (f.group[v] === LEG && inside)) out[v] = 1;
  }
  return out;
}
