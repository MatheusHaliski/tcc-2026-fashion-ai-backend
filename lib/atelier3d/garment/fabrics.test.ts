// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createGarmentTemplate } from "../garment-template";
import { applyDocument, disposeAsset, EMPTY_DOCUMENT, exportGlb, inspectGlb, loadGlb } from "../document";
import { createSceneHistory, commitSceneEdit, travelSceneHistory } from "../history";
import { applyFabricPreset, FABRIC_LOOKS, fabricEdit, removeFabric, sanitizeFabric, updateFabric } from "./fabrics";
import { FABRIC_PRESETS, garmentOf, withGarment } from "./state";
import { weaveHeight, weaveNormalPixels } from "./weave";

describe("presets de tecido", () => {
  it("cada preset tem valores PBR válidos e uma trama conhecida", () => {
    for (const preset of FABRIC_PRESETS) {
      const look = FABRIC_LOOKS[preset];
      expect(look.color).toMatch(/^#[0-9a-f]{6}$/);
      for (const value of [look.roughness, look.metalness, look.sheen, look.clearcoat, look.transmission]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      expect(sanitizeFabric(fabricEdit(preset))).toEqual(fabricEdit(preset));
    }
    expect(FABRIC_LOOKS.sequin.metalness).toBeGreaterThan(0.5);
    expect(FABRIC_LOOKS.velvet.sheen).toBe(1);
    expect(FABRIC_LOOKS.cotton.metalness).toBe(0);
  });

  it("limita valores fora da faixa e recusa preset desconhecido", () => {
    const wild = { ...fabricEdit("silk"), sheen: 4, weaveScale: -3, sheenColor: "red", normalStrength: Number.NaN };
    expect(sanitizeFabric(wild)).toMatchObject({ sheen: 1, weaveScale: 1, sheenColor: "#ffffff", normalStrength: 0 });
    expect(() => fabricEdit("plastic" as never)).toThrow("ATELIER_FABRIC_PRESET");
  });

  it("aplica, ajusta e remove pelo documento, com desfazer/refazer do histórico", () => {
    const baseline = { ...EMPTY_DOCUMENT, materials: { "n0.p0": { color: "#ffffff", roughness: 1, metalness: 0, repeat: [1, 1] as [number, number], rotation: 0 } } };
    const denim = applyFabricPreset(EMPTY_DOCUMENT, ["n0.p0"], "denim", baseline);
    expect(denim.materials["n0.p0"]).toMatchObject({ color: "#3b5a86", roughness: 0.86 });
    expect(garmentOf(denim).fabrics["n0.p0"].weave).toBe("twill");
    const tuned = updateFabric(denim, ["n0.p0"], { weaveScale: 80, sheen: 0.5 });
    expect(garmentOf(tuned).fabrics["n0.p0"]).toMatchObject({ weaveScale: 80, sheen: 0.5 });
    expect(garmentOf(denim).fabrics["n0.p0"].weaveScale).toBe(36);
    let history = commitSceneEdit(createSceneHistory(EMPTY_DOCUMENT), denim);
    history = commitSceneEdit(history, tuned);
    history = travelSceneHistory(history, "undo");
    expect(history.doc).toBe(denim);
    history = travelSceneHistory(history, "redo");
    expect(history.doc).toBe(tuned);
    const removed = removeFabric(tuned, ["n0.p0"]);
    expect(removed.garment).toBeUndefined();
    expect(withGarment(EMPTY_DOCUMENT, () => ({}))).toEqual(EMPTY_DOCUMENT);
  });
});

describe("tramas procedurais", () => {
  it("o relevo repete sem emenda e o mapa normal é unitário", () => {
    for (const kind of ["plain", "twill", "knit", "grain", "satin", "pile", "mesh", "scale"] as const) {
      expect(weaveHeight(kind, 0.001, 0.3)).toBeCloseTo(weaveHeight(kind, 1.001, 0.3), 5);
      const pixels = weaveNormalPixels(kind, 32);
      for (let i = 0; i < pixels.data.length; i += 4 * 37) {
        const [x, y, z] = [0, 1, 2].map((c) => pixels.data[i + c] / 127.5 - 1);
        expect(Math.hypot(x, y, z)).toBeGreaterThan(0.95);
        expect(z).toBeGreaterThan(0);
      }
    }
  });
});

describe("material físico no GLB", () => {
  it("troca para MeshPhysicalMaterial, exporta KHR_materials_sheen/clearcoat e reabre com o tecido", async () => {
    const asset = await loadGlb(await createGarmentTemplate("tee", "#2867ad"));
    const keys = [...asset.primitives.keys()];
    let doc = applyFabricPreset(EMPTY_DOCUMENT, keys, "leather", asset.baseline);
    doc = updateFabric(doc, keys, { normalStrength: 0, sheen: 0.4, sheenColor: "#ffffff", sheenRoughness: 1 });
    applyDocument(asset, doc);
    const material = asset.primitives.get(keys[0])!.material as THREE.MeshPhysicalMaterial;
    expect(material.isMeshPhysicalMaterial).toBe(true);
    expect(material.clearcoat).toBeCloseTo(0.35);
    expect(material.sheen).toBe(1);
    expect(material.sheenColor.r).toBeCloseTo(0.4);
    expect("#" + material.color.getHexString()).toBe("#5a3220");
    const bytes = await exportGlb(asset, doc);
    const root = inspectGlb(bytes);
    expect(root.extensionsUsed).toEqual(expect.arrayContaining(["KHR_materials_sheen", "KHR_materials_clearcoat"]));
    const reopened = await loadGlb(bytes);
    const again = [...reopened.primitives.values()][0].material as THREE.MeshPhysicalMaterial;
    expect(again.sheenColor.r).toBeCloseTo(material.sheenColor.r);
    expect(again.sheenRoughness).toBeCloseTo(1);
    expect(again.clearcoat).toBeCloseTo(0.35);
    applyDocument(asset, EMPTY_DOCUMENT);
    expect((asset.primitives.get(keys[0])!.material as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial).toBeFalsy();
    disposeAsset(asset);
    disposeAsset(reopened);
  });
});
