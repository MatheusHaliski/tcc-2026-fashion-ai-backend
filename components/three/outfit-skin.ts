/**
 * Pele debaixo da roupa de .glb (glb-garment/cover.ts): o corpo deixa de desenhar como pele os triângulos que a
 * peça cobre e, no lugar deles, entra o FORRO — a mesma área do corpo, presa ao mesmo esqueleto, na cor da peça.
 * É a troca de parte do corpo dos sistemas modulares de jogo: furo, malha rala ou pele atravessando o .glb mostram
 * o forro, não a pele nem o vazio.
 *
 * O índice completo da pele fica guardado por geometria; vestir de novo começa por `showSkin` e cada peça que entra
 * soma a sua cobertura com `hideSkin`. Posições, pesos e material do corpo não mudam.
 */
import * as THREE from "three";
import type { HumanParts } from "@/components/three/human-avatar";

const full = new WeakMap<THREE.BufferGeometry, THREE.BufferAttribute>();
const hidden = new WeakMap<THREE.BufferGeometry, Uint8Array>();

/** Volta a desenhar a pele inteira. */
export function showSkin(parts: HumanParts): void {
  const geometry = parts.human.body.geometry;
  const index = full.get(geometry);
  if (index) geometry.setIndex(index);
  hidden.delete(geometry);
}

function indexOf(source: ArrayLike<number>, triangles: number[]): THREE.BufferAttribute {
  const Index = source instanceof Uint32Array ? Uint32Array : Uint16Array;
  return new THREE.BufferAttribute(Index.from(triangles), 1);
}

/**
 * Tira da pele os triângulos com os três vértices debaixo da peça (`covered`: 1 por vértice do corpo), somando às
 * peças anteriores, e devolve o forro dessa peça (null se ela não cobre nenhum triângulo inteiro).
 */
export function hideSkin(parts: HumanParts, covered: Uint8Array, color: THREE.ColorRepresentation, layer: number): THREE.SkinnedMesh | null {
  const body = parts.human.body, geometry = body.geometry;
  const all = full.get(geometry) ?? geometry.getIndex();
  if (!all) return null;
  full.set(geometry, all);
  const sum = hidden.get(geometry) ?? new Uint8Array(covered.length);
  for (let v = 0; v < covered.length; v++) if (covered[v]) sum[v] = 1;
  hidden.set(geometry, sum);
  const skin = parts.asset.body.renderVertex, source = all.array;
  const keep: number[] = [], lining: number[] = [];
  for (let t = 0; t < source.length; t += 3) {
    const a = source[t], b = source[t + 1], c = source[t + 2];
    if (covered[skin[a]] && covered[skin[b]] && covered[skin[c]]) lining.push(a, b, c);
    if (!(sum[skin[a]] && sum[skin[b]] && sum[skin[c]])) keep.push(a, b, c);
  }
  geometry.setIndex(indexOf(source, keep));
  if (!lining.length) return null;
  // cópia da geometria do corpo (posições e pesos): o desmonte da roupa descarta o forro sem tocar no corpo
  const shell = geometry.clone();
  shell.setIndex(indexOf(source, lining));
  // por baixo do .glb: o pano da peça ganha a disputa de profundidade onde os dois coincidem
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1 - layer, polygonOffsetUnits: 1 - layer });
  material.name = "forro";
  const mesh = new THREE.SkinnedMesh(shell, material);
  mesh.castShadow = true; mesh.frustumCulled = false;
  mesh.userData = { buildPath: "GLB_LINING" };
  parts.human.root.add(mesh); mesh.bind(parts.human.skeleton, body.bindMatrix);
  return mesh;
}
