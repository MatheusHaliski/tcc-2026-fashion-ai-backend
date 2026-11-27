// @vitest-environment jsdom
import { expect, it } from "vitest";
import { createGarmentTemplate } from "./garment-template";
import { executeSceneCommand } from "./commands";
import { disposeAsset, EMPTY_DOCUMENT, exportGlb, loadGlb } from "./document";

it("smooths the generated tee across its floating-point UV seam and retains it in an exported GLB", async () => {
  const asset = await loadGlb(await createGarmentTemplate("tee", "#2867ad"));
  let reloaded: Awaited<ReturnType<typeof loadGlb>> | undefined;
  try {
    const [key, mesh] = [...asset.primitives].find(([, value]) => value.name === "Body")!;
    const original = asset.originalPositions.get(key)!;
    const uv = mesh.geometry.getAttribute("uv");
    const indices = Array.from(mesh.geometry.index!.array);
    const originalUv = Array.from(uv.array);
    const ring = Array.from({ length: original.length / 3 }, (_, i) => i)
      .filter(i => Math.abs(original[i * 3 + 1] - 0.35) < 1e-6);
    const start = ring.find(i => uv.getX(i) === 0)!;
    const end = ring.find(i => uv.getX(i) === 1)!;
    // Real LatheGeometry duplicates the seam with different floating-point coordinates.
    expect(Array.from(original.slice(start * 3, start * 3 + 3)))
      .not.toEqual(Array.from(original.slice(end * 3, end * 3 + 3)));
    const doc = executeSceneCommand(asset, EMPTY_DOCUMENT, { type: "smooth", primitive: key });
    const at = (i: number) => doc.vertices[key]?.[i] ?? Array.from(original.slice(i * 3, i * 3 + 3));
    expect(at(start)[1]).toBeLessThan(0.349);
    for (const i of ring) expect(at(i)[1]).toBeCloseTo(at(start)[1], 6);
    for (let axis = 0; axis < 3; axis++) expect(at(start)[axis]).toBeCloseTo(at(end)[axis], 8);
    // Open neckline and hem stay fixed; UV and index data must not be welded destructively.
    for (let i = 0; i < original.length / 3; i++) {
      if (uv.getY(i) === 0 || uv.getY(i) === 1) {
        expect(at(i)).toEqual(Array.from(original.slice(i * 3, i * 3 + 3)));
      }
    }
    expect(Array.from(mesh.geometry.getAttribute("position").array)).toEqual(Array.from(original));
    reloaded = await loadGlb(await exportGlb(asset, doc));
    const result = [...reloaded.primitives.values()].find(value => value.name === "Body")!;
    const position = result.geometry.getAttribute("position");
    for (const i of ring) expect(position.getY(i)).toBeCloseTo(at(start)[1], 6);
    for (let axis = 0; axis < 3; axis++) {
      expect(position.getComponent(start, axis)).toBeCloseTo(position.getComponent(end, axis), 8);
    }
    expect(Array.from(result.geometry.getAttribute("uv").array)).toEqual(originalUv);
    expect(Array.from(result.geometry.index!.array)).toEqual(indices);
  } finally {
    disposeAsset(asset);
    if (reloaded) disposeAsset(reloaded);
  }
});
