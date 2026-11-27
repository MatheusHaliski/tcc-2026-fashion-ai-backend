import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { LoadedAsset, SceneDocument } from "./document";
import { decalBasis, type DecalEdit } from "./decals";
import { clothParts, listParts } from "./garment-parts";
import { originalMap } from "./garment-materials";
import { tintedTexture } from "./texture-tint";

/** Malhas dos decalques do documento: refeitas quando o decalque ou a malha do tecido mudam; nunca vão ao documento. */
interface DecalState {
  edit: DecalEdit;
  cloth: unknown;
  mesh: THREE.Mesh;
  textureKey: string;
  ready: Promise<void>;
}
const states = new WeakMap<LoadedAsset, Map<string, DecalState>>();
/** Afastamento do tecido (1 mm no GLB do motor) para o decalque não disputar profundidade com a malha. */
const LIFT = 0.001;

export type DecalImageLoader = (source: string) => Promise<CanvasImageSource & { width: number; height: number }>;
let loadImage: DecalImageLoader = (source) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(Error("ATELIER_DECAL_IMAGE"));
    image.src = source;
  });
/** Testes trocam o carregador de imagem (jsdom não decodifica imagens). */
export function setDecalImageLoader(loader: DecalImageLoader) {
  loadImage = loader;
}

function buildGeometry(asset: LoadedAsset, edit: DecalEdit): THREE.BufferGeometry | null {
  const owner = asset.nodes.get(edit.node);
  if (!owner) return null;
  const { x, y, z } = decalBasis(edit.normal, edit.rotation);
  const orientation = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  const height = edit.size * edit.aspect;
  const size = new THREE.Vector3(edit.size, height, THREE.MathUtils.clamp(Math.max(edit.size, height) * 0.6, 0.04, 0.12));
  const pieces: THREE.BufferGeometry[] = [];
  for (const key of clothParts(asset, edit.node)) {
    const source = asset.primitives.get(key);
    if (!source?.geometry.getAttribute("normal")) continue;
    const proxy = new THREE.Mesh(source.geometry);
    if (source !== owner) proxy.matrixWorld.copy(source.matrix);
    const piece = new DecalGeometry(proxy, new THREE.Vector3(...edit.position), orientation, size);
    if (piece.getAttribute("position")?.count) pieces.push(piece);
    else piece.dispose();
  }
  if (!pieces.length) return null;
  const geometry = pieces.length === 1 ? pieces[0] : mergeGeometries(pieces);
  if (pieces.length > 1) pieces.forEach((piece) => piece.dispose());
  const position = geometry.getAttribute("position"), normal = geometry.getAttribute("normal"), uv = geometry.getAttribute("uv");
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(i, position.getX(i) + normal.getX(i) * LIFT, position.getY(i) + normal.getY(i) * LIFT, position.getZ(i) + normal.getZ(i) * LIFT);
    uv.setY(i, 1 - uv.getY(i)); // texturas do editor usam flipY=false, como as do glTF
  }
  return geometry;
}

function printName(asset: LoadedAsset, key: string, edit: DecalEdit): string {
  const target = edit.target ? asset.primitives.get(edit.target) : undefined;
  if (target) return (target.material as THREE.Material).name;
  const used = listParts(asset).filter((part) => part.role === "estampa").map((part) => part.index ?? 0);
  return `estampa_${Math.max(-1, ...used) + Number(key.replace(/\D/g, "") || 1)}`;
}

async function resolveTexture(asset: LoadedAsset, edit: DecalEdit): Promise<THREE.Texture | null> {
  let base: THREE.Texture | null = null, owned = false;
  if (edit.image) {
    base = new THREE.Texture(await loadImage(edit.image));
    base.flipY = false;
    base.colorSpace = THREE.SRGBColorSpace;
    base.needsUpdate = true;
    owned = true;
  } else if (edit.target) {
    const source = originalMap(asset, edit.target);
    base = source ? source.clone() : null;
    if (base) base.needsUpdate = true;
    owned = true;
  }
  if (!base || !edit.color) return base;
  const tinted = tintedTexture(base, edit.color);
  if (tinted && owned) base.dispose();
  return tinted ?? base;
}

function remove(state: DecalState) {
  state.mesh.removeFromParent();
  state.mesh.geometry.dispose();
  const material = state.mesh.material as THREE.MeshStandardMaterial;
  material.map?.dispose();
  material.dispose();
}

/** Sincroniza as malhas com `doc.decals`; devolve as estampas do arquivo que um decalque substituiu (ficam ocultas). */
export function applyDecals(asset: LoadedAsset, doc: SceneDocument): Set<string> {
  let current = states.get(asset);
  if (!current) states.set(asset, (current = new Map()));
  const decals = doc.decals ?? {}, replaced = new Set<string>();
  for (const [key, state] of current)
    if (!decals[key]) {
      remove(state);
      current.delete(key);
    }
  for (const [key, edit] of Object.entries(decals)) {
    if (edit.target && asset.primitives.has(edit.target)) replaced.add(edit.target);
    const cloth = clothParts(asset, edit.node).map((part) => doc.vertices[part]).find(Boolean) ?? null;
    const previous = current.get(key);
    if (previous?.edit === edit && previous.cloth === cloth) continue;
    const textureKey = `${edit.image ?? ""}|${edit.target ?? ""}|${edit.color ?? ""}`;
    const geometry = edit.visible ? buildGeometry(asset, edit) : null;
    if (previous && geometry && previous.textureKey === textureKey) {
      previous.mesh.geometry.dispose();
      previous.mesh.geometry = geometry;
      previous.mesh.visible = true;
      Object.assign(previous, { edit, cloth });
      continue;
    }
    if (previous) remove(previous);
    current.delete(key);
    const owner = asset.nodes.get(edit.node);
    if (!geometry || !owner) continue;
    const material = new THREE.MeshStandardMaterial({ alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.65, metalness: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    material.name = printName(asset, key, edit);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `logo-${key}`;
    mesh.visible = false; // só aparece com a imagem pronta: sem ela seria um retângulo branco
    owner.add(mesh);
    const state: DecalState = { edit, cloth, mesh, textureKey, ready: Promise.resolve() };
    state.ready = resolveTexture(asset, edit).then((texture) => {
      if (current!.get(key) !== state) return texture?.dispose();
      material.map = texture;
      material.needsUpdate = true;
      mesh.visible = !!texture;
    }).catch(() => undefined);
    current.set(key, state);
  }
  return replaced;
}

/** Espera as imagens dos decalques (exportar antes disso geraria logos sem textura). */
export async function decalsReady(asset: LoadedAsset): Promise<void> {
  await Promise.all([...(states.get(asset)?.values() ?? [])].map((state) => state.ready));
}
