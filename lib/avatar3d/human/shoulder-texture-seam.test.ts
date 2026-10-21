import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { baseNormals, buildHuman } from "./three-human";
import { applyRestPose, setArmOut } from "./pose";
import { bodyParam, collarBand, posedPositions, texturedGeometry } from "./garments";
import { specFor } from "./garment-fit";
import { buildGarment, softBodyOf } from "./dress";
import { DEFAULT_BODY } from "../body-spec";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

it("keeps the shirt collar thin and independent of oversized chest ease", () => {
  const c = compose(asset, fitBody(asset, { sex: "FEMININO" }).z, null, DEFAULT_BODY.FEMININO.stature), P = bodyParam(asset, c);
  const sp = specFor({ category: "upper_piece", subcategory: "shirt" })!;
  const normal = collarBand(asset, c, P, { ...sp, ease: .006 })!;
  const oversized = collarBand(asset, c, P, { ...sp, ease: .04 })!;
  expect(oversized.position).toEqual(normal.position);
  for (let j = 0; j < 72; j++) {
    const outer = j * 3, inner = (216 + j) * 3;
    expect(Math.hypot(normal.position[outer] - normal.position[inner], normal.position[outer + 2] - normal.position[inner + 2])).toBeCloseTo(.003, 5);
  }
});

it.each(["shirt", "coat", "hoodie", "jacket"])("%s shoulder triangles interpolate one photo panel while the sleeve keeps its independent fabric", subcategory => {
  for (const sex of ["FEMININO", "MASCULINO"] as const) {
    const c = compose(asset, fitBody(asset, { sex }).z, null, DEFAULT_BODY[sex].stature);
    const human = buildHuman(asset, c, { skin: "#c99a6e" }), pose = applyRestPose(human);
    const normals = baseNormals(c.body, asset.body.index, asset.body.renderVertex), P = bodyParam(asset, c);
    const gg = buildGarment(asset, c, softBodyOf(asset, c), normals, P, specFor({ category: "upper_piece", subcategory })!, []).gg!;
    const sleeve = (v: number) => gg.source[v] >= 0 && P.group[gg.source[v]] === 2;
    const photo = { width: 100, height: 100, box: { x0: 0, y0: 0, x1: 100, y1: 100 }, collarRow: null, neckDrop: null, cutout: true, backdrop: null, widthAt: () => ({ x0: 0, x1: 100 }) };
    for (const angle of [0, .35]) {
      setArmOut(human, pose, angle);
      const posed = posedPositions(human.skeleton, human.body.bindMatrix, gg.position, gg.skinIndex, gg.skinWeight, human.body);
      const mesh = texturedGeometry(gg, posed, photo, sleeve), uv = mesh.getAttribute("uv"), fabric = mesh.getAttribute("fabricUv"), weights = mesh.getAttribute("photoWeight");
      const ids = mesh.index!.array; let joins = 0;
      for (let t = 0; t < ids.length; t += 3) {
        const vs = [ids[t], ids[t + 1], ids[t + 2]];
        if (!vs.some(v => weights.getX(v) > .1) || !vs.some(v => weights.getX(v) === 0)) continue;
        joins++;
        // The raster atlas divider is u=.5. Crossing it within one triangle
        // samples unrelated pixels and causes the diagonal shoulder crack.
        for (const v of vs) { expect(uv.getX(v)).toBeLessThan(.5); expect(fabric.getX(v)).toBeGreaterThan(.5); }
      }
      expect(joins).toBeGreaterThan(5);
      mesh.dispose();
    }
    human.dispose();
  }
});
