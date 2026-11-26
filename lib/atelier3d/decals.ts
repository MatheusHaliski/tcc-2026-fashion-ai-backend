import * as THREE from "three";
import type { LoadedAsset, SceneDocument, Vec3 } from "./document";
import { clothParts, listParts, nodeOf } from "./garment-parts";

/**
 * Logo/estampa como decalque projetado e preso ao tecido. O documento guarda só os parâmetros (ponto no tecido, direção
 * de projeção, largura, giro, cor, imagem); a malha do decalque é refeita a partir deles (decal-meshes.ts), então
 * desfazer/refazer, salvar/reabrir e exportar seguem o caminho de qualquer outra edição do documento.
 */
export interface DecalEdit {
  /** Objeto dono (chave "n0"): o decalque vive no referencial local dele e acompanha posição, giro e escala. */
  node: string;
  /** Estampa do próprio arquivo (primitiva "n0.p5") que este decalque substitui; ausente em logo novo. */
  target?: string | null;
  /** Imagem enviada (data URL PNG/JPEG/WebP). Ausente: usa a imagem da estampa `target`. */
  image?: string | null;
  position: Vec3;
  /** Direção para fora do tecido (unitária): o decalque é projetado no sentido contrário. */
  normal: Vec3;
  /** Largura na unidade do arquivo (metros no GLB do motor). */
  size: number;
  /** Altura ÷ largura. */
  aspect: number;
  /** Giro em radianos em torno da direção de projeção. */
  rotation: number;
  /** Cor aplicada à imagem (troca a cor média); ausente = cores originais. */
  color?: string | null;
  visible: boolean;
}

export const MAX_DECALS = 8;
export const MAX_DECAL_IMAGE_CHARS = 400_000;
export const DECAL_SIZE = { min: 0.01, max: 1.5 };

export interface DecalEntry {
  key: string;
  edit: DecalEdit;
  /** "print": estampa que veio no arquivo; "logo": imagem que a pessoa enviou. */
  kind: "print" | "logo";
  edited: boolean;
}

/** Eixos do decalque: x = largura, y = altura, z = direção para fora; `rotation` gira x/y em torno de z. */
export function decalBasis(normal: Vec3, rotation: number) {
  const z = new THREE.Vector3(...normal).normalize();
  const up = Math.abs(z.y) > 0.95 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const x = new THREE.Vector3().crossVectors(up, z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  x.applyAxisAngle(z, rotation);
  y.applyAxisAngle(z, rotation);
  return { x, y, z };
}

/** Parâmetros de decalque equivalentes a uma estampa do arquivo: centro, direção média, largura e altura medidas. */
export function printDecal(asset: LoadedAsset, key: string): DecalEdit | null {
  const mesh = asset.primitives.get(key), original = asset.originalPositions.get(key), normals = asset.originalNormals.get(key);
  if (!mesh || !original || original.length < 9) return null;
  const center = new THREE.Vector3(), normal = new THREE.Vector3();
  const count = original.length / 3;
  for (let i = 0; i < count; i++) {
    center.add(new THREE.Vector3(original[i * 3], original[i * 3 + 1], original[i * 3 + 2]));
    if (normals) normal.add(new THREE.Vector3(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]));
  }
  center.divideScalar(count);
  if (normal.lengthSq() < 1e-8) normal.set(0, 0, 1);
  const direction = normal.normalize().toArray() as Vec3;
  const { x, y } = decalBasis(direction, 0);
  const span = (axis: THREE.Vector3) => {
    let low = Infinity, high = -Infinity;
    for (let i = 0; i < count; i++) {
      const d = axis.dot(new THREE.Vector3(original[i * 3], original[i * 3 + 1], original[i * 3 + 2]).sub(center));
      low = Math.min(low, d);
      high = Math.max(high, d);
    }
    return Math.max(high - low, 1e-4);
  };
  const width = span(x), height = span(y);
  return { node: nodeOf(key), target: key, position: center.toArray() as Vec3, normal: direction, size: width, aspect: height / width, rotation: 0, visible: true };
}

/** Estampas do arquivo (editadas ou não) seguidas dos logos novos, na ordem em que aparecem no painel. */
export function listDecals(asset: LoadedAsset, doc: SceneDocument): DecalEntry[] {
  const entries: DecalEntry[] = [];
  for (const part of listParts(asset)) {
    if (part.role !== "estampa") continue;
    const edit = doc.decals?.[part.key] ?? printDecal(asset, part.key);
    if (edit) entries.push({ key: part.key, edit, kind: "print", edited: !!doc.decals?.[part.key] });
  }
  for (const [key, edit] of Object.entries(doc.decals ?? {}))
    if (!asset.primitives.has(key)) entries.push({ key, edit, kind: "logo", edited: true });
  return entries;
}

/** Ponto do tecido atingido por um raio dado no referencial local do objeto; null se o raio não toca o tecido. */
export function surfacePoint(asset: LoadedAsset, node: string, origin: THREE.Vector3, direction: THREE.Vector3): { point: Vec3; normal: Vec3 } | null {
  const owner = asset.nodes.get(node);
  if (!owner) return null;
  owner.updateWorldMatrix(true, true);
  const meshes = clothParts(asset, node).map((key) => asset.primitives.get(key)!).filter(Boolean);
  const from = origin.clone().applyMatrix4(owner.matrixWorld);
  const towards = direction.clone().transformDirection(owner.matrixWorld);
  const hit = new THREE.Raycaster(from, towards).intersectObjects(meshes, false)[0];
  if (!hit) return null;
  const inverse = owner.matrixWorld.clone().invert();
  const normal = (hit.face?.normal ?? new THREE.Vector3(0, 0, 1)).clone().transformDirection(hit.object.matrixWorld).transformDirection(inverse);
  if (normal.dot(direction) > 0) normal.negate();
  return { point: hit.point.clone().applyMatrix4(inverse).toArray() as Vec3, normal: normal.toArray() as Vec3 };
}

/** Caixa do tecido no referencial local do objeto (posições originais do arquivo). */
function clothBounds(asset: LoadedAsset, node: string): THREE.Box3 {
  const box = new THREE.Box3();
  for (const key of clothParts(asset, node)) {
    const original = asset.originalPositions.get(key), mesh = asset.primitives.get(key);
    if (!original || !mesh) continue;
    const local = mesh === asset.nodes.get(node) ? new THREE.Matrix4() : mesh.matrix;
    for (let i = 0; i < original.length; i += 3) box.expandByPoint(new THREE.Vector3(original[i], original[i + 1], original[i + 2]).applyMatrix4(local));
  }
  return box;
}

/** Logo novo: no peito, de frente (+Z é a frente no GLB do motor), com 30% da largura da peça. */
export function defaultPlacement(asset: LoadedAsset, node: string, aspect: number): DecalEdit | null {
  const box = clothBounds(asset, node);
  if (box.isEmpty()) return null;
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const reach = size.length() + 1;
  for (const height of [0.68, 0.5, 0.35]) {
    const hit = surfacePoint(asset, node, new THREE.Vector3(center.x, box.min.y + size.y * height, box.max.z + reach), new THREE.Vector3(0, 0, -1));
    if (hit) return { node, position: hit.point, normal: [0, 0, 1], size: THREE.MathUtils.clamp(size.x * 0.3, DECAL_SIZE.min, DECAL_SIZE.max), aspect, rotation: 0, visible: true };
  }
  return null;
}

/** Desliza o decalque sobre o tecido: desloca no plano do decalque e reprojeta; null se sair da peça. */
export function moveDecal(asset: LoadedAsset, edit: DecalEdit, dx: number, dy: number): DecalEdit | null {
  const { x, y, z } = decalBasis(edit.normal, 0);
  const target = new THREE.Vector3(...edit.position).addScaledVector(x, dx).addScaledVector(y, dy);
  const reach = clothBounds(asset, edit.node).getSize(new THREE.Vector3()).length() + 1;
  const hit = surfacePoint(asset, edit.node, target.clone().addScaledVector(z, reach), z.clone().negate());
  return hit ? { ...edit, position: hit.point } : null;
}

/** Posição do decalque nos eixos da peça (horizontal, vertical), para os campos do painel. */
export function decalOffset(edit: DecalEdit): [number, number] {
  const { x, y } = decalBasis(edit.normal, 0), position = new THREE.Vector3(...edit.position);
  return [position.dot(x), position.dot(y)];
}

export function nextDecalKey(doc: SceneDocument): string {
  for (let i = 1; ; i++) if (!doc.decals?.[`d${i}`]) return `d${i}`;
}

export function validDecal(edit: DecalEdit): boolean {
  const finite = (values: number[]) => values.every((value) => Number.isFinite(value) && Math.abs(value) <= 10_000);
  return finite(edit.position) && finite(edit.normal) && Number.isFinite(edit.rotation) && Math.abs(edit.rotation) <= 100
    && edit.size >= DECAL_SIZE.min && edit.size <= DECAL_SIZE.max && edit.aspect >= 0.05 && edit.aspect <= 20
    && (!edit.color || /^#[0-9a-f]{6}$/i.test(edit.color))
    && (!edit.image || (edit.image.length <= MAX_DECAL_IMAGE_CHARS && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(edit.image)));
}

export function upsertDecal(doc: SceneDocument, key: string, edit: DecalEdit): SceneDocument {
  if (!validDecal(edit)) throw Error("ATELIER_DECAL_VALUE");
  if (!doc.decals?.[key] && Object.keys(doc.decals ?? {}).length >= MAX_DECALS) throw Error("ATELIER_DECAL_LIMIT");
  return { ...doc, decals: { ...doc.decals, [key]: edit } };
}

/** Remove a edição: logo novo some; estampa do arquivo volta ao original. */
export function removeDecal(doc: SceneDocument, key: string): SceneDocument {
  const decals = { ...doc.decals };
  delete decals[key];
  return { ...doc, decals };
}
