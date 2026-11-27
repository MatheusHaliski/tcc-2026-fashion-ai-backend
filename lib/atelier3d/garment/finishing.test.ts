// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createGarmentTemplate } from "../garment-template";
import { applyDocument, disposeAsset, EMPTY_DOCUMENT, exportGlb, loadGlb } from "../document";
import { boundaryLoops, stitchRibbon } from "./stitches";
import { loopsOf } from "./extras";
import { addAccessory, addStitch, removeAccessory, removeStitch } from "./finishing";
import { garmentOf, GARMENT_LIMITS } from "./state";
import type { Vec3 } from "../document";

describe("bordas e pespontos", () => {
  it("um tubo aberto tem duas bordas (barra e topo), ordenadas pela altura", () => {
    const tube = new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 4, true);
    const original = Float32Array.from(tube.getAttribute("position").array);
    const loops = boundaryLoops(original, tube.index!.array);
    expect(loops).toHaveLength(2);
    expect(loops[0].height).toBeCloseTo(0);
    expect(loops[1].height).toBeCloseTo(1);
    expect(loops[0].closed).toBe(true);
    expect(loops[0].vertices).toHaveLength(16);
    const points = Array.from({ length: original.length / 3 }, (_, i) => [original[i * 3], original[i * 3 + 1], original[i * 3 + 2]] as Vec3);
    const ribbon = stitchRibbon(points, null, loops[0], 0.05, 0.05, 0.01);
    expect(ribbon.length % 18).toBe(0);
    expect(ribbon.length / 18).toBeGreaterThan(10);
    for (let i = 1; i < ribbon.length; i += 3) expect(ribbon[i]).toBeGreaterThan(-0.5 + 0.03);
  });

  it("pespontos e aviamentos no documento: limites, substituição na mesma borda e remoção", () => {
    let doc = addStitch(EMPTY_DOCUMENT, { primitive: "n1.p0", loop: 0, offset: 5, dash: 0.02, width: 0.004, color: "#ffffff" });
    expect(garmentOf(doc).stitches[0].offset).toBe(0.2);
    doc = addStitch(doc, { primitive: "n1.p0", loop: 0, offset: 0.03, dash: 0.02, width: 0.004, color: "#000000" });
    expect(garmentOf(doc).stitches).toHaveLength(1);
    expect(removeStitch(doc, garmentOf(doc).stitches[0].id).garment).toBeUndefined();
    let trims = EMPTY_DOCUMENT;
    for (let i = 0; i < GARMENT_LIMITS.accessories; i++)
      trims = addAccessory(trims, { primitive: "n1.p0", kind: "button", position: [0, i, 0], normal: [0, 0, 1], size: 0.02, color: "#ffffff" });
    expect(() => addAccessory(trims, { primitive: "n1.p0", kind: "button", position: [0, 0, 0], normal: [0, 0, 1], size: 0.02, color: "#ffffff" })).toThrow("ATELIER_COMMAND_LIMIT");
    expect(() => addAccessory(EMPTY_DOCUMENT, { primitive: "n1.p0", kind: "zipper" as never, position: [0, 0, 0], normal: [0, 0, 1], size: 0.02, color: "#ffffff" })).toThrow();
    expect(removeAccessory(trims, null).garment).toBeUndefined();
  });

  it("na camiseta, pesponto e botões viram malhas filhas exportadas no GLB e somem ao desfazer", async () => {
    const asset = await loadGlb(await createGarmentTemplate("tee", "#2867ad"));
    const body = [...asset.primitives.entries()].find(([, mesh]) => mesh.parent?.name === "Body" || mesh.name === "Body")?.[0] ?? [...asset.primitives.keys()][0];
    expect(loopsOf(asset, body).length).toBeGreaterThanOrEqual(2);
    let doc = addStitch(EMPTY_DOCUMENT, { primitive: body, loop: 0, offset: 0.03, dash: 0.02, width: 0.004, color: "#f4f1ea" });
    doc = addAccessory(doc, { primitive: body, kind: "button", position: [0, 0.4, 0.2], normal: [0, 0, 1], size: 0.03, color: "#222222" });
    doc = addAccessory(doc, { primitive: body, kind: "rivet", position: [0.1, 0.2, 0.2], normal: [0, 0, 1], size: 0.02, color: "#b8b2a6" });
    applyDocument(asset, doc);
    const names: string[] = [];
    asset.gltf.scene.traverse((o) => names.push(o.name));
    expect(names).toEqual(expect.arrayContaining(["FAI pesponto", "FAI botão", "FAI rebite"]));
    const reopened = await loadGlb(await exportGlb(asset, doc));
    const again: string[] = [];
    reopened.gltf.scene.traverse((o) => again.push(o.name));
    expect(again.join(" ")).toMatch(/FAI_?pesponto/);
    expect(again.join(" ")).toMatch(/FAI_?bot/);
    applyDocument(asset, EMPTY_DOCUMENT);
    const after: string[] = [];
    asset.gltf.scene.traverse((o) => after.push(o.name));
    expect(after).not.toContain("FAI pesponto");
    disposeAsset(asset);
    disposeAsset(reopened);
  });
});
