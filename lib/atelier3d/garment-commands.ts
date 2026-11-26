import { storePoints } from "./commands";
import { meshPoints, requireStaticAsset } from "./command-geometry";
import { updateMaterial, updateNode, type LoadedAsset, type SceneDocument, type Vec3 } from "./document";
import { hasColorTexture } from "./garment-materials";
import { nodeOf } from "./garment-parts";

/** Comandos de peça: produzem edições comuns do documento (histórico, salvar e exportar seguem o caminho de sempre). */
export const SIZE_RANGE = { min: 0.5, max: 1.5 };
export const HEM_RANGE = { min: -0.3, max: 0.3 };
/** Fração da altura do corpo, a partir da barra, que estica ou encolhe junto com ela. */
const HEM_ZONE = 0.3;

/** Cor de uma parte: recolore a textura quando a cor está nela (tecido do motor); senão troca a cor do material. */
export function setPartColor(asset: LoadedAsset, doc: SceneDocument, key: string, color: string): SceneDocument {
  if (!asset.primitives.has(key) || !/^#[0-9a-f]{6}$/i.test(color)) throw Error("ATELIER_COMMAND_VALUE");
  return updateMaterial(doc, key, hasColorTexture(asset, key) ? { tint: color } : { color }, asset.baseline);
}

export function setPartHidden(asset: LoadedAsset, doc: SceneDocument, key: string, hidden: boolean): SceneDocument {
  if (!asset.primitives.has(key)) throw Error("ATELIER_COMMAND_TARGET");
  return updateMaterial(doc, key, { hidden }, asset.baseline);
}

/** Tamanho visual: escala do objeto por eixo (largura X, comprimento Y, profundidade Z), em relação ao arquivo. */
export function setGarmentSize(asset: LoadedAsset, doc: SceneDocument, node: string, factor: Vec3): SceneDocument {
  const baseline = asset.baseline.nodes[node];
  if (!baseline) throw Error("ATELIER_COMMAND_TARGET");
  if (factor.some((value) => !Number.isFinite(value) || value < SIZE_RANGE.min || value > SIZE_RANGE.max)) throw Error("ATELIER_COMMAND_VALUE");
  return updateNode(doc, node, { scale: factor.map((value, axis) => baseline.scale[axis] * value) as Vec3 }, asset.baseline);
}

export function garmentSize(asset: LoadedAsset, doc: SceneDocument, node: string): Vec3 {
  const baseline = asset.baseline.nodes[node], current = doc.nodes[node] ?? baseline;
  return (baseline ? current.scale.map((value, axis) => value / baseline.scale[axis]) : [1, 1, 1]) as Vec3;
}

interface HemRegion {
  centerX: number;
  bottom: number;
  top: number;
  /** Rótulo de parte (COLOR_0 do motor) do corpo; null quando o arquivo não rotula. */
  bodyLabel: number | null;
  halfWidth: number;
}

function label(asset: LoadedAsset, key: string, index: number): number | null {
  const color = asset.primitives.get(key)?.geometry.getAttribute("color");
  return color ? Math.round(color.getX(index) * 100) : null;
}

/** Onde fica a barra: a faixa de baixo do corpo. Mangas (outro rótulo, ou fora da largura do corpo) não esticam. */
function hemRegion(asset: LoadedAsset, keys: string[]): HemRegion {
  let minX = Infinity, maxX = -Infinity, bottom = Infinity, top = -Infinity;
  const each = (visit: (key: string, index: number, x: number, y: number) => void) => {
    for (const key of keys) {
      const original = asset.originalPositions.get(key)!;
      for (let i = 0; i < original.length / 3; i++) visit(key, i, original[i * 3], original[i * 3 + 1]);
    }
  };
  each((_, __, x, y) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    bottom = Math.min(bottom, y);
    top = Math.max(top, y);
  });
  const centerX = (minX + maxX) / 2, width = maxX - minX;
  const votes = new Map<number, number>();
  each((key, index, x) => {
    const value = label(asset, key, index);
    if (value !== null && Math.abs(x - centerX) < width * 0.1) votes.set(value, (votes.get(value) ?? 0) + 1);
  });
  const labels = new Set<number>();
  each((key, index) => {
    const value = label(asset, key, index);
    if (value !== null) labels.add(value);
  });
  const bodyLabel = labels.size > 1 ? [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null : null;
  const cut = bottom + (top - bottom) * HEM_ZONE;
  let halfWidth = bodyLabel === null ? width : 0;
  if (bodyLabel !== null)
    each((key, index, x, y) => {
      if (y < cut && label(asset, key, index) === bodyLabel) halfWidth = Math.max(halfWidth, Math.abs(x - centerX));
    });
  return { centerX, bottom, top: cut, bodyLabel, halfWidth };
}

/** Uma primitiva "sabe" o que é manga quando tem mais de um rótulo; costura e aviamento vão pela largura do corpo. */
function labelled(asset: LoadedAsset, key: string, count: number): boolean {
  const first = label(asset, key, 0);
  for (let i = 1; i < count; i++) if (label(asset, key, i) !== first) return true;
  return false;
}

/**
 * Comprimento da barra: desce (delta > 0) ou sobe a barra em `delta` unidades do arquivo. A faixa de baixo do corpo
 * estica proporcionalmente e tudo o que está na barra (ribana, faixa, costura) acompanha inteiro. Não simula tecido.
 */
export function changeHemLength(asset: LoadedAsset, doc: SceneDocument, selection: string, delta: number): SceneDocument {
  const node = nodeOf(selection);
  if (!Number.isFinite(delta) || delta < HEM_RANGE.min || delta > HEM_RANGE.max) throw Error("ATELIER_COMMAND_VALUE");
  requireStaticAsset(asset);
  const keys = [...asset.primitives.keys()].filter((key) => nodeOf(key) === node && asset.originalPositions.has(key));
  if (!keys.length) throw Error("ATELIER_COMMAND_TARGET");
  const region = hemRegion(asset, keys);
  if (region.top - region.bottom <= 1e-6) throw Error("ATELIER_COMMAND_VALUE");
  let next = doc;
  for (const key of keys) {
    const original = asset.originalPositions.get(key)!, points = meshPoints(asset, doc, key);
    const byLabel = region.bodyLabel !== null && labelled(asset, key, points.length);
    for (let i = 0; i < points.length; i++) {
      const x = original[i * 3], y = original[i * 3 + 1];
      const body = byLabel ? label(asset, key, i) === region.bodyLabel : Math.abs(x - region.centerX) <= region.halfWidth * 1.03;
      if (!body || y >= region.top) continue;
      const weight = Math.min(1, (region.top - y) / (region.top - region.bottom));
      points[i] = [points[i][0], points[i][1] - delta * weight, points[i][2]];
    }
    next = storePoints(asset, next, key, points);
  }
  return next;
}
