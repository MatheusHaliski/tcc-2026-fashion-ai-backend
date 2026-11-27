import { blendAt, blendOver, clonePixels, createPixels, hexToRgb, strokeMask, type Pixels } from "./raster";
import { clamp, garmentId, GARMENT_LIMITS, isHexColor, setRecord, withGarment, type PaintLayer, type PaintOp, type UV } from "./state";
import type { SceneDocument } from "../document";

/** Aplica uma operação de pintura sobre a camada (pixels transparentes = sem tinta). */
export function renderOp(target: Pixels, op: PaintOp) {
  const [r, g, b] = hexToRgb(op.color);
  if (op.kind === "fill") {
    for (let i = 0; i < target.data.length; i += 4) blendAt(target.data, i, r, g, b, op.opacity);
    return;
  }
  const radius = Math.max(0.5, (op.size / 2) * (target.width / 1024));
  const stroke = strokeMask(target.width, target.height, op.points, radius, op.hardness);
  if (!stroke) return;
  const { x0, y0, w, h, mask } = stroke;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const cover = mask[y * w + x] * op.opacity;
      if (cover <= 0) continue;
      const i = ((y + y0) * target.width + x + x0) * 4;
      if (op.erase) target.data[i + 3] *= 1 - cover;
      else blendAt(target.data, i, r, g, b, cover);
    }
}

export type LayerCache = Map<string, { ops: PaintOp[]; pixels: Pixels }>;

/**
 * Pixels da camada. As operações já confirmadas ficam em cache e só a última (o traço em andamento,
 * que muda a cada movimento do ponteiro) é redesenhada: o pincel acompanha o mouse sem refazer a pilha.
 */
export function layerPixels(layer: PaintLayer, size: number, cache: LayerCache): Pixels {
  const committed = layer.ops.slice(0, -1);
  let entry = cache.get(layer.id);
  const prefix = entry && entry.pixels.width === size && entry.ops.length <= committed.length
    && entry.ops.every((op, i) => op === committed[i]);
  if (!entry || !prefix) {
    entry = { ops: [], pixels: createPixels(size, size) };
    cache.set(layer.id, entry);
  }
  for (const op of committed.slice(entry.ops.length)) renderOp(entry.pixels, op);
  entry.ops = committed;
  const out = clonePixels(entry.pixels);
  const last = layer.ops.at(-1);
  if (last) renderOp(out, last);
  return out;
}

/** Empilha as camadas visíveis sobre a superfície, com a opacidade de cada camada. */
export function composeLayers(target: Pixels, layers: PaintLayer[], cache: LayerCache) {
  for (const layer of layers) if (layer.visible) blendOver(target, layerPixels(layer, target.width, cache), layer.opacity);
  for (const id of [...cache.keys()]) if (!layers.some((layer) => layer.id === id)) cache.delete(id);
}

function sanitizeOp(op: PaintOp): PaintOp {
  if (!isHexColor(op.color)) throw Error("ATELIER_PAINT_VALUE");
  if (op.kind === "fill") return { kind: "fill", color: op.color, opacity: clamp(op.opacity, 0, 1) };
  const points = op.points.slice(0, GARMENT_LIMITS.points)
    .filter((p) => p.every(Number.isFinite))
    .map(([u, v]) => [Math.round(clamp(u, 0, 1) * 1e4) / 1e4, Math.round(clamp(v, 0, 1) * 1e4) / 1e4] as UV);
  if (!points.length) throw Error("ATELIER_PAINT_VALUE");
  return {
    kind: "stroke", color: op.color, size: clamp(op.size, 1, 256), opacity: clamp(op.opacity, 0, 1),
    hardness: clamp(op.hardness, 0, 1), erase: !!op.erase, points,
  };
}

export function newLayer(): PaintLayer {
  return { id: garmentId("l"), visible: true, opacity: 1, ops: [] };
}

/** Acrescenta (ou cria) a camada alvo e a operação; nunca passa dos limites do documento. */
export function addPaintOp(doc: SceneDocument, primitive: string, layerId: string | null, op: PaintOp): SceneDocument {
  const clean = sanitizeOp(op);
  return withGarment(doc, (garment) => {
    const layers = garment.layers[primitive] ?? [];
    let target = layers.find((layer) => layer.id === layerId) ?? layers.at(-1);
    const list = target ? layers : [...layers, (target = newLayer())];
    if (target.ops.length >= GARMENT_LIMITS.ops) throw Error("ATELIER_COMMAND_LIMIT");
    const id = target.id;
    return { layers: setRecord(garment.layers, primitive, list.map((layer) => layer.id === id ? { ...layer, ops: [...layer.ops, clean] } : layer)) };
  });
}

export function addLayer(doc: SceneDocument, primitive: string): SceneDocument {
  return withGarment(doc, (garment) => {
    const layers = garment.layers[primitive] ?? [];
    if (layers.length >= GARMENT_LIMITS.layers) throw Error("ATELIER_COMMAND_LIMIT");
    return { layers: setRecord(garment.layers, primitive, [...layers, newLayer()]) };
  });
}

export function updateLayer(doc: SceneDocument, primitive: string, id: string, change: Partial<Pick<PaintLayer, "visible" | "opacity">> | null): SceneDocument {
  return withGarment(doc, (garment) => {
    const layers = (garment.layers[primitive] ?? []).flatMap((layer) => layer.id !== id ? [layer]
      : change === null ? [] : [{ ...layer, ...change, opacity: clamp(change.opacity ?? layer.opacity, 0, 1) }]);
    return { layers: setRecord(garment.layers, primitive, layers.length ? layers : undefined) };
  });
}
