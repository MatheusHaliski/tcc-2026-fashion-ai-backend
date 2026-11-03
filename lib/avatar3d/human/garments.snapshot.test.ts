/**
 * Caracterização (lote R103): retratos SHA-256 dos moldes de roupa, gola, acabamentos, malha texturizada e material,
 * capturados no código antes da extração de garments.ts / garment-fit.ts / garment-trims.ts. Qualquer mudança de
 * número (arredondado a 6 casas), de ordem de vértices ou de atributo muda o retrato.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { compose, fitBody } from "./compose";
import { buildHuman, baseNormals } from "./three-human";
import { applyIdle, applyRestPose } from "./pose";
import {
  HAS_COLLAR_BAND, SPECS, SUBCATEGORY_KINDS, armOutFor, bodyParam, collarBand, coverageOf, fabricSurface, frontPanelCoverage,
  garmentGeometry, garmentMaterial, kindOf, legFlareOffset, necklineH, posedPositions, sizeExtra, sizeRelief, sizeStepsAt,
  sleeveEase, specOf, texturedGeometry, tubeRadius, underLayer, type GarmentKind, type GarmentSpec,
} from "./garments";
import { fitClassOf, lowerSilhouetteOf, necklineOf, riseOf, sleeveLengthOf, specFor, type FitPiece } from "./garment-fit";
import { garmentTrims, loweredHood, shirtPlacket, trimWidth } from "./garment-trims";
import { DEFAULT_BODY } from "../body-spec";
import { asset } from "./test-utils/garments-kit";
import { digest } from "./test-utils/snapshot-hash";

const SEXES = ["FEMININO", "MASCULINO"] as const;
const KINDS = Object.keys(SPECS) as GarmentKind[];
const STACKS: GarmentKind[][] = [["pants", "tee", "jacket"], ["pants", "sweater", "coat"], ["skirt", "shirt"], ["leggings", "dress"], ["shorts", "hoodie"], ["culottes", "tank", "vest"]];

function body(sex: (typeof SEXES)[number]) {
  const c = compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature);
  return { c, P: bodyParam(asset, c), normals: baseNormals(c.body, asset.body.index, asset.body.renderVertex) };
}

const PIECES: FitPiece[] = [
  { category: "upper_piece", subcategory: "t_shirt" }, { category: "upper_piece", subcategory: "t_shirt", sizeSteps: 2 },
  { category: "upper_piece", subcategory: "t_shirt", sizeSteps: -2 }, { category: "upper_piece", subcategory: "t_shirt", sizeSteps: 0, sizeRegions: { chest: 0, waist: -2, length: 0 } },
  { category: "upper_piece", subcategory: "t_shirt", sizeSteps: 2.5 }, { category: "upper_piece", subcategory: "shirt", attributes: { CLOSURE: ["ZIPPER"] } },
  { category: "upper_piece", subcategory: "shirt", attributes: { CLOSURE: ["BUTTON"], SLEEVE_LENGTH: ["SHORT_SLEEVE"] } },
  { category: "upper_piece", subcategory: "polo_shirt", name: "Polo Piquet" }, { category: "upper_piece", subcategory: "blouse", name: "Blusa decote V" },
  { category: "upper_piece", subcategory: "sweater", name: "Suéter gola alta", variation: "OVERSIZED" }, { category: "upper_piece", subcategory: "hoodie" },
  { category: "upper_piece", subcategory: "blazer", material: "wool" }, { category: "upper_piece", subcategory: "coat", attributes: { LENGTH: ["LONGLINE"] } },
  { category: "upper_piece", subcategory: "crop_top", attributes: { NECKLINE: ["SQUARE_NECK"] } }, { category: "upper_piece", subcategory: "tank_top", name: "Regata tomara que caia" },
  { category: "upper_piece", subcategory: "t_shirt", name: "Camiseta Long Sleeve", attributes: { LENGTH: ["CROPPED"] } },
  { category: "lower_piece", subcategory: "jeans" }, { category: "lower_piece", subcategory: "jeans", name: "Skinny high rise" },
  { category: "lower_piece", subcategory: "jeans", variation: "BOOTCUT" }, { category: "lower_piece", subcategory: "jeans", name: "Wide leg cintura alta" },
  { category: "lower_piece", subcategory: "cargo_pants", name: "Loose fit cargo" }, { category: "lower_piece", subcategory: "sweatpants", variation: "TAPERED" },
  { category: "lower_piece", subcategory: "jeans", sizeSteps: 0.1, sizeRegions: { waist: 0, hip: 0, length: 2 } },
  { category: "lower_piece", subcategory: "tailored_pants", attributes: { RISE: ["LOW_RISE"], LENGTH: ["ANKLE_LENGTH"] } },
  { category: "lower_piece", subcategory: "skirt", name: "Saia lápis midi", attributes: { LENGTH: ["MIDI"] } }, { category: "lower_piece", subcategory: "skort" },
  { category: "lower_piece", subcategory: "skirt", variation: "A_LINE" }, { category: "lower_piece", subcategory: "shorts", name: "Short relaxed" },
  { category: "lower_piece", subcategory: "denim_shorts" }, { category: "lower_piece", subcategory: "bermuda_shorts" }, { category: "lower_piece", subcategory: "leggings" },
  { category: "lower_piece", subcategory: "culottes", variation: "WIDE_LEG" }, { category: "full_body_piece", subcategory: "dress", attributes: { LENGTH: ["MAXI"], NECKLINE: ["HALTER"] } },
  { category: "full_body_piece", subcategory: "jumpsuit", attributes: { RISE: ["HIGH_RISE"] } }, { category: "full_body_piece", subcategory: "overalls" },
  { category: "full_body_piece", subcategory: "romper" }, { category: "shoes_piece", subcategory: "ankle_boots", attributes: { SHAFT_HEIGHT: ["KNEE_HIGH"] } },
  { category: "shoes_piece", subcategory: "long_boots" }, { category: "shoes_piece", subcategory: "casual_sneakers", sizeSteps: 1 },
  { category: "accessory_piece", subcategory: "bolsa tote" }, { name: "Calça Cargo", subcategory: "calca cargo" }, { subcategory: "vestido longo" },
];

describe("caracterização — tipos, moldes e caimento (puros)", () => {
  it("kindOf, specOf, specFor e as leituras da taxonomia", () => {
    const words = [...Object.keys(SUBCATEGORY_KINDS), "camiseta polo", "calça jogger", "jaqueta bomber", "short saia", "macaquinho", "sapatilha", "colete", "vestido", "mochila", "outra"];
    const kinds = words.map((w) => [w, kindOf({ subcategory: w }), specOf({ subcategory: w })]);
    const fit = PIECES.map((p) => [specFor(p), fitClassOf(p), lowerSilhouetteOf(p), sleeveLengthOf(p), necklineOf(p), riseOf(p)]);
    const slots = ["UPPER_PIECE", "LOWER_PIECE", "SHOES_PIECE", "FULL_BODY_PIECE", "OUTERWEAR", "ACCESSORY"].map((cat) => [kindOf({ category: cat, subcategory: "x" }), kindOf({ slot: cat, subcategory: "x" })]);
    expect({ kinds: digest(kinds), fit: digest(fit), slots: digest(slots), specs: digest(SPECS) }).toMatchSnapshot();
  });
  it("armOutFor, necklineH, frontPanelCoverage, sleeveEase e legFlareOffset", () => {
    const specs = KINDS.map((k) => SPECS[k]).concat(PIECES.map((p) => specFor(p)).filter((s): s is GarmentSpec => !!s));
    const necks = specs.map((sp) => Array.from({ length: 25 }, (_, i) => { const a = (i / 24) * 2 * Math.PI - Math.PI; return [necklineH(sp, Math.sin(a), Math.cos(a)), frontPanelCoverage(sp, Math.sin(a) * 0.05, Math.cos(a) * 0.1)]; }));
    const legs = specs.map((sp) => [sleeveEase(sp), ...[0, 0.2, 0.5, 0.8, 1].map((l) => legFlareOffset(sp, l))]);
    const arms = [...STACKS, ...KINDS.map((k) => [k])].map((s) => armOutFor(s.map((k) => SPECS[k])));
    expect({ necks: digest(necks), legs: digest(legs), arms: digest(arms) }).toMatchSnapshot();
  });
  it("material da peça e superfície do tecido", () => {
    const shader = { vertexShader: "#include <common>\n#include <begin_vertex>", fragmentShader: "#include <common>\n#include <map_fragment>", uniforms: {} };
    const specs = [...KINDS.map((k) => SPECS[k]), specFor({ subcategory: "jeans", category: "lower_piece" })!, specFor({ subcategory: "cargo_pants" })!, { ...SPECS.tee, fabric: "SILK" }];
    const out = specs.map((sp) => {
      const tex = new THREE.Texture(); const m = garmentMaterial(tex, sp); const s = { ...shader };
      m.onBeforeCompile(s as never, {} as never);
      const r = [m.name, m.roughness, m.sheen, m.sheenRoughness, m.polygonOffsetFactor, m.polygonOffsetUnits, m.alphaTest, m.side, m.customProgramCacheKey(), s.vertexShader, s.fragmentShader.slice(0, 400)];
      m.dispose(); tex.dispose(); return r;
    });
    const surfaces = ["DENIM", "canvas", "COTTON", "LINEN", "WOOL", "CASHMERE", "FLEECE", "KNIT", "SILK", "SATIN", "LEATHER", "NYLON", undefined].map(fabricSurface);
    expect({ material: digest(out), surfaces: digest(surfaces), collar: [...HAS_COLLAR_BAND].sort().join(",") }).toMatchSnapshot();
  });
});

for (const sex of SEXES) {
  describe(`caracterização — geometria das peças (${sex})`, () => {
    const { c, P, normals } = body(sex);
    it("bodyParam, cobertura e molde de cada tipo sozinho", () => {
      const out: Record<string, string> = { param: digest(P) };
      for (const k of KINDS) out[k] = digest([coverageOf(c, P, SPECS[k]), garmentGeometry(asset, c, normals, P, SPECS[k])]);
      expect(out).toMatchSnapshot();
    }, 180_000);
    it("pilhas de camadas: underLayer, molde de fora, gola e tubos", () => {
      const out: Record<string, string> = {};
      for (const stack of STACKS) {
        const below = stack.slice(0, -1).map((k) => SPECS[k]), top = SPECS[stack[stack.length - 1]];
        const under = underLayer(c, P, below);
        const gg = garmentGeometry(asset, c, normals, P, top, under);
        const tubes = under.tubes.map((tb) => [0, 8, 31, 63].map((j) => tubeRadius(tb, tb.y0 - tb.len * 0.5, j)));
        out[stack.join("+")] = digest([under, gg, collarBand(asset, c, P, top, under), tubes]);
      }
      for (const k of HAS_COLLAR_BAND) out[`gola-${k}`] = digest(collarBand(asset, c, P, SPECS[k]));
      expect(out).toMatchSnapshot();
    }, 180_000);
    it("tamanho e caimento por região (sizeExtra, sizeStepsAt, sizeRelief) e moldes de specFor", () => {
      const out: Record<string, string> = {};
      PIECES.forEach((p, i) => {
        const sp = specFor(p); if (!sp) return;
        const rel: number[] = [];
        for (let v = 0; v < P.h.length; v += 37) rel.push(sizeExtra(sp, P, v), sizeStepsAt(sp, P, v), sizeRelief(sp, P, v, c.body[v * 3], c.body[v * 3 + 1], c.body[v * 3 + 2]));
        out[`${i}-${p.subcategory}`] = digest([rel, garmentGeometry(asset, c, normals, P, sp)]);
      });
      expect(out).toMatchSnapshot();
    }, 240_000);
    it("acabamentos: barra, punho, carcela, capuz", () => {
      const out: Record<string, string> = {};
      for (const sp of [SPECS.tee, SPECS.longsleeve, SPECS.shirt, SPECS.sweater, SPECS.hoodie, SPECS.crop, SPECS.tank, specFor({ subcategory: "polo_shirt", category: "upper_piece" })!]) {
        const gg = garmentGeometry(asset, c, normals, P, sp)!;
        out[`${sp.kind}-${sp.placketLength ?? ""}`] = digest([trimWidth(sp, "hem"), trimWidth(sp, "cuff"), garmentTrims(asset, c, P, gg), garmentTrims(asset, c, P, gg, { preservePhotoDetails: true }), shirtPlacket(asset, c, P, gg), loweredHood(asset, c, P, gg)]);
      }
      expect(out).toMatchSnapshot();
    }, 180_000);
    it("posedPositions e malha texturizada sem foto, parada e em movimento", () => {
      const h = buildHuman(asset, c, { skin: "#c99a6e" }); const st = applyRestPose(h);
      const out: Record<string, string> = {};
      try {
        for (const k of ["tee", "pants", "dress", "shoes", "boots", "jacket", "skirt"] as GarmentKind[]) {
          const gg = garmentGeometry(asset, c, normals, P, SPECS[k])!;
          for (const t of [0, 2.5]) {
            if (t) applyIdle(h, st, t, 1);
            const posed = posedPositions(h.skeleton, h.body.bindMatrix, gg.position, gg.skinIndex, gg.skinWeight, h.body);
            const geo = texturedGeometry(gg, posed, null);
            out[`${k}@${t}`] = digest([posed, geo]); geo.dispose();
          }
        }
      } finally { h.dispose(); }
      expect(out).toMatchSnapshot();
    }, 180_000);
  });
}
