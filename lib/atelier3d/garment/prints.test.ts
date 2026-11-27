import { describe, expect, it } from "vitest";
import { EMPTY_DOCUMENT } from "../document";
import { PATTERN_COLORS, patternPixels } from "./patterns";
import { decalBasis, decalTriangles, rasterDecal } from "./decal";
import { addDecal, addImage, setPattern, updateDecal } from "./prints";
import { createPixels } from "./raster";
import { garmentOf, GARMENT_LIMITS, PATTERNS } from "./state";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const pixel = (p: { width: number; data: Uint8ClampedArray }, x: number, y: number) => Array.from(p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4));

describe("estampas procedurais", () => {
  it("cada estampa usa as cores da paleta, é opaca e repete sem emenda", () => {
    for (const kind of PATTERNS) {
      const tile = patternPixels(kind, PATTERN_COLORS[kind], 64);
      const colors = new Set<string>();
      for (let i = 0; i < tile.data.length; i += 4) {
        expect(tile.data[i + 3]).toBe(255);
        colors.add(Array.from(tile.data.slice(i, i + 3)).join(","));
      }
      expect(colors.size).toBeGreaterThan(1);
    }
    const stripes = patternPixels("stripes", ["#ffffff", "#000000", "#ff0000"], 64);
    expect(pixel(stripes, 10, 4).slice(0, 3)).toEqual([255, 255, 255]);
    expect(pixel(stripes, 10, 20).slice(0, 3)).toEqual([0, 0, 0]);
    const polka = patternPixels("polka", ["#000000", "#ffffff", "#ff0000"], 64);
    expect(pixel(polka, 16, 16)[0]).toBe(255);
    expect(pixel(polka, 0, 32)[0]).toBe(0);
  });
});

describe("decalque projetado", () => {
  // quadrado no plano z = 0, UV = xy
  const positions = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0];
  const uvs = [0, 0, 1, 0, 1, 1, 0, 1];
  const index = [0, 1, 2, 0, 2, 3];

  it("a base do projetor segue a normal e a rotação", () => {
    const { right, up } = decalBasis([0, 0, 1], 0);
    expect(right.map((x) => Math.round(x))).toEqual([1, 0, 0]);
    expect(up.map((x) => Math.round(x))).toEqual([0, 1, 0]);
    const turned = decalBasis([0, 0, 1], Math.PI / 2);
    expect(turned.right.map((x) => Math.round(x))).toEqual([0, 1, 0]);
  });

  it("só triângulos voltados para o projetor e dentro da caixa recebem a estampa", () => {
    const hit = decalTriangles(positions, uvs, index, { position: [0.5, 0.5, 0], normal: [0, 0, 1], size: 0.5, rotation: 0 });
    expect(hit).toHaveLength(2);
    const side = decalTriangles(positions, uvs, index, { position: [0.5, 0.5, 0], normal: [1, 0, 0], size: 0.5, rotation: 0 });
    expect(side).toHaveLength(0);
    const far = decalTriangles(positions, uvs, index, { position: [5, 5, 0], normal: [0, 0, 1], size: 0.5, rotation: 0 });
    expect(far).toHaveLength(0);
  });

  it("rasteriza a imagem no UV: centro pintado, fora da caixa intacto", () => {
    const image = createPixels(4, 4);
    for (let i = 0; i < image.data.length; i += 4) image.data.set([255, 0, 0, 255], i);
    const target = createPixels(32, 32);
    const triangles = decalTriangles(positions, uvs, index, { position: [0.5, 0.5, 0], normal: [0, 0, 1], size: 0.5, rotation: 0 });
    rasterDecal(target, image, triangles, 1);
    expect(pixel(target, 16, 16)).toEqual([255, 0, 0, 255]);
    expect(pixel(target, 2, 2)[3]).toBe(0);
  });
});

describe("estampas no documento", () => {
  it("imagem guardada uma vez, decalque recolocado/removido e imagem sem uso descartada", () => {
    const stored = addImage(EMPTY_DOCUMENT, PNG);
    expect(addImage(stored.doc, PNG).id).toBe(stored.id);
    const added = addDecal(stored.doc, { primitive: "n0.p0", image: stored.id, position: [0, 0, 0], normal: [0, 0, 1], size: 0.3, rotation: 9, opacity: 1 });
    expect(garmentOf(added.doc).decals[0].rotation).toBeCloseTo(Math.PI);
    const moved = updateDecal(added.doc, added.id, { position: [1, 2, 3] });
    expect(garmentOf(moved).decals[0].position).toEqual([1, 2, 3]);
    expect(garmentOf(added.doc).decals[0].position).toEqual([0, 0, 0]);
    expect(updateDecal(moved, added.id, null).garment).toBeUndefined();
    expect(() => addImage(EMPTY_DOCUMENT, "data:text/html;base64,AAAA")).toThrow("ATELIER_IMAGE_SIZE");
    expect(() => addImage(EMPTY_DOCUMENT, "data:image/png;base64," + "A".repeat(GARMENT_LIMITS.imageChars))).toThrow();
  });

  it("padrão repetido por parte: procedural, imagem e remoção", () => {
    const fill = { source: { kind: "procedural" as const, pattern: "plaid" as const, colors: PATTERN_COLORS.plaid }, scale: 200, rotation: 0, opacity: 1 };
    const doc = setPattern(EMPTY_DOCUMENT, ["n0.p0", "n1.p0"], fill);
    expect(Object.keys(garmentOf(doc).patterns)).toEqual(["n0.p0", "n1.p0"]);
    expect(garmentOf(doc).patterns["n0.p0"].scale).toBe(64);
    const stored = addImage(doc, PNG);
    const tiled = setPattern(stored.doc, ["n0.p0"], { source: { kind: "image", image: stored.id }, scale: 4, rotation: 0, opacity: 1 });
    expect(garmentOf(tiled).images[stored.id]).toBe(PNG);
    expect(() => setPattern(EMPTY_DOCUMENT, ["n0.p0"], { ...fill, source: { kind: "image", image: "nada" } })).toThrow("ATELIER_COMMAND_TARGET");
    expect(setPattern(setPattern(doc, ["n1.p0"], null), ["n0.p0"], null).garment).toBeUndefined();
  });
});
