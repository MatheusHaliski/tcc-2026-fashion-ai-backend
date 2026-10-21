import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UPPER_PROFILES, hasRibbing } from "./upperwear";
import { specFor } from "./garment-fit";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { baseNormals } from "./three-human";
import { bodyParam, coverageOf, type GarmentSpec } from "./garments";
import { buildGarment, softBodyOf } from "./dress";
import { occludeInnerGarment } from "./garment-layers";
import { DEFAULT_BODY } from "../body-spec";

const taxonomy = JSON.parse(readFileSync(new URL("../../../fai-application/src/main/resources/taxonomy/taxonomy.json", import.meta.url), "utf8")) as { subcategories: { code: string; category: string; variations?: { code: string }[] }[] };
const upper = taxonomy.subcategories.filter(s => s.category === "upper_piece");
const spec = (subcategory: string, variation?: string, attributes?: Record<string, string[]>) => specFor({ category: "upper_piece", subcategory, variation, attributes })!;

describe("todas as subcategorias superiores da taxonomia", () => {
  it("têm perfil explícito, inclusive crop_top legado, sem alterar os perfis compartilhados", () => {
    expect(Object.keys(UPPER_PROFILES).sort()).toEqual(upper.map(s => s.code).sort());
    for (const s of upper) {
      const before = structuredClone(UPPER_PROFILES[s.code]);
      for (const v of s.variations ?? []) {
        const sp = spec(s.code, v.code);
        expect(sp, `${s.code}/${v.code}`).toBeTruthy();
        expect(Number.isFinite(sp.hem)).toBe(true);
        expect(sp.ease).toBeGreaterThan(0); expect(sp.ease).toBeLessThanOrEqual(.05);
        expect(sp.sleeve).toBeGreaterThanOrEqual(0); expect(sp.sleeve).toBeLessThanOrEqual(1);
      }
      expect(UPPER_PROFILES[s.code]).toEqual(before);
    }
  });
  it("separa polo, blusa, body, regata, colete e quimono sem inventar botões", () => {
    expect(spec("polo_shirt")).toMatchObject({ sleeve: .33, placket: true, placketLength: .16 });
    expect(spec("blouse").placket).toBe(false);
    expect(spec("bodysuit").hem).toBeLessThan(spec("tank_top").hem);
    expect(spec("vest").sleeve).toBe(0);
    expect(spec("kimono").sleeveEase).toBeGreaterThan(0);
    expect(spec("kimono").frontOpening).toBeGreaterThan(0);
  });
  it("distingue baby tee, boxy, overshirt, bolero, rugby, bandeau e bomber", () => {
    expect(spec("t_shirt", "BABY_TEE").hem).toBeGreaterThan(spec("t_shirt", "REGULAR").hem);
    expect(spec("t_shirt", "BOXY").hem).toBeGreaterThan(spec("t_shirt", "OVERSIZED").hem);
    expect(spec("shirt", "OVERSHIRT").layer).toBeGreaterThan(spec("shirt").layer);
    expect(spec("cardigan", "BOLERO").hem).toBeGreaterThan(spec("cardigan").hem);
    expect(spec("polo_shirt", "RUGBY").sleeve).toBe(.96);
    expect(spec("top", "BANDEAU").neck).toBe(.65);
    expect(hasRibbing(spec("jacket", "BOMBER"))).toBe(true);
    expect(hasRibbing(spec("jacket", "MOTO"))).toBe(false);
  });
  it("atributos explícitos prevalecem sobre variação; cropped nunca conserva a cauda longa do casaco", () => {
    expect(spec("polo_shirt", "RUGBY", { SLEEVE_LENGTH: ["SHORT_SLEEVE"], CLOSURE: ["ZIPPER"] })).toMatchObject({ sleeve: .33, placket: false });
    expect(spec("cardigan", "OPEN_FRONT", { CLOSURE: ["BUTTON"] }).frontOpening).toBe(0);
    expect(spec("coat", "TRENCH", { LENGTH: ["CROPPED"] })).toMatchObject({ skirt: 0, hem: .45 });
    expect(spec("blouse", "TUNIC", { LENGTH: ["CROPPED"] }).hem).toBe(.45);
  });
});

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

it.each(["FEMININO", "MASCULINO"] as const)("gera as 19 famílias no corpo %s e conserva a camiseta visível sob peças abertas", sex => {
  const body = compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature);
  const before = body.body.slice(), normals = baseNormals(body.body, asset.body.index, asset.body.renderVertex);
  const P = bodyParam(asset, body), soft = softBodyOf(asset, body);
  const build = (sp: GarmentSpec) => buildGarment(asset, body, soft, normals, P, sp, []).gg!;
  const report = upper.map(s => {
    const sp = spec(s.code), gg = build(sp);
    expect(gg, s.code).toBeTruthy();
    expect([...gg.position].every(Number.isFinite), s.code).toBe(true);
    expect(gg.alpha.some(a => a > .5), s.code).toBe(true);
    return { subcategory: s.code, spec: { hem: sp.hem, sleeve: sp.sleeve, layer: sp.layer, frontOpening: sp.frontOpening ?? 0 }, vertices: gg.position.length / 3 };
  });
  const jacket = build(spec("jacket")), kimono = build(spec("kimono"));
  const sleeveOffset = (gg: typeof jacket) => {
    let total = 0, n = 0;
    for (let i = 0; i < gg.source.length; i++) {
      const v = gg.source[i];
      if (v >= 0 && P.group[v] === 2 && P.arm[v] > .3 && P.arm[v] < .6) {
        total += Math.hypot(...[0, 1, 2].map(k => gg.position[i * 3 + k] - body.body[v * 3 + k])); n++;
      }
    }
    return total / n;
  };
  expect(sleeveOffset(kimono)).toBeGreaterThan(sleeveOffset(jacket) + .01);
  for (const sub of ["cardigan", "kimono", "blazer"]) {
    const outer = spec(sub), tee = build(spec("t_shirt")), beforeAlpha = tee.alpha.slice();
    // The continuous hem envelope must not bridge the open front back together.
    const outerMesh = build(outer);
    let openHem = 0;
    for (let i = 0; i < outerMesh.source.length; i++) {
      if (outerMesh.source[i] < 0 && Math.abs(outerMesh.position[i * 3]) < .012 && outerMesh.position[i * 3 + 2] > P.torsoZ) {
        openHem++; expect(outerMesh.alpha[i], sub).toBeLessThan(.5);
      }
    }
    expect(openHem, sub).toBeGreaterThan(0);
    occludeInnerGarment(tee, body, P, [outer]);
    let visibleCentre = 0, coveredSide = 0;
    for (let i = 0; i < tee.source.length; i++) {
      const v = tee.source[i]; if (v < 0 || beforeAlpha[i] < .5 || P.group[v] !== 1 || P.h[v] < .35 || P.h[v] > .65 || body.body[v * 3 + 2] <= P.torsoZ) continue;
      if (Math.abs(body.body[v * 3]) < .012 && tee.alpha[i] > .5) visibleCentre++;
      if (Math.abs(body.body[v * 3]) > .08 && tee.alpha[i] < .5) coveredSide++;
    }
    expect(visibleCentre, sub).toBeGreaterThan(2);
    expect(coveredSide, sub).toBeGreaterThan(5);
    const closed = { ...outer, frontOpening: 0 }, closedMask = coverageOf(body, P, closed), openMask = coverageOf(body, P, outer);
    expect(openMask.reduce((sum, v) => sum + v, 0)).toBeLessThan(closedMask.reduce((sum, v) => sum + v, 0));
  }
  const bodysuit = build(spec("bodysuit"));
  occludeInnerGarment(bodysuit, body, P, [specFor({ subcategory: "jeans" })!]);
  let tuckedHem = 0;
  for (let i = 0; i < bodysuit.source.length; i++) if (bodysuit.source[i] < 0) {
    tuckedHem++; expect(bodysuit.alpha[i]).toBeLessThan(.5);
  }
  expect(tuckedHem).toBeGreaterThan(0);
  expect(body.body).toEqual(before);
  if (process.env.UPPERWEAR_REPORT) writeFileSync(`${process.env.UPPERWEAR_REPORT}-${sex}.json`, JSON.stringify({ sex, scope: "Local parametric models, not manufacturer fit certification", report }, null, 2));
}, 60000);
