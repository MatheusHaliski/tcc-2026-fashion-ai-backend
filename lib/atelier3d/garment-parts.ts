import type * as THREE from "three";
import type { LoadedAsset } from "./document";

/**
 * Papéis dos materiais do motor de peças (services/garment_blender): a malha é uma só e cada primitiva tem um material
 * nomeado pelo papel. O editor seleciona por papel — é assim que a pessoa troca a cor do tecido, da costura, do zíper.
 */
export type PartRole =
  | "corpo" | "ribana" | "linha" | "dentes" | "cadarco" | "botao" | "furo" | "estampa"
  | "faixa_barra" | "faixa_manga" | "faixa_vista" | "cos";

export interface GarmentPart {
  /** Chave da primitiva no documento ("n0.p2"). */
  key: string;
  node: string;
  role: PartRole | null;
  /** Número para papéis repetidos (estampa_0, faixa_manga_1): começa em 1 no texto mostrado. */
  index: number | null;
  materialName: string;
}

const ROLES: PartRole[] = ["corpo", "ribana", "linha", "dentes", "cadarco", "botao", "furo", "faixa_barra", "faixa_vista", "cos"];
const NUMBERED: PartRole[] = ["estampa", "faixa_manga"];
/** Onde um decalque pode ser projetado: tecido, nunca aviamento nem outra estampa. */
const CLOTH: PartRole[] = ["corpo", "ribana", "faixa_barra", "faixa_manga", "faixa_vista", "cos"];

export function partRole(materialName: string | undefined): { role: PartRole | null; index: number | null } {
  // o exportador e o three acrescentam sufixos a nomes repetidos ("corpo_1", "corpo.001")
  const name = (materialName ?? "").trim().toLowerCase();
  for (const role of NUMBERED) {
    const match = name.match(new RegExp(`^${role}_(\\d+)$`));
    if (match) return { role, index: Number(match[1]) };
  }
  for (const role of ROLES) if (name === role) return { role, index: null };
  return { role: null, index: null };
}

export function nodeOf(selection: string): string {
  return selection.split(".")[0];
}

export function isPrimitiveKey(selection: string): boolean {
  return /^n\d+\.p\d+$/.test(selection);
}

function materialName(mesh: THREE.Mesh): string {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return material?.name ?? "";
}

export function listParts(asset: LoadedAsset): GarmentPart[] {
  return [...asset.primitives].map(([key, mesh]) => {
    const name = materialName(mesh);
    return { key, node: nodeOf(key), materialName: name, ...partRole(name) };
  });
}

/** GLB do motor de peças: tem o material "corpo". Só nele COLOR_0 é rótulo de parte, não cor. */
export function isEngineGarment(asset: LoadedAsset): boolean {
  return listParts(asset).some((part) => part.role === "corpo");
}

/** Primitivas de tecido do objeto (onde decalques aderem). Em GLB sem papéis, todas as do objeto servem. */
export function clothParts(asset: LoadedAsset, node: string): string[] {
  const parts = listParts(asset).filter((part) => part.node === node);
  const cloth = parts.filter((part) => part.role && CLOTH.includes(part.role));
  return (cloth.length ? cloth : parts.filter((part) => part.role !== "estampa")).map((part) => part.key);
}

/** Primitiva escolhida: a selecionada, ou a primeira do objeto selecionado (comportamento anterior do inspetor). */
export function selectedPrimitive(asset: LoadedAsset, selection: string): string | undefined {
  if (asset.primitives.has(selection)) return selection;
  const node = nodeOf(selection);
  for (const [key, mesh] of asset.primitives) {
    let owner: THREE.Object3D | null = mesh;
    while (owner) {
      if (owner === asset.nodes.get(node)) return key;
      owner = owner.parent;
    }
  }
  return undefined;
}

/** O que um clique na peça seleciona: a parte (material) quando o objeto tem várias, senão o objeto. */
export function pickKey(asset: LoadedAsset, object: THREE.Object3D): string | null {
  let owner: THREE.Object3D | null = object;
  while (owner && !owner.userData.atelierNodeKey) owner = owner.parent;
  if (!owner) return null;
  const node: string = owner.userData.atelierNodeKey;
  const primitive: string | undefined = object.userData.atelierPrimitiveKey;
  const siblings = [...asset.primitives.keys()].filter((key) => nodeOf(key) === node).length;
  return primitive && siblings > 1 ? primitive : node;
}

/**
 * "Relevo da foto" (RF16, plano B local): um bloco com a foto colada, sem partes de peça. Não é um GLB próprio da
 * peça e por isso não é editável. Reconhecido pelo que o gerador grava no arquivo, em qualquer idioma do servidor.
 */
export function isPhotoRelief(root: { asset?: { generator?: string }; materials?: { name?: string }[]; meshes?: unknown[] } | undefined): boolean {
  if (!root) return false;
  const generator = (root.asset?.generator ?? "").toLowerCase();
  if (generator.includes("rf16") && /relevo|relief|relieve/.test(generator)) return true;
  return root.meshes?.length === 1 && root.materials?.length === 1 && root.materials[0].name === "foto-da-peca";
}

export function assetIsPhotoRelief(asset: LoadedAsset | null | undefined): boolean {
  return !!asset && isPhotoRelief((asset.gltf.parser as unknown as { json?: Parameters<typeof isPhotoRelief>[0] } | undefined)?.json);
}
