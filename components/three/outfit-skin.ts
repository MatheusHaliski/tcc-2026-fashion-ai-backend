/**
 * Pele debaixo da roupa de .glb (glb-garment/cover.ts): o corpo deixa de desenhar como pele os triângulos que a
 * peça cobre e, no lugar deles, entra o FORRO — a mesma área do corpo, presa ao mesmo esqueleto, na cor da peça.
 * É a troca de parte do corpo dos sistemas modulares de jogo: furo, malha rala ou pele atravessando o .glb mostram
 * o forro, não a pele nem o vazio.
 *
 * O índice completo da pele fica guardado por geometria; vestir de novo começa por `showSkin` e cada peça que entra
 * troca a sua parte com `hideSkin`. Posições, pesos e material do corpo não mudam.
 */
import * as THREE from "three";
import type { HumanParts } from "@/components/three/human-avatar";

const full = new WeakMap<THREE.BufferGeometry, THREE.BufferAttribute>();
/** Triângulos da pele (um por trinca do índice completo) que já viraram forro de alguma peça. */
const lined = new WeakMap<THREE.BufferGeometry, Uint8Array>();

/** Volta a desenhar a pele inteira. */
export function showSkin(parts: HumanParts): void {
  const geometry = parts.human.body.geometry;
  const index = full.get(geometry);
  if (index) geometry.setIndex(index);
  lined.delete(geometry);
}

function indexOf(source: ArrayLike<number>, triangles: number[]): THREE.BufferAttribute {
  const Index = source instanceof Uint32Array ? Uint32Array : Uint16Array;
  return new THREE.BufferAttribute(Index.from(triangles), 1);
}

/**
 * Tira da pele os triângulos com os três vértices debaixo DESTA peça (`covered`: 1 por vértice do corpo) e devolve o
 * forro dela (null se a peça não cobre nenhum triângulo inteiro). A pele só some onde um forro entra: o triângulo
 * que duas peças cobrem em parte cada uma (a cintura entre a blusa e a calça) continua pele, sem buraco.
 */
export function hideSkin(parts: HumanParts, covered: Uint8Array, color: THREE.ColorRepresentation, layer: number): THREE.SkinnedMesh | null {
  const body = parts.human.body, geometry = body.geometry;
  const all = full.get(geometry) ?? geometry.getIndex();
  if (!all) return null;
  full.set(geometry, all);
  const skin = parts.asset.body.renderVertex, source = all.array;
  const done = lined.get(geometry) ?? new Uint8Array(source.length / 3);
  lined.set(geometry, done);
  const keep: number[] = [], lining: number[] = [];
  for (let t = 0; t < source.length; t += 3) {
    const a = source[t], b = source[t + 1], c = source[t + 2];
    if (covered[skin[a]] && covered[skin[b]] && covered[skin[c]]) {
      lining.push(a, b, c);
      done[t / 3] = 1;
    }
    if (!done[t / 3]) keep.push(a, b, c);
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
