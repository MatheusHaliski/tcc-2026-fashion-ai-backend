import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACERVO, acervoLook } from "@/lib/tryon/acervo";
import { SUBCATEGORY_KINDS, kindOf } from "./garments";
import { specFor } from "./garment-fit";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { DEFAULT_BODY } from "../body-spec";
import { build, probeEnv } from "../matriz3d/probe";

const root = new URL("../../../", import.meta.url);
const taxonomy = JSON.parse(readFileSync(new URL("fai-application/src/main/resources/taxonomy/taxonomy.json", root), "utf8")) as { subcategories: { code: string; category: string }[] };
const meta = JSON.parse(readFileSync(new URL("public/avatar3d/body/fai-body-v1.json", root), "utf8")) as BodyMeta;
const bin = readFileSync(new URL("public/avatar3d/body/fai-body-v1.bin", root));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

describe("FAI reference mould library", () => {
  it("has an explicit resolution and a real reference photograph for every clothing and footwear subtype", () => {
    const subs = taxonomy.subcategories.filter(s => s.category !== "accessory_piece").map(s => s.code).sort();
    expect(Object.keys(SUBCATEGORY_KINDS).sort()).toEqual(subs);
    expect(ACERVO.map(p => p.subcategory).sort()).toEqual(subs);
    expect(new Set(ACERVO.map(p => p.id)).size).toBe(ACERVO.length);
    for (const p of ACERVO) {
      expect(existsSync(new URL(`public${acervoLook(p).imageUrl}`, root)), p.subcategory).toBe(true);
      expect(kindOf({ subcategory: p.subcategory })).toBe(SUBCATEGORY_KINDS[p.subcategory]);
    }
  });
  it("keeps independent short polo, blouse, cropped top and long sleeve cuts", () => {
    expect(specFor({ subcategory: "polo_shirt" })?.sleeve).toBe(.33);
    expect(specFor({ subcategory: "polo_shirt" })?.placketLength).toBe(.16);
    expect(specFor({ subcategory: "blouse" })?.placket).toBe(false);
    expect(specFor({ subcategory: "top" })?.hem).toBe(.45);
    expect(specFor({ subcategory: "t_shirt", name: "Long Sleeve Tee" })?.sleeve).toBe(.96);
    expect(specFor({ subcategory: "t_shirt", name: "Camiseta manga longa" })?.sleeve).toBe(.96);
  });
  for (const sex of ["FEMININO", "MASCULINO"] as const) {
    const body = compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature);
    const env = probeEnv(asset, body);
    it(`${sex}: straps cross the shoulders instead of ending as a strapless shell`, () => {
      for (const subcategory of ["tank_top", "bodysuit", "dress", "overalls"]) {
        const b = build(env, { subcategory });
        expect(b.obs.molde?.ombro, subcategory).toBeGreaterThan(0);
        expect(b.obs.spec?.sleeve).toBe(0);
      }
    });
    it(`${sex}: polo has three buttons on a short placket; blouse has none`, () => {
      const polo = build(env, { subcategory: "polo_shirt" });
      expect(polo.obs.acabamentos.botoes).toBe(3 * 13);
      expect(polo.obs.acabamentos["gola-ponta"]).toBeGreaterThan(0);
      const blouse = build(env, { subcategory: "blouse" });
      expect(blouse.obs.acabamentos.botoes).toBeUndefined();
    });
    for (const piece of ACERVO) it(`${sex}: ${piece.subcategory} builds finite geometry bound to the body rig`, () => {
      const b = build(env, piece);
      expect(b.gg, piece.subcategory).not.toBeNull();
      const meshes = [b.gg!, ...b.trims, ...b.shoes, ...(b.collar ? [b.collar] : [])];
      for (const m of meshes) {
        expect(m.index.length).toBeGreaterThan(0);
        expect(Array.from(m.position).every(Number.isFinite)).toBe(true);
        for (let v = 0; v < m.position.length / 3; v++) {
          expect(m.skinWeight.slice(v * 4, v * 4 + 4).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4);
          for (const bone of m.skinIndex.slice(v * 4, v * 4 + 4)) expect(bone).toBeLessThan(asset.meta.bones.length);
        }
      }
    });
  }
});
