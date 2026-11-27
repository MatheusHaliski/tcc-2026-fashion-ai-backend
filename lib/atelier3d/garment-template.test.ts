// @vitest-environment jsdom
import { expect, it } from "vitest";
import * as THREE from "three";
import { buildGarmentTemplate, createGarmentTemplate, GARMENT_TEMPLATES, type GarmentTemplate } from "./garment-template";
import { disposeAsset, inspectGlb, loadGlb } from "./document";

it.each(GARMENT_TEMPLATES)("creates an editable embedded GLB for the %s prototype", async (kind) => {
  const bytes = await createGarmentTemplate(kind, "#2867ad");
  const root = inspectGlb(bytes);
  expect(bytes.byteLength).toBeLessThan(8 * 1024 * 1024);
  expect(root.asset.version).toBe("2.0");
  expect(root.images ?? []).toEqual([]);
  expect(root.skins ?? []).toEqual([]);
  const loaded = await loadGlb(bytes);
  try {
    expect(loaded.primitives.size).toBeGreaterThan(1);
    expect(loaded.baseline.nodes).not.toEqual({});
    const box = new THREE.Box3().setFromObject(loaded.gltf.scene);
    expect(box.getSize(new THREE.Vector3()).y).toBeGreaterThan(0.5);
    for (const mesh of loaded.primitives.values()) {
      const position = mesh.geometry.getAttribute("position");
      expect([...position.array].every(Number.isFinite)).toBe(true);
      expect((mesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("2867ad");
    }
  } finally { disposeAsset(loaded); }
});
it("marks prototypes as unrigged and uncertified instead of assigning a purchased garment size", () => {
  const group = buildGarmentTemplate("tee", "#0000ff");
  expect(group.userData).toEqual({ origin: "FAI_PROCEDURAL_PROTOTYPE", sizeCertified: false, rigged: false });
  expect(group.children.map((mesh) => mesh.name)).toContain("Neck opening");
  expect(group.children.every((mesh) => mesh instanceof THREE.Mesh)).toBe(true);
});
it("rejects unknown templates and malformed colors", async () => {
  await expect(createGarmentTemplate("unknown" as GarmentTemplate, "#0000ff")).rejects.toThrow("ATELIER_TEMPLATE_INPUT");
  await expect(createGarmentTemplate("tee", "red")).rejects.toThrow("ATELIER_TEMPLATE_INPUT");
});
