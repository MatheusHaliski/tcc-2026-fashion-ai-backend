import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody, landmarksOn } from "./compose";
import { baseNormals, buildHuman } from "./three-human";
import { browFibers, buildBrowFibers } from "./brows";
import { BROW_LINES, type AvatarBrows } from "../identity/brows";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const c = compose(asset, fitBody(asset, { sex: "FEMININO" }).z, null, 1.66);
const normals = baseNormals(c.body, asset.body.index, asset.body.renderVertex);
const brow: AvatarBrows = { color: "#3a241c", thickness: 0.22, arch: 0.15, shape: "SOFT_ARCH", density: 0.7, confidence: 0.8 };

describe("measured eyebrow fibers", () => {
  it("keeps unknown, occluded and nearly absent eyebrows in their original photograph", () => {
    expect(browFibers(asset, c, normals, null)).toBeNull();
    expect(browFibers(asset, c, normals, { ...brow, confidence: 0.2 })).toBeNull();
    expect(browFibers(asset, c, normals, { ...brow, density: 0.02 })).toBeNull();
  });

  it("uses measured color and density, with a sparse low-opacity layer over the atlas", () => {
    const sparse = browFibers(asset, c, normals, { ...brow, density: 0.2 })!;
    const full = browFibers(asset, c, normals, brow)!;
    expect(full.fibers).toBeGreaterThan(sparse.fibers * 1.5);
    expect(full.fibers).toBeGreaterThan(100); expect(full.fibers).toBeLessThanOrEqual(240);
    expect(full.index.length / 3).toBeLessThanOrEqual(1920);
    expect(full.opacity).toBeLessThan(0.4);
    const expected = new THREE.Color(brow.color);
    const average = [0, 1, 2].map((k) => Array.from(full.color).filter((_, i) => i % 3 === k).reduce((s, x) => s + x, 0) / (full.color.length / 3));
    expect(average[0]).toBeCloseTo(expected.r, 2); expect(average[1]).toBeCloseTo(expected.g, 2); expect(average[2]).toBeCloseTo(expected.b, 2);
    const golden = browFibers(asset, c, normals, { ...brow, color: "#b29b67" })!;
    expect(golden.color[0]).toBeGreaterThan(full.color[0] * 5);
  });

  it("follows each composed contour and stays around the eyebrows rather than the iris, nose or forehead", () => {
    const fibers = browFibers(asset, c, normals, brow)!;
    const lm = landmarksOn(asset, c.body);
    for (const side of ["right", "left"] as const) {
      const ids = [...BROW_LINES[side].upper, ...BROW_LINES[side].lower];
      const ys = ids.map((i) => lm[i * 3 + 1]), xs = ids.map((i) => lm[i * 3]);
      const points: number[] = [];
      for (let i = 0; i < fibers.position.length; i += 3) if (Math.sign(fibers.position[i]) === (side === "left" ? 1 : -1)) {
        points.push(i); expect(fibers.position[i]).toBeGreaterThan(Math.min(...xs) - 0.004); expect(fibers.position[i]).toBeLessThan(Math.max(...xs) + 0.004);
        expect(fibers.position[i + 1]).toBeGreaterThan(Math.min(...ys) - 0.004); expect(fibers.position[i + 1]).toBeLessThan(Math.max(...ys) + 0.004);
      }
      expect(points.length).toBeGreaterThan(100);
    }
    expect(Array.from(fibers.position).every(Number.isFinite)).toBe(true);
    expect(browFibers(asset, c, normals, brow)!.position).toEqual(fibers.position); // stable under rerender

    // Different-height brows in the photographed face must not be replaced by a symmetric template.
    const asymmetric = { ...c, body: Float32Array.from(c.body) };
    for (let i = 0; i < asymmetric.body.length; i += 3) if (asymmetric.body[i] > 0) asymmetric.body[i + 1] += 0.003;
    const shifted = browFibers(asset, asymmetric, normals, brow)!;
    expect(shifted.position.length).toBe(fibers.position.length);
    for (let i = 0; i < fibers.position.length; i += 3) expect(shifted.position[i + 1] - fibers.position[i + 1]).toBeCloseTo(fibers.position[i] > 0 ? 0.003 : 0, 5);
  });

  it("provides one lightweight mesh attached to the head, so it follows poses without changing the shared skin rig", () => {
    const h = buildHuman(asset, c, { skin: "#cba48a" });
    const group = buildBrowFibers(asset, c, normals, brow)!;
    h.bone("Head").add(group); h.root.updateMatrixWorld(true);
    expect(group.children).toHaveLength(1);
    const mesh = group.children[0] as THREE.Mesh, positions = mesh.geometry.getAttribute("position");
    const before = mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, 0));
    const expected = new THREE.Vector3().fromBufferAttribute(positions, 0);
    expect(before.distanceTo(expected)).toBeLessThan(1e-5);
    h.bone("Head").rotation.y = 0.3; h.root.updateMatrixWorld(true);
    expect(mesh.localToWorld(expected.clone()).distanceTo(before)).toBeGreaterThan(0.005);
    expect(typeof group.userData.dispose).toBe("function"); group.userData.dispose(); h.dispose();
  });
});
