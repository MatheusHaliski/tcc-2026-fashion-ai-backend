import { readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { baseNormals } from "./three-human";
import { bodyParam, type GarmentGeometry } from "./garments";
import { buildGarment, softBodyOf } from "./dress";
import { specFor } from "./garment-fit";
import { DEFAULT_BODY } from "../body-spec";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

it.each(["FEMININO", "MASCULINO"] as const)("constrói silhuetas inferiores distintas no corpo %s sem modificar a pele", sex => {
  const body = compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature);
  const before = body.body.slice(), normals = baseNormals(body.body, asset.body.index, asset.body.renderVertex);
  const P = bodyParam(asset, body), soft = softBodyOf(asset, body);
  const build = (subcategory: string, variation: string) => {
    const spec = specFor({ subcategory, variation })!;
    const gg = buildGarment(asset, body, soft, normals, P, spec, []).gg!;
    expect(gg).toBeTruthy();
    expect([...gg.position].every(Number.isFinite)).toBe(true);
    expect(body.body).toEqual(before);
    return gg;
  };
  // Actual lateral widths of one leg near the hem and knee, from the final generated geometry.
  const width = (gg: GarmentGeometry, from: number, to: number) => {
    const xs: number[] = [];
    for (let i = 0; i < gg.source.length; i++) {
      const v = gg.source[i];
      if (v >= 0 && P.group[v] === 3 && P.side[v] === 1 && P.leg[v] >= from && P.leg[v] <= to && gg.alpha[i] > .5) xs.push(gg.position[i * 3]);
    }
    expect(xs.length).toBeGreaterThan(10);
    return Math.max(...xs) - Math.min(...xs);
  };
  const measurements = Object.fromEntries(["STRAIGHT", "TAPERED", "BOOTCUT", "FLARE", "WIDE_LEG"].map(shape => {
    const gg = build("jeans", shape);
    return [shape, { hem: width(gg, .88, .97), knee: width(gg, .46, .52) }];
  }));
  expect(measurements.FLARE.hem).toBeGreaterThan(measurements.BOOTCUT.hem + .01);
  expect(measurements.BOOTCUT.hem).toBeGreaterThan(measurements.STRAIGHT.hem + .01);
  expect(measurements.TAPERED.hem).toBeLessThan(measurements.STRAIGHT.hem);
  expect(measurements.WIDE_LEG.hem).toBeGreaterThan(measurements.STRAIGHT.hem);
  const skirts = ["PENCIL", "STRAIGHT", "A_LINE"].map(shape => build("skirt", shape));
  const span = (gg: GarmentGeometry) => {
    const minY = Math.min(...Array.from(gg.position).filter((_, i) => i % 3 === 1));
    const xs: number[] = [];
    for (let i = 0; i < gg.position.length / 3; i++) if (gg.position[i * 3 + 1] < minY + .025 && gg.alpha[i] > .5) xs.push(gg.position[i * 3]);
    return Math.max(...xs) - Math.min(...xs);
  };
  expect(span(skirts[2])).toBeGreaterThan(span(skirts[0]) + .1);
  if (process.env.BOTTOMWEAR_REPORT) writeFileSync(`${process.env.BOTTOMWEAR_REPORT}-${sex}.json`, JSON.stringify({ sex, measurements, skirtHemWidths: skirts.map(span), scope: "Parametric local body asset; not real-world fit certification" }, null, 2));
}, 60000);
