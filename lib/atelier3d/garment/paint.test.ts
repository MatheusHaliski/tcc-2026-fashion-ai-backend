import { describe, expect, it } from "vitest";
import { EMPTY_DOCUMENT } from "../document";
import { brushFalloff, createPixels, fillPixels, strokeDabs, strokeMask, tileOver, blendOver, hexToRgb } from "./raster";
import { addLayer, addPaintOp, composeLayers, layerPixels, renderOp, updateLayer, type LayerCache } from "./paint";
import { garmentOf, GARMENT_LIMITS, type PaintOp } from "./state";

const at = (pixels: { width: number; data: Uint8ClampedArray }, x: number, y: number) =>
  Array.from(pixels.data.slice((y * pixels.width + x) * 4, (y * pixels.width + x) * 4 + 4));
const stroke = (points: [number, number][], extra: Partial<PaintOp> = {}): PaintOp =>
  ({ kind: "stroke", color: "#ff0000", size: 64, opacity: 1, hardness: 1, erase: false, points, ...extra }) as PaintOp;

describe("pincel em UV", () => {
  it("queda da borda: centro cheio, borda zero, dureza controla a transição", () => {
    expect(brushFalloff(0, 0.5)).toBe(1);
    expect(brushFalloff(1, 0.5)).toBe(0);
    expect(brushFalloff(0.75, 0.5)).toBeCloseTo(0.5);
    expect(brushFalloff(0.6, 1)).toBe(1);
  });

  it("carimbos espaçados ao longo do traço incluem início e fim", () => {
    const dabs = strokeDabs([[0, 0], [10, 0]], 2.5);
    expect(dabs[0]).toEqual([0, 0]);
    expect(dabs.at(-1)).toEqual([10, 0]);
    expect(dabs).toHaveLength(5);
  });

  it("opacidade não acumula dentro do mesmo traço (máscara pelo máximo)", () => {
    const mask = strokeMask(64, 64, [[0.5, 0.5], [0.5, 0.5], [0.51, 0.5]], 8, 0)!;
    expect(Math.max(...mask.mask)).toBeLessThanOrEqual(1);
    const target = createPixels(64, 64);
    renderOp(target, stroke([[0.5, 0.5], [0.52, 0.5], [0.5, 0.5]], { opacity: 0.5, size: 1024 / 4 }));
    expect(at(target, 32, 32)[3]).toBeCloseTo(127, -1);
  });

  it("borracha apaga só a camada; preencher cobre a parte inteira", () => {
    const layer = createPixels(32, 32);
    renderOp(layer, { kind: "fill", color: "#00ff00", opacity: 1 });
    expect(at(layer, 0, 31)).toEqual([0, 255, 0, 255]);
    renderOp(layer, stroke([[0.5, 0.5]], { erase: true, size: 512 }));
    expect(at(layer, 16, 16)[3]).toBe(0);
    expect(at(layer, 0, 0)[3]).toBe(255);
  });

  it("composição: camada invisível não aparece e a opacidade da camada vale", () => {
    const surface = fillPixels(createPixels(16, 16), [255, 255, 255]);
    const cache: LayerCache = new Map();
    const fill: PaintOp = { kind: "fill", color: "#000000", opacity: 1 };
    composeLayers(surface, [{ id: "a", visible: false, opacity: 1, ops: [fill] }], cache);
    expect(at(surface, 3, 3)).toEqual([255, 255, 255, 255]);
    composeLayers(surface, [{ id: "a", visible: true, opacity: 0.5, ops: [fill] }], cache);
    expect(at(surface, 3, 3)[0]).toBeCloseTo(127, -1);
  });

  it("cache: ops já confirmadas não são redesenhadas quando o traço em andamento cresce", () => {
    const cache: LayerCache = new Map();
    const first = stroke([[0.2, 0.2]]);
    layerPixels({ id: "l", visible: true, opacity: 1, ops: [first, stroke([[0.8, 0.8]])] }, 32, cache);
    const cached = cache.get("l")!;
    layerPixels({ id: "l", visible: true, opacity: 1, ops: [first, stroke([[0.8, 0.8], [0.9, 0.9]])] }, 32, cache);
    expect(cache.get("l")).toBe(cached);
    expect(cached.ops).toEqual([first]);
  });
});

describe("camadas no documento", () => {
  it("cria camada, empilha traços com valores saneados e respeita os limites", () => {
    let doc = addPaintOp(EMPTY_DOCUMENT, "n0.p0", null, stroke([[1.4, -2], [0.123456, 0.5]], { size: 999 }));
    const [layer] = garmentOf(doc).layers["n0.p0"];
    const op = layer.ops[0] as Extract<PaintOp, { kind: "stroke" }>;
    expect(op.points).toEqual([[1, 0], [0.1235, 0.5]]);
    expect(op.size).toBe(256);
    doc = addLayer(doc, "n0.p0");
    const second = garmentOf(doc).layers["n0.p0"][1].id;
    doc = addPaintOp(doc, "n0.p0", second, stroke([[0.5, 0.5]]));
    expect(garmentOf(doc).layers["n0.p0"].map((l) => l.ops.length)).toEqual([1, 1]);
    doc = updateLayer(doc, "n0.p0", second, { opacity: 3 });
    expect(garmentOf(doc).layers["n0.p0"][1].opacity).toBe(1);
    doc = updateLayer(updateLayer(doc, "n0.p0", second, null), "n0.p0", layer.id, null);
    expect(doc.garment).toBeUndefined();
    expect(() => addPaintOp(EMPTY_DOCUMENT, "n0.p0", null, { ...stroke([[0, 0]]), color: "red" })).toThrow("ATELIER_PAINT_VALUE");
    let full = EMPTY_DOCUMENT;
    for (let i = 0; i < GARMENT_LIMITS.layers; i++) full = addLayer(full, "n0.p0");
    expect(() => addLayer(full, "n0.p0")).toThrow("ATELIER_COMMAND_LIMIT");
  });
});

describe("padrão repetido", () => {
  it("repete o ladrilho e respeita a opacidade", () => {
    const tile = createPixels(2, 1);
    tile.data.set([255, 0, 0, 255, 0, 0, 255, 255]);
    const target = fillPixels(createPixels(8, 8), [255, 255, 255]);
    tileOver(target, tile, 2, 0, 1);
    expect(at(target, 0, 0)[0]).toBeGreaterThan(at(target, 3, 0)[0]);
    const half = fillPixels(createPixels(4, 4), [255, 255, 255]);
    blendOver(half, fillPixels(createPixels(4, 4), hexToRgb("#000000")), 0.5);
    expect(at(half, 1, 1)[0]).toBeCloseTo(127, -1);
  });
});
