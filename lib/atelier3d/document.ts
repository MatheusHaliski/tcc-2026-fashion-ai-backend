import * as THREE from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
export type Vec3 = [number, number, number];
export interface NodeEdit {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  visible: boolean;
}
export interface MaterialEdit {
  color: string;
  roughness: number;
  metalness: number;
  repeat: [number, number];
  rotation: number;
}
export interface SceneDocument {
  nodes: Record<string, NodeEdit>;
  materials: Record<string, MaterialEdit>;
  vertices: Record<string, Record<string, Vec3>>;
}
export interface Inspection {
  nodes: number;
  meshes: number;
  materials: number;
  vertices: number;
  skinned: boolean;
  morphs: boolean;
  animated: boolean;
  primitives: Record<string, number>;
  extensions: string[];
}
export interface LoadedAsset {
  gltf: GLTF;
  nodes: Map<string, THREE.Object3D>;
  primitives: Map<string, THREE.Mesh>;
  baseline: SceneDocument;
  originalPositions: Map<string, Float32Array>;
  originalNormals: Map<string, Float32Array>;
  appliedVertices: Map<string, Record<string, Vec3> | undefined>;
  textureTransforms: Map<
    THREE.Texture,
    { repeat: THREE.Vector2; rotation: number }
  >;
}
export const EMPTY_DOCUMENT: SceneDocument = {
  nodes: {},
  materials: {},
  vertices: {},
};
export const MAX_GLB_BYTES = 8 * 1024 * 1024;
const EXTENSIONS = new Set([
  "KHR_materials_unlit",
  "KHR_texture_transform",
  "KHR_materials_clearcoat",
  "KHR_materials_transmission",
  "KHR_materials_ior",
  "KHR_materials_sheen",
  "KHR_materials_specular",
  "KHR_materials_volume",
  "KHR_materials_iridescence",
  "KHR_materials_anisotropy",
]);
/** Inspect before GLTFLoader can resolve any resource. Server repeats the inspection. */
export function inspectGlb(buffer: ArrayBuffer) {
  if (buffer.byteLength < 20 || buffer.byteLength > MAX_GLB_BYTES)
    throw Error("ATELIER_GLB_SIZE");
  const view = new DataView(buffer);
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== buffer.byteLength
  )
    throw Error("ATELIER_GLB_HEADER");
  const length = view.getUint32(12, true);
  if (
    view.getUint32(16, true) !== 0x4e4f534a ||
    length > 2 * 1024 * 1024 ||
    20 + length > buffer.byteLength
  )
    throw Error("ATELIER_GLB_JSON");
  const root = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, 20, length)).trim(),
  );
  if (
    root.scenes?.length !== 1 ||
    root.nodes?.length > 2000 ||
    root.asset?.version !== "2.0" ||
    root.buffers?.length !== 1 ||
    root.buffers.some((b: { uri?: string }) => b.uri !== undefined) ||
    root.images?.some(
      (i: { uri?: string; bufferView?: number }) =>
        i.uri !== undefined || i.bufferView === undefined,
    )
  )
    throw Error("ATELIER_GLB_EXTERNAL");
  for (const ext of [
    ...(root.extensionsUsed ?? []),
    ...(root.extensionsRequired ?? []),
  ])
    if (!EXTENSIONS.has(ext)) throw Error("ATELIER_GLB_EXTENSION");
  return root;
}
export async function loadGlb(buffer: ArrayBuffer): Promise<LoadedAsset> {
  inspectGlb(buffer);
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (!url.startsWith("blob:") && !url.startsWith("data:"))
      throw Error("ATELIER_GLB_EXTERNAL");
    return url;
  });
  const gltf = await new GLTFLoader(manager).parseAsync(buffer, "");
  const textureTransforms = new Map<
    THREE.Texture,
    { repeat: THREE.Vector2; rotation: number }
  >();
  const nodes = new Map<string, THREE.Object3D>(),
    primitives = new Map<string, THREE.Mesh>(),
    originalPositions = new Map<string, Float32Array>(),
    originalNormals = new Map<string, Float32Array>();
  gltf.scene.traverse((object) => {
    const a = gltf.parser.associations.get(object);
    if (a?.nodes !== undefined) {
      const key = `n${a.nodes}`;
      if (!(object instanceof THREE.Bone)) nodes.set(key, object);
      object.userData.atelierNodeKey = key;
    }
  });
  gltf.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    let owner: THREE.Object3D | null = mesh;
    while (owner && !owner.userData.atelierNodeKey) owner = owner.parent;
    if (!owner) return;
    const a = gltf.parser.associations.get(mesh),
      key = `${owner.userData.atelierNodeKey}.p${a?.primitives ?? 0}`;
    primitives.set(key, mesh);
    mesh.userData.atelierPrimitiveKey = key;
    mesh.geometry = mesh.geometry.clone();
    const position = mesh.geometry.getAttribute("position");
    originalPositions.set(
      key,
      Float32Array.from(
        Array.from({ length: position.count }, (_, i) => [
          position.getX(i),
          position.getY(i),
          position.getZ(i),
        ]).flat(),
      ),
    );
    const normal = mesh.geometry.getAttribute("normal");
    if (normal)
      originalNormals.set(
        key,
        Float32Array.from(
          Array.from({ length: normal.count }, (_, i) => [
            normal.getX(i),
            normal.getY(i),
            normal.getZ(i),
          ]).flat(),
        ),
      );
    // Each glTF primitive owns a material; clone to avoid editing other instances.
    const material = Array.isArray(mesh.material)
      ? mesh.material[0]
      : mesh.material;
    mesh.material = material.clone();
    const mat = mesh.material as THREE.MeshStandardMaterial;
    for (const [field, value] of Object.entries(mat))
      if (value instanceof THREE.Texture) {
        const texture = value.clone();
        Object.assign(mat, { [field]: texture });
        textureTransforms.set(texture, {
          repeat: texture.repeat.clone(),
          rotation: texture.rotation,
        });
      }
  });
  const baseline: SceneDocument = { nodes: {}, materials: {}, vertices: {} };
  for (const [key, node] of nodes)
    baseline.nodes[key] = {
      position: node.position.toArray() as Vec3,
      rotation: [node.rotation.x, node.rotation.y, node.rotation.z],
      scale: node.scale.toArray() as Vec3,
      visible: node.visible,
    };
  for (const [key, mesh] of primitives) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    baseline.materials[key] = {
      color: "#" + mat.color.getHexString(),
      roughness: mat.roughness ?? 1,
      metalness: mat.metalness ?? 0,
      repeat: [mat.map?.repeat.x ?? 1, mat.map?.repeat.y ?? 1],
      rotation: mat.map?.rotation ?? 0,
    };
  }
  return {
    gltf,
    nodes,
    primitives,
    baseline,
    originalPositions,
    originalNormals,
    appliedVertices: new Map(),
    textureTransforms,
  };
}
export function applyDocument(asset: LoadedAsset, doc: SceneDocument) {
  for (const [key, node] of asset.nodes) {
    const value = doc.nodes[key] ?? asset.baseline.nodes[key];
    if (!value) continue;
    node.position.fromArray(value.position);
    node.rotation.set(...value.rotation);
    node.scale.fromArray(value.scale);
    node.visible = value.visible;
    node.updateMatrixWorld(true);
  }
  for (const [key, mesh] of asset.primitives) {
    const value = doc.materials[key] ?? asset.baseline.materials[key];
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (value) {
      mat.color.set(value.color);
      mat.roughness = value.roughness;
      mat.metalness = value.metalness;
      const baseMaterial = asset.baseline.materials[key];
      for (const texture of Object.values(mat)) {
        if (!(texture instanceof THREE.Texture)) continue;
        const original = asset.textureTransforms.get(texture);
        if (original) {
          texture.repeat.set(
            (original.repeat.x * value.repeat[0]) / baseMaterial.repeat[0],
            (original.repeat.y * value.repeat[1]) / baseMaterial.repeat[1],
          );
          texture.rotation =
            original.rotation + value.rotation - baseMaterial.rotation;
          texture.updateMatrix();
        }
      }
    }
    if (asset.appliedVertices.get(key) === doc.vertices[key]) continue;
    asset.appliedVertices.set(key, doc.vertices[key]);
    const normal = mesh.geometry.getAttribute("normal"),
      baseNormal = asset.originalNormals.get(key);
    if (normal && baseNormal) {
      for (let i = 0; i < normal.count; i++)
        normal.setXYZ(
          i,
          baseNormal[i * 3],
          baseNormal[i * 3 + 1],
          baseNormal[i * 3 + 2],
        );
      normal.needsUpdate = true;
    }
    const base = asset.originalPositions.get(key),
      position = mesh.geometry.getAttribute("position");
    if (base) {
      for (let i = 0; i < position.count; i++)
        position.setXYZ(i, base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
      for (const [index, point] of Object.entries(doc.vertices[key] ?? {}))
        position.setXYZ(Number(index), ...point);
      position.needsUpdate = true;
      if (Object.keys(doc.vertices[key] ?? {}).length)
        mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingBox();
      mesh.geometry.computeBoundingSphere();
    }
  }
  asset.gltf.scene.updateMatrixWorld(true);
}
export async function exportGlb(
  asset: LoadedAsset,
  document: SceneDocument,
): Promise<ArrayBuffer> {
  applyDocument(asset, document);
  const internal = new Map<THREE.Object3D, Record<string, unknown>>();
  asset.gltf.scene.traverse((object) => {
    internal.set(object, object.userData);
    const {
      atelierNodeKey: _node,
      atelierPrimitiveKey: _primitive,
      ...publicData
    } = object.userData;
    object.userData = publicData;
  });
  let result;
  try {
    result = await new GLTFExporter().parseAsync(asset.gltf.scene, {
      binary: true,
      onlyVisible: false,
      animations: asset.gltf.animations,
    });
  } finally {
    for (const [object, data] of internal) object.userData = data;
  }
  if (!(result instanceof ArrayBuffer)) throw Error("ATELIER_EXPORT_INVALID");
  inspectGlb(result);
  return result;
}
export function disposeAsset(asset: LoadedAsset) {
  const textures = new Set<THREE.Texture>();
  asset.gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      for (const value of Object.values(mat))
        if (value instanceof THREE.Texture) textures.add(value);
      mat.dispose();
    }
  });
  textures.forEach((t) => t.dispose());
}
export function updateNode(
  document: SceneDocument,
  key: string,
  value: Partial<NodeEdit>,
  baseline: SceneDocument,
): SceneDocument {
  return {
    ...document,
    nodes: {
      ...document.nodes,
      [key]: { ...baseline.nodes[key], ...document.nodes[key], ...value },
    },
  };
}
export function updateMaterial(
  document: SceneDocument,
  key: string,
  value: Partial<MaterialEdit>,
  baseline: SceneDocument,
): SceneDocument {
  return {
    ...document,
    materials: {
      ...document.materials,
      [key]: {
        ...baseline.materials[key],
        ...document.materials[key],
        ...value,
      },
    },
  };
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
