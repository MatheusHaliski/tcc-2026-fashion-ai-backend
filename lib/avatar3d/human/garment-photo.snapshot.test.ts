/**
 * Caracterização (lote R103): retratos SHA-256 das funções puras da foto da peça (amostra de tecido, recorte, buracos,
 * barra) e da projeção da foto na malha (texturedGeometry/photoSleeves) com fotos sintéticas, capturados antes da
 * extração de garment-photo.ts e garments.ts.
 */
import { describe, expect, it } from "vitest";
import {
  canUseOutfitPhoto, cutoutGarment, fabricPatch, fabricRows, fabricTile, fillInteriorHoles, fullBodyUpperPhoto, medoid,
  splitByHem, type GarmentRaster,
} from "./garment-photo";
import { SPECS, bodyParam, garmentGeometry, isBackdrop, photoSleeves, srgbBytes, texturedGeometry, type GarmentGeometry, type PhotoInfo } from "./garments";
import { compose, fitBody } from "./compose";
import { baseNormals } from "./three-human";
import { DEFAULT_BODY } from "../body-spec";
import { asset } from "./test-utils/garments-kit";
import { digest } from "./test-utils/snapshot-hash";

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

type Painter = (x: number, y: number) => [number, number, number, number];
function raster(w: number, h: number, paint: Painter): GarmentRaster {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(paint(x, y), (y * w + x) * 4);
  return { width: w, height: h, data };
}
const inShirt = (w: number, h: number, x: number, y: number) => x > w * 0.2 && x < w * 0.8 && y > h * 0.1 && y < h * 0.9;
const R = rng(7);
const noise = Array.from({ length: 4096 }, () => R());
const RASTERS: Record<string, GarmentRaster> = {
  liso: raster(160, 200, (x, y) => (inShirt(160, 200, x, y) ? [40, 60, 120, 255] : [0, 0, 0, 0])),
  xadrez: raster(200, 240, (x, y) => (inShirt(200, 240, x, y) ? (((x >> 4) + (y >> 4)) % 2 ? [200, 30, 30, 255] : [20, 20, 90, 255]) : [0, 0, 0, 0])),
  listras: raster(200, 240, (x, y) => (inShirt(200, 240, x, y) ? ((x >> 3) % 2 ? [230, 230, 230, 255] : [30, 30, 30, 255]) : [0, 0, 0, 0])),
  trama: raster(200, 240, (x, y) => { const n = noise[(x * 31 + y * 17) % 4096] * 60; return inShirt(200, 240, x, y) ? [90 + n, 70 + n, 50 + n, 255] : [0, 0, 0, 0]; }),
  estudio: raster(120, 160, (x, y) => (x > 30 && x < 90 && y > 20 && y < 140 ? (x === 31 || y === 21 ? [140, 150, 200, 255] : [30, 40, 160, 255]) : [245, 245, 245, 255])),
  furado: raster(100, 120, (x, y) => (x > 10 && x < 90 && y > 10 && y < 110 ? (Math.hypot(x - 50, y - 60) < 9 ? [0, 0, 0, 0] : [120, 80 + (y % 7), 40, 255]) : [0, 0, 0, 0])),
  look: raster(120, 220, (x, y) => (x > 25 && x < 95 && y > 10 && y < 210 ? (y < 110 ? [220, 200, 40, 255] : y < 114 ? [0, 0, 0, 0] : [30, 50, 110, 255]) : [0, 0, 0, 0])),
  modelo: raster(60, 200, (x, y) => (x > 20 && x < 40 && y > 5 && y < 195 ? [150, 110, 90, 255] : [0, 0, 0, 0])),
};
const copy = (r: GarmentRaster): GarmentRaster => ({ width: r.width, height: r.height, data: new Uint8ClampedArray(r.data) });

describe("caracterização — foto da peça (puros)", () => {
  it("amostras de tecido, recorte, buracos e barra", () => {
    const out: Record<string, string> = {};
    for (const [name, r] of Object.entries(RASTERS)) {
      const holes = copy(r), upper = copy(r), lower = copy(r);
      out[name] = digest([
        fabricTile(r), fabricTile(r, { fromX: 0, toX: r.width / 2 }), fabricPatch(r), fabricPatch(r, { fromX: r.width / 2 }),
        fabricRows(r), fabricRows(r, { inset: 0.1, fromY: 20, toY: r.height - 10 }), cutoutGarment(copy(r)),
        fillInteriorHoles(holes), holes.data, splitByHem(upper, "upper"), upper.data, splitByHem(lower, "lower"), lower.data,
        fullBodyUpperPhoto(r),
      ]);
    }
    out.medoid = digest([medoid([]), medoid([[0, 0, 255], [0, 0, 250], [255, 128, 0], [250, 120, 0], [10, 10, 10]])]);
    out.backdrop = digest([srgbBytes("#336699"), srgbBytes("red"), isBackdrop(Uint8ClampedArray.from([10, 10, 10]), 0, [12, 12, 12]), isBackdrop(Uint8ClampedArray.from([10, 10, 10]), 0, null)]);
    const results = [
      { segmentationAvailable: false, people: 0, personFound: false }, { segmentationAvailable: true, people: 0, personFound: false },
      { segmentationAvailable: true, people: 2, personFound: true }, { segmentationAvailable: true, people: 1, personFound: true },
      { segmentationAvailable: true, people: 1, personFound: true, garments: { kept: "upper", ambiguous: false } },
      { segmentationAvailable: true, people: 1, personFound: true, garments: { kept: "full", ambiguous: true } },
    ];
    out.outfit = digest(results.map((r) => (["upper", "lower", "full", "feet"] as const).map((p) => canUseOutfitPhoto(r as never, p))));
    expect(out).toMatchSnapshot();
  });
});

function sleeveMesh(): GarmentGeometry {
  const pos: number[] = [], idx: number[] = [];
  const strip = (xs: number[], y0: number, y1: number, rows: number) => {
    const start = pos.length / 3;
    for (let r = 0; r <= rows; r++) for (const x of xs) pos.push(x, y0 + (y1 - y0) * (r / rows), 0.02 * Math.cos(x * 9));
    for (let r = 0; r < rows; r++) for (let col = 0; col < xs.length - 1; col++) { const i = start + r * xs.length + col; idx.push(i, i + 1, i + xs.length, i + 1, i + xs.length + 1, i + xs.length); }
  };
  strip([-0.1, -0.05, 0, 0.05, 0.1], 0, 1, 50); strip([-0.35, -0.3, -0.25], 0.2, 1, 40); strip([0.25, 0.3, 0.35], 0.2, 1, 40);
  const n = pos.length / 3;
  return { spec: SPECS.shirt, position: Float32Array.from(pos), alpha: new Float32Array(n).fill(1), index: Uint32Array.from(idx), source: new Int32Array(n).fill(0), skinIndex: new Uint16Array(n * 4), skinWeight: new Float32Array(n * 4).fill(0.25) };
}
const base = { width: 300, height: 400, box: { x0: 50, y0: 40, x1: 250, y1: 360 }, neckDrop: null, cutout: true, backdrop: null };
const PHOTOS: Record<string, PhotoInfo> = {
  simples: { ...base, collarRow: null, widthAt: () => ({ x0: 60, x1: 240 }) },
  gola: { ...base, collarRow: 0.08, widthAt: (fy) => ({ x0: 70 - fy * 10, x1: 230 + fy * 10 }) },
  mangas: { ...base, collarRow: null, widthAt: (fy) => (fy <= 0.6 ? { x0: 50, x1: 250 } : { x0: 110, x1: 190 }), torsoWidthAt: () => ({ x0: 110, x1: 190 }) },
  marcos: {
    ...base, collarRow: 0.05, widthAt: () => ({ x0: 80, x1: 220 }), torsoWidthAt: (fy) => ({ x0: 90 + fy * 5, x1: 210 - fy * 5 }),
    landmarks: { leftShoulder: { x: 70, y: 60 }, rightShoulder: { x: 230, y: 62 }, neckline: { x: 150, y: 50 }, hem: { x: 152, y: 355 } },
  },
  costas: { ...base, collarRow: null, isBackView: true, widthAt: () => ({ x0: 60, x1: 240 }) },
  pernas: { ...base, collarRow: null, widthAt: () => ({ x0: 60, x1: 240 }), legRows: [160, 200, 240, 280, 320, 350].map((y) => ({ y, left: { x0: 60, x1: 140 }, right: { x0: 160, x1: 240 } })) },
};

describe("caracterização — projeção da foto na malha", () => {
  it("malha sintética: mangas, gola, marcos, costas e pernas", () => {
    const gg = sleeveMesh(); const isSleeve = (v: number) => Math.abs(gg.position[v * 3]) > 0.2;
    const along = (v: number) => (isSleeve(v) ? (1 - gg.position[v * 3 + 1]) / 0.8 : -1);
    const out: Record<string, string> = {};
    for (const [name, photo] of Object.entries(PHOTOS)) {
      for (const spec of [SPECS.shirt, SPECS.tee, SPECS.pants, SPECS.shoes, SPECS.skirt]) {
        const g = { ...gg, spec };
        const geo = texturedGeometry(g, g.position, photo, isSleeve, g.alpha, { isSleeve, along });
        out[`${name}-${spec.kind}`] = digest([photoSleeves(photo), geo]); geo.dispose();
      }
    }
    expect(out).toMatchSnapshot();
  });
  it("molde real com as fotos sintéticas", () => {
    const c = compose(asset, fitBody(asset, { sex: "FEMININO" }).z, null, DEFAULT_BODY.FEMININO.stature);
    const P = bodyParam(asset, c), normals = baseNormals(c.body, asset.body.index, asset.body.renderVertex);
    const out: Record<string, string> = {};
    for (const k of ["tee", "pants", "shirt", "boots", "jacket"] as const) {
      const gg = garmentGeometry(asset, c, normals, P, SPECS[k])!;
      for (const [name, photo] of Object.entries(PHOTOS)) {
        const geo = texturedGeometry(gg, gg.position, photo, (v) => gg.source[v] >= 0 && P.group[gg.source[v]] === 2);
        out[`${k}-${name}`] = digest(geo); geo.dispose();
      }
    }
    expect(out).toMatchSnapshot();
  }, 180_000);
});
