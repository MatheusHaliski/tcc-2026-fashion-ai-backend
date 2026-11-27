/**
 * Caracterização (lote R103): retratos SHA-256 do cabelo — calota/cortina/cobertura (hair-geometry.ts), penteado, fios
 * nos três níveis, malha base + fios e material (hair-strands.ts) — capturados antes da extração dos dois arquivos.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { compose, fitBody } from "./compose";
import { baseNormals } from "./three-human";
import { buildHair, earVertexMask, hairline, headFrame } from "./hair-geometry";
import {
  BABY_KIND, FRINGE_KIND, groomFromJSON, groomToJSON, growGroom, strandContext, strandGeometry, strandMaterial, strandsFromGroom,
  withStrands,
} from "./hair-strands";
import { DEFAULT_BODY } from "../body-spec";
import type { AvatarHair } from "../model";
import { asset } from "./test-utils/garments-kit";
import { digest } from "./test-utils/snapshot-hash";

const hairOf = (o: Partial<AvatarHair>): AvatarHair => ({ present: true, color: "#33241a", top: 15, side: 9, bottom: 2.9, fringe: 0, cut: false, length: "short", texture: "straight", ...o });
const OUTLINE = [0, 6.5, 8.2, 9.1, 9.6, 9.8, 9.9, 10.1, 10.4, 10.8, 11, 11.2, 10.9, 10.2, 9.4, 8.8, 8.1, 7.6, 7, 6.2, 5.5];
const HAIRS: Record<string, AvatarHair> = {
  curto: hairOf({}), raspado: hairOf({ length: "buzz" }), careca: hairOf({ length: "bald" }),
  medio: hairOf({ length: "medium", bottom: -6, outline: OUTLINE, part: 0.2 }),
  longo: hairOf({ length: "long", bottom: -18, outline: OUTLINE, volume: 1.4, variation: 0.6 }),
  ondulado: hairOf({ length: "long", texture: "wavy", bottom: -14, fringe: 0.5 }),
  cacheado: hairOf({ length: "medium", texture: "curly", bottom: -8, volume: 1.6 }),
  crespo: hairOf({ length: "short", texture: "coily", top: 17, volume: 1.8, cut: true }),
  reta: hairOf({ length: "medium", fringeStyle: "blunt", bottom: -7 }), lateral: hairOf({ fringeStyle: "side", part: -0.5 }),
  cortina: hairOf({ length: "long", fringeStyle: "curtain", bottom: -15 }), desfiada: hairOf({ fringeStyle: "wispy", fringe: 0.7 }),
  lenco: hairOf({ cover: "#aa2233", outline: OUTLINE }), escuro: hairOf({ color: "#050403", length: "long", bottom: -10 }),
};

const material = (m: THREE.Material) => {
  const p = m as THREE.MeshPhysicalMaterial;
  return [p.name, p.color?.getHexString(), p.roughness, p.sheen, p.alphaTest, p.alphaToCoverage, p.anisotropy, p.polygonOffsetUnits, p.side, p.vertexColors, p.userData, p.customProgramCacheKey?.()];
};

for (const sex of ["FEMININO", "MASCULINO"] as const) {
  describe(`caracterização — cabelo (${sex})`, () => {
    const c = compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature);
    const normals = baseNormals(c.body, asset.body.index, asset.body.renderVertex);
    const fr = headFrame(asset, c);
    it("quadro da cabeça, linha do cabelo e máscara da orelha", () => {
      const lines = Object.values(HAIRS).map((h) => Array.from({ length: 33 }, (_, i) => [hairline(fr, h, (i / 32) * 2 * Math.PI - Math.PI, false), hairline(fr, h, (i / 32) * 2 * Math.PI - Math.PI, true)]));
      expect({ frame: digest(fr), lines: digest(lines), ear: digest(earVertexMask(asset)) }).toMatchSnapshot();
    });
    it("calota, cortina e cobertura (com e sem base, volumes)", () => {
      const out: Record<string, string> = {};
      for (const [name, h] of Object.entries(HAIRS)) for (const [vol, base] of [[1, false], [1, true], [1.4, false]] as const) {
        const b = buildHair(asset, c, normals, h, vol, { base });
        out[`${name}-${vol}-${base}`] = b ? digest([b.kind, b.calotaIndex, b.geometry, material(b.material)]) : "null";
      }
      expect(out).toMatchSnapshot();
    }, 180_000);
    it("penteado, fios nos três níveis, JSON e malha combinada", () => {
      const out: Record<string, string> = { kinds: digest([FRINGE_KIND, BABY_KIND]) };
      for (const [name, h] of Object.entries(HAIRS)) {
        const base = buildHair(asset, c, normals, h, 1, { base: true });
        if (!base) { out[name] = "sem base"; continue; }
        const ctx = strandContext(asset, c, h, base, 1.2);
        if (!ctx) { out[name] = "sem contexto"; continue; }
        const groom = growGroom(ctx, h, base, { density: 0.5, seed: 21 })!;
        const json = groomToJSON(groom);
        const lods = ([0, 1, 2] as const).map((lod) => strandsFromGroom(ctx, groom, lod, { seed: 5 }));
        const st = strandGeometry(asset, c, h, base, 1, { lod: 1, density: 0.4 });
        const merged = st ? withStrands(base, st, h.color!, { earY: fr.earY }) : null;
        out[name] = digest([
          ctx.k, ctx.hv, ctx.long, ctx.yBottom, ctx.shoulderY, ctx.browY, ctx.variation, ctx.bones,
          json, groomFromJSON(json), lods, st, merged ? [merged.geometry, merged.material.map(material)] : null,
          strandGeometry(asset, c, h, base, 1, { lod: 3 }),
        ]);
      }
      expect(out).toMatchSnapshot();
    }, 300_000);
  });
}

describe("caracterização — material dos fios", () => {
  it("uniformes, chave de programa e shader por nível", () => {
    const out = (["#33241a", "#050403", "#d8c090"] as const).flatMap((color) => ([0, 1, 2] as const).map((lod) => {
      const m = strandMaterial(color, lod);
      const shader = { uniforms: {} as Record<string, unknown>, vertexShader: "", fragmentShader: "#include <lights_fragment_end>\nvoid main(){}" };
      m.onBeforeCompile(shader as never, {} as never);
      const r = [material(m), shader.uniforms, shader.fragmentShader];
      m.dispose(); return r;
    }));
    expect(digest(out)).toMatchSnapshot();
  });
});
