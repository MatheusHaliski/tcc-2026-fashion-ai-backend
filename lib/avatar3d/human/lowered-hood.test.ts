import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { bodyParam, garmentGeometry, SPECS } from "./garments";
import { baseNormals } from "./three-human";
import { garmentTrims, loweredHood } from "./garment-trims";
import { DEFAULT_BODY } from "../body-spec";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

function fixture(sex: "FEMININO" | "MASCULINO", stature = DEFAULT_BODY[sex].stature) {
  const c = compose(asset, fitBody(asset, { sex }).z, null, stature);
  const P = bodyParam(asset, c), normals = baseNormals(c.body, asset.body.index, asset.body.renderVertex);
  const gg = garmentGeometry(asset, c, normals, P, SPECS.hoodie)!;
  return { c, P, gg, normals };
}

describe("estimated lowered hoodie hood", () => {
  it.each(["FEMININO", "MASCULINO"] as const)("rests behind the fitted upper back and below the head in %s", sex => {
    const { c, P, gg, normals } = fixture(sex);
    const hood = loweredHood(asset, c, P, gg)!;
    expect(hood?.part).toBe("capuz");
    expect(hood.position.length / 3).toBeGreaterThan(1000);
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    const torso = Array.from(P.group.keys()).filter(v => P.group[v] === 1 && c.body[v * 3 + 2] < P.torsoZ);
    for (let v = 0; v < hood.position.length / 3; v++) {
      const x = hood.position[v * 3], y = hood.position[v * 3 + 1], z = hood.position[v * 3 + 2];
      expect(Number.isFinite(x + y + z)).toBe(true);
      expect(y).toBeLessThan(P.neckY - .01);
      expect(y).toBeGreaterThan(P.hipY + (P.neckY - P.hipY) * .5);
      expect(z).toBeLessThan(P.torsoZ - .015);
      let closest = -1, distance = Infinity;
      for (const body of torso) {
        const d = (c.body[body * 3] - x) ** 2 + (c.body[body * 3 + 1] - y) ** 2 + (c.body[body * 3 + 2] - z) ** 2;
        if (d < distance) { closest = body; distance = d; }
      }
      const signed = (x - c.body[closest * 3]) * normals[closest * 3]
        + (y - c.body[closest * 3 + 1]) * normals[closest * 3 + 1]
        + (z - c.body[closest * 3 + 2]) * normals[closest * 3 + 2];
      expect(signed).toBeGreaterThan(-.002);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      // No weight may attach the lowered bag to the head, arms, legs or fingers.
      let total = 0;
      for (let k = 0; k < 4; k++) {
        const weight = hood.skinWeight[v * 4 + k], index = hood.skinIndex[v * 4 + k];
        expect(weight).toBeGreaterThanOrEqual(0); expect(Number.isFinite(weight)).toBe(true); total += weight;
        if (weight > 0) expect(asset.meta.bones[index].name.replace("mixamorig:", "")).toMatch(/^(Spine\d*|Neck)$/);
      }
      expect(total).toBeCloseTo(1, 6);
    }
    expect(maxY - minY).toBeGreaterThan(.12);
    expect(maxX - minX).toBeGreaterThan(.16);
    // A complete hollow shell with a real lip, not a flat plane or raised head cover.
    const edges = new Map<string, number>();
    for (let i = 0; i < hood.index.length; i += 3) {
      const tri = Array.from(hood.index.slice(i, i + 3));
      for (const index of tri) expect(index).toBeLessThan(hood.position.length / 3);
      const [a, b, d] = tri.map(index => Array.from(hood.position.slice(index * 3, index * 3 + 3)));
      const u = b.map((v, k) => v - a[k]), w = d.map((v, k) => v - a[k]);
      expect(Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0])).toBeGreaterThan(1e-9);
      for (let e = 0; e < 3; e++) {
        const key = [tri[e], tri[(e + 1) % 3]].sort((p, q) => p - q).join(":");
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    expect([...edges.values()].every(count => count === 2)).toBe(true);
  });

  it("scales with stature and retains the structural hood when photographic details are preserved", () => {
    const short = fixture("FEMININO", 1.5), tall = fixture("FEMININO", 1.95);
    const width = (p: Float32Array) => {
      const xs = Array.from({ length: p.length / 3 }, (_, v) => p[v * 3]);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(width(loweredHood(asset, tall.c, tall.P, tall.gg)!.position)).toBeGreaterThan(width(loweredHood(asset, short.c, short.P, short.gg)!.position));
    expect(garmentTrims(asset, short.c, short.P, short.gg, { preservePhotoDetails: true }).filter(trim => trim.part === "capuz")).toHaveLength(1);
    expect(loweredHood(asset, short.c, short.P, { ...short.gg, spec: SPECS.shirt })).toBeNull();
    expect(loweredHood(asset, short.c, short.P, { ...short.gg, spec: SPECS.sweater })).toBeNull();
    expect(loweredHood(asset, short.c, short.P, { ...short.gg, spec: SPECS.coat })).toBeNull();
  });
});
