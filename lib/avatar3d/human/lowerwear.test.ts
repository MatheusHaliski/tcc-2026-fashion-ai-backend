import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOWER_PROFILES } from "./lowerwear";
import { specFor } from "./garment-fit";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { baseNormals } from "./three-human";
import { bodyParam, texturedGeometry, type GarmentGeometry } from "./garments";
import { buildGarment, softBodyOf } from "./dress";
import { DEFAULT_BODY } from "../body-spec";
const taxonomy = JSON.parse(readFileSync(new URL("../../../fai-application/src/main/resources/taxonomy/taxonomy.json", import.meta.url), "utf8")) as { subcategories: { code: string; category: string; variations?: { code: string }[] }[] };
const lower = taxonomy.subcategories.filter(s => s.category === "lower_piece");
const spec = (subcategory: string, variation?: string, attributes?: Record<string, string[]>) => specFor({ category: "lower_piece", subcategory, variation, attributes })!;

describe("todas as subcategorias inferiores", () => {
  it("têm perfil explícito e specs válidos para toda a taxonomia sem mutar os padrões", () => {
    expect(Object.keys(LOWER_PROFILES).sort()).toEqual(lower.map(s => s.code).sort());
    for (const sub of lower) {
      const before = structuredClone(LOWER_PROFILES[sub.code]);
      for (const v of sub.variations ?? []) {
        const sp = spec(sub.code, v.code);
        expect(Number.isFinite(sp.waist), `${sub.code}/${v.code}`).toBe(true);
        expect(sp.ease).toBeGreaterThan(0); expect(sp.ease).toBeLessThanOrEqual(.05);
        expect(sp.leg > 0 || sp.skirt > 0).toBe(true);
      }
      expect(LOWER_PROFILES[sub.code]).toEqual(before);
    }
  });
  it("não afunila todo moletom e abre legging flare apenas abaixo do joelho", () => {
    expect(spec("sweatpants", "CUFFED_HEM").legCuff).toBe(true);
    for (const v of ["STRAIGHT", "WIDE_LEG", "FLARE", "PALAZZO", "BAGGY"]) expect(spec("sweatpants", v).legCuff, v).toBe(false);
    expect(spec("leggings", "FLARE")).toMatchObject({ legFlareStart: .52, legColumn: 1 });
    expect(spec("leggings", "SKINNY").legColumn).toBe(0);
    expect(spec("tailored_pants", "PALAZZO").legColumn).toBe(1.5);
    expect(spec("cargo_pants", "CUFFED_HEM").legCuff).toBe(true);
  });
  it("distingue comprimentos, biker e saias e preserva comprimento e cintura declarados", () => {
    expect(spec("bermuda_shorts").leg).toBeGreaterThan(spec("denim_shorts").leg);
    expect(spec("shorts", "BIKER").ease).toBeLessThan(spec("shorts").ease);
    expect(spec("skort").liningLeg).toBeGreaterThan(0);
    expect(spec("skirt", "CIRCLE").flare).toBeGreaterThan(spec("skirt", "A_LINE").flare);
    expect(spec("jogger_pants", "REGULAR", { LENGTH: ["CAPRI"], RISE: ["HIGH_RISE"] })).toMatchObject({ leg: .72, waist: .34 });
  });
});

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
it.each(["FEMININO", "MASCULINO"] as const)("gera as 14 famílias, punhos e forro no corpo %s sem modificar a pele", sex => {
  const body = compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature), before = body.body.slice();
  const normals = baseNormals(body.body, asset.body.index, asset.body.renderVertex), P = bodyParam(asset, body), soft = softBodyOf(asset, body);
  const build = (subcategory: string, variation?: string) => buildGarment(asset, body, soft, normals, P, spec(subcategory, variation), []).gg!;
  const report = lower.map(sub => {
    const gg = build(sub.code); expect(gg, sub.code).toBeTruthy();
    expect([...gg.position].every(Number.isFinite), sub.code).toBe(true);
    expect(gg.alpha.some(a => a > .5), sub.code).toBe(true);
    const photo = { width: 100, height: 100, box: { x0: 0, y0: 0, x1: 100, y1: 100 }, collarRow: null, neckDrop: null, cutout: true, backdrop: null, widthAt: () => ({ x0: 0, x1: 100 }) };
    const mesh = texturedGeometry(gg, gg.position, photo);
    expect([...mesh.getAttribute("photoWeight").array].some(w => w > .5), sub.code).toBe(true);
    mesh.dispose();
    return { subcategory: sub.code, waist: gg.spec.waist, leg: gg.spec.leg, skirt: gg.spec.skirt, cuff: !!gg.spec.legCuff, vertices: gg.source.length };
  });
  const width = (gg: GarmentGeometry, start: number, end: number) => {
    const x: number[] = [];
    for (let i = 0; i < gg.source.length; i++) { const v = gg.source[i]; if (v >= 0 && P.group[v] === 3 && P.side[v] === 1 && P.leg[v] >= start && P.leg[v] <= end && gg.alpha[i] > .5) x.push(gg.position[i * 3]); }
    expect(x.length).toBeGreaterThan(5);return Math.max(...x) - Math.min(...x);
  };
  const cuffed = build("sweatpants", "CUFFED_HEM"), straight = build("sweatpants", "STRAIGHT");
  expect(width(cuffed, .94, .97)).toBeLessThan(width(straight, .94, .97));
  const skort = build("skort");
  expect(skort.photoEligible?.some(v => v === 0)).toBe(true);
  const photo = { width: 100, height: 100, box: { x0: 0, y0: 0, x1: 100, y1: 100 }, collarRow: null, neckDrop: null, cutout: true, backdrop: null, widthAt: () => ({ x0: 0, x1: 100 }) };
  const mesh = texturedGeometry(skort, skort.position, photo), positions = mesh.getAttribute("position"), weights = mesh.getAttribute("photoWeight");
  const lining = new Set<string>();
  for (let v = 0; v < skort.source.length; v++) if (skort.photoEligible?.[v] === 0) lining.add(Array.from(skort.position.slice(v * 3, v * 3 + 3)).join(","));
  let liningVertices = 0;
  for (let i = 0; i < positions.count; i++) if (lining.has([positions.getX(i), positions.getY(i), positions.getZ(i)].join(","))) { liningVertices++; expect(weights.getX(i)).toBe(0); }
  expect(liningVertices).toBeGreaterThan(100);expect(Array.from(weights.array).some(v => v > .5)).toBe(true);mesh.dispose();
  expect(body.body).toEqual(before);
  if (process.env.LOWERWEAR_REPORT) writeFileSync(`${process.env.LOWERWEAR_REPORT}-${sex}.json`, JSON.stringify({ sex, scope: "Local estimated patterns, not brand certification", report, cuffHemWidth: width(cuffed, .94, .97), straightHemWidth: width(straight, .94, .97), estimatedLiningVertices: liningVertices }, null, 2));
}, 60000);
