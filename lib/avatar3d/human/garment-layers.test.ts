import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { DEFAULT_BODY } from "../body-spec";
import { baseNormals } from "./three-human";
import { SPECS, bodyParam, garmentGeometry, texturedGeometry, type GarmentSpec, type PhotoInfo } from "./garments";
import { occludeInnerGarment, visibleGarmentFinishes } from "./garment-layers";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
function garment(sex: "MASCULINO" | "FEMININO", spec: GarmentSpec) {
  const c = compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature);
  const P = bodyParam(asset, c), normals = baseNormals(c.body, asset.body.index, asset.body.renderVertex);
  return { c, P, gg: garmentGeometry(asset, c, normals, P, spec)! };
}

describe("visibility of inner fabric and separate finishes", () => {
  it("hiding trouser hips does not move the waistband or rescale the garment photo", () => {
    const { c, P, gg } = garment("MASCULINO", SPECS.pants);
    const photo: PhotoInfo = { width: 320, height: 500, box: { x0: 80, x1: 240, y0: 20, y1: 475 }, collarRow: null,
      widthAt: () => ({ x0: 80, x1: 240 }) };
    const visibleAlpha = gg.alpha.slice();
    occludeInnerGarment({ ...gg, alpha: visibleAlpha }, c, P, [SPECS.jacket]);
    const plain = texturedGeometry(gg, gg.position, photo);
    const layered = texturedGeometry(gg, gg.position, photo, undefined, visibleAlpha);
    expect(layered.getAttribute("uv").array).toEqual(plain.getAttribute("uv").array);
    expect(layered.userData.fabricMapping).toEqual(plain.userData.fabricMapping);
    const before = plain.getAttribute("color"), after = layered.getAttribute("color");
    let hidden = 0, visible = 0;
    for (let v = 0; v < after.count; v++) {
      if (before.getW(v) > 0.5 && after.getW(v) < 0.5) hidden++;
      if (after.getW(v) > 0.5) visible++;
    }
    expect(hidden).toBeGreaterThan(20); expect(visible).toBeGreaterThan(500);
    plain.dispose(); layered.dispose();
  });
  it.each(["MASCULINO", "FEMININO"] as const)("hides the tee sleeves and continuous hem under a blazer on %s", (sex) => {
    const { c, P, gg } = garment(sex, SPECS.tee);
    const before = gg.alpha.slice(); occludeInnerGarment(gg, c, P, [SPECS.jacket]);
    let sleeves = 0, hem = 0;
    for (let v = 0; v < gg.source.length; v++) {
      const src = gg.source[v];
      if (src < 0) { hem++; expect(gg.alpha[v]).toBeLessThan(0.5); }
      else if (P.group[src] === 2 && P.arm[src] > 0.05 && P.arm[src] < 0.30 && before[v] > 0.5) {
        sleeves++; expect(gg.alpha[v]).toBe(0);
      }
    }
    expect(sleeves).toBeGreaterThan(20); expect(hem).toBeGreaterThan(128);
    expect(visibleGarmentFinishes(SPECS.tee, [SPECS.jacket], P)).toEqual({ hem: false, cuff: false, collar: false });
  });

  it("keeps the neckline, longer tail and longer sleeves exposed by a shorter outer garment", () => {
    const inner = { ...SPECS.longsleeve, hem: -0.30 };
    const outer = { ...SPECS.jacket, hem: 0.3, sleeve: 0.3, vneck: 0.4 };
    const { c, P, gg } = garment("MASCULINO", inner);
    const before = gg.alpha.slice(); occludeInnerGarment(gg, c, P, [outer]);
    let cuff = 0, tail = 0, neck = 0, chest = 0;
    for (let v = 0; v < gg.source.length; v++) {
      const src = gg.source[v];
      if (src < 0) { tail++; expect(gg.alpha[v]).toBe(1); }
      else if (P.group[src] === 2 && P.arm[src] > 0.65) { cuff++; expect(gg.alpha[v]).toBe(before[v]); }
      else if (P.group[src] === 1 && P.h[src] > 0.75 && c.body[src * 3 + 2] > P.neckZ + 0.04 && Math.abs(c.body[src * 3]) < 0.04 && before[v] > 0.5) {
        neck++; expect(gg.alpha[v]).toBeGreaterThan(0.5);
      } else if (P.group[src] === 1 && P.h[src] > 0.4 && P.h[src] < 0.5) { chest++; expect(gg.alpha[v]).toBe(0); }
    }
    expect(cuff).toBeGreaterThan(20); expect(tail).toBeGreaterThan(128);
    expect(neck).toBeGreaterThan(0); expect(chest).toBeGreaterThan(20);
    expect(visibleGarmentFinishes(inner, [outer], P)).toEqual({ hem: true, cuff: true, collar: true });
  });

  it("leaves the modesty layer unchanged when no outer mesh was built or the candidate is underneath", () => {
    const { c, P, gg } = garment("FEMININO", SPECS.tee), before = gg.alpha.slice();
    occludeInnerGarment(gg, c, P, []); expect(gg.alpha).toEqual(before);
    occludeInnerGarment(gg, c, P, [SPECS.pants]); expect(gg.alpha).toEqual(before);
    expect(visibleGarmentFinishes(SPECS.tee, [], P)).toEqual({ hem: true, cuff: true, collar: true });
  });
  it("hides long inner cuffs and uses the actual length of a coat to cover the inner hem", () => {
    const { P } = garment("MASCULINO", SPECS.longsleeve);
    expect(visibleGarmentFinishes(SPECS.longsleeve, [SPECS.jacket], P).cuff).toBe(false);
    expect(visibleGarmentFinishes(SPECS.longsleeve, [SPECS.coat], P).hem).toBe(false);
    const belowCoat = { ...SPECS.longsleeve, hem: -SPECS.coat.skirt / (P.neckY - P.hipY) - 0.2 };
    expect(visibleGarmentFinishes(belowCoat, [SPECS.coat], P).hem).toBe(true);
  });
});
