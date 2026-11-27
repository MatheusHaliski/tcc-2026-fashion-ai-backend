import type { SceneDocument, Vec3 } from "../document";

/**
 * Edições de roupa guardadas no próprio documento da cena (seção opcional `garment`): o histórico
 * (desfazer/refazer), o salvamento da versão e a exportação do GLB reaproveitam o pipeline existente.
 * Tudo é serializável e limitado para caber no teto de 2 MB do documento salvo pelo servidor.
 */
export const FABRIC_PRESETS = ["cotton", "denim", "leather", "silk", "wool", "linen", "velvet", "sport", "sequin"] as const;
export type FabricPreset = (typeof FABRIC_PRESETS)[number];
export const WEAVES = ["plain", "twill", "knit", "grain", "satin", "pile", "mesh", "scale"] as const;
export type WeaveKind = (typeof WEAVES)[number];
export const PATTERNS = ["stripes", "plaid", "polka", "camo"] as const;
export type PatternKind = (typeof PATTERNS)[number];
export type UV = [number, number];

export interface FabricEdit {
  preset: FabricPreset;
  sheen: number;
  sheenColor: string;
  sheenRoughness: number;
  clearcoat: number;
  transmission: number;
  weave: WeaveKind;
  weaveScale: number;
  normalStrength: number;
}
export type PaintOp =
  | { kind: "stroke"; color: string; size: number; opacity: number; hardness: number; erase: boolean; points: UV[] }
  | { kind: "fill"; color: string; opacity: number };
export interface PaintLayer {
  id: string;
  visible: boolean;
  opacity: number;
  ops: PaintOp[];
}
export type PatternSource =
  | { kind: "procedural"; pattern: PatternKind; colors: [string, string, string] }
  | { kind: "image"; image: string };
export interface PatternFill {
  source: PatternSource;
  scale: number;
  rotation: number;
  opacity: number;
}
export interface Decal {
  id: string;
  primitive: string;
  image: string;
  position: Vec3;
  normal: Vec3;
  size: number;
  rotation: number;
  opacity: number;
}
export interface Stitch {
  id: string;
  primitive: string;
  loop: number;
  offset: number;
  color: string;
  dash: number;
  width: number;
}
export type AccessoryKind = "button" | "rivet";
export interface Accessory {
  id: string;
  primitive: string;
  kind: AccessoryKind;
  position: Vec3;
  normal: Vec3;
  size: number;
  color: string;
}
export interface GarmentState {
  fabrics: Record<string, FabricEdit>;
  layers: Record<string, PaintLayer[]>;
  patterns: Record<string, PatternFill>;
  decals: Decal[];
  images: Record<string, string>;
  stitches: Stitch[];
  accessories: Accessory[];
}

export const GARMENT_LIMITS = {
  layers: 6,
  ops: 400,
  points: 600,
  decals: 12,
  images: 4,
  imageChars: 360_000,
  stitches: 24,
  accessories: 48,
};
export const EMPTY_GARMENT: GarmentState = {
  fabrics: {}, layers: {}, patterns: {}, decals: [], images: {}, stitches: [], accessories: [],
};

export function garmentOf(doc: SceneDocument): GarmentState {
  return { ...EMPTY_GARMENT, ...(doc.garment ?? {}) };
}

/** Grava a seção de roupa; sem nenhuma edição, a seção some e o documento fica idêntico ao legado. */
export function withGarment(doc: SceneDocument, change: (garment: GarmentState) => Partial<GarmentState>): SceneDocument {
  const next = { ...garmentOf(doc), ...change(garmentOf(doc)) };
  const empty = !Object.keys(next.fabrics).length && !Object.keys(next.layers).length && !Object.keys(next.patterns).length
    && !next.decals.length && !next.stitches.length && !next.accessories.length;
  if (empty) {
    const rest = { ...doc };
    delete rest.garment;
    return rest;
  }
  return { ...doc, garment: pruneImages(next) };
}

/** Imagens sem uso (decalque ou padrão) não ficam no documento salvo. */
function pruneImages(garment: GarmentState): GarmentState {
  const used = new Set([
    ...garment.decals.map((d) => d.image),
    ...Object.values(garment.patterns).flatMap((p) => (p.source.kind === "image" ? [p.source.image] : [])),
  ]);
  const images = Object.fromEntries(Object.entries(garment.images).filter(([id]) => used.has(id)));
  return { ...garment, images };
}

export function setRecord<T>(record: Record<string, T>, key: string, value: T | undefined): Record<string, T> {
  const next = { ...record };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

let counter = 0;
export function garmentId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}
