// @vitest-environment jsdom
import { expect, it } from "vitest";
import * as THREE from "three";
import {
  BASE_PIECE_CATEGORIES, BASE_PIECE_VERSION, basePieceKey, basePieceStaticUrl, buildBasePiece, createBasePiece, isBasePieceKey, loadBasePiece, resolveBasePiece,
} from "./base-pieces";
import { disposeAsset, inspectGlb, loadGlb } from "./document";

const ALL = Object.entries(BASE_PIECE_CATEGORIES).flatMap(([category, list]) => list.map((subcategory) => [category, subcategory] as const));

it.each(ALL)("builds an editable base GLB for %s/%s", async (category, subcategory) => {
  const bytes = await createBasePiece(category, subcategory, "#2867ad");
  const root = inspectGlb(bytes);
  expect(bytes.byteLength).toBeLessThan(8 * 1024 * 1024);
  expect(root.asset.version).toBe("2.0");
  expect(root.images ?? []).toEqual([]);
  expect(root.skins ?? []).toEqual([]);
  expect(root.animations ?? []).toEqual([]);
  const loaded = await loadGlb(bytes);
  try {
    expect(loaded.primitives.size).toBeGreaterThan(1);
    const box = new THREE.Box3().setFromObject(loaded.gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(0.02);
    expect(size.y).toBeGreaterThan(0.01);
    expect(size.length()).toBeLessThan(3);
    expect(box.min.y).toBeGreaterThan(-0.05);
    for (const mesh of loaded.primitives.values()) {
      expect(mesh.name).not.toBe("");
      const position = mesh.geometry.getAttribute("position");
      expect([...position.array].every(Number.isFinite)).toBe(true);
    }
  } finally { disposeAsset(loaded); }
});
it("names parts so the editor can customize each one and never claims rig or certified size", () => {
  const hoodie = buildBasePiece("upper_piece", "hoodie", "#112233");
  expect(hoodie.userData).toMatchObject({ origin: "FAI_BASE_PIECE", sizeCertified: false, rigged: false, subcategory: "hoodie", version: BASE_PIECE_VERSION });
  const names = hoodie.children.map((mesh) => mesh.name);
  expect(names).toEqual(expect.arrayContaining(["Body", "Sleeve left", "Sleeve right", "Hood", "Pocket"]));
  expect(buildBasePiece("shoes_piece", "boots", "#112233").children.map((m) => m.name)).toEqual(expect.arrayContaining(["Sole", "Shaft"]));
  expect(buildBasePiece("accessory_piece", "sunglasses", "#112233").children.length).toBeGreaterThan(2);
});
it("falls back to the category default when the subcategory has no base yet", () => {
  expect(resolveBasePiece("upper_piece", "unknown_thing")).toEqual({ category: "upper_piece", subcategory: "t_shirt" });
  expect(resolveBasePiece("SHOES_PIECE", "Boots")).toEqual({ category: "shoes_piece", subcategory: "boots" });
  expect(resolveBasePiece("nope", "hoodie")).toBeNull();
  expect(resolveBasePiece(null, null)).toBeNull();
  expect(() => buildBasePiece("nope", "hoodie", "#000000")).toThrow("ATELIER_TEMPLATE_INPUT");
  expect(() => buildBasePiece("upper_piece", "hoodie", "blue")).toThrow("ATELIER_TEMPLATE_INPUT");
});
it("identifies base keys and static urls", () => {
  expect(basePieceKey("hoodie")).toBe(`template:hoodie@${BASE_PIECE_VERSION}`);
  expect(isBasePieceKey("template:hoodie@1")).toBe(true);
  expect(isBasePieceKey("https://cdn/x.glb")).toBe(false);
  expect(isBasePieceKey(null)).toBe(false);
  expect(basePieceStaticUrl("boots")).toBe("/garment-templates/boots.glb");
});
it("prefers a published GLB for the subcategory and falls back to the procedural base", async () => {
  const published = await createBasePiece("upper_piece", "t_shirt", "#ff0000");
  const fetchFn = (async (url: RequestInfo | URL) => {
    if (String(url) === "/garment-templates/hoodie.glb") return new Response(published, { status: 200 });
    if (String(url) === "/garment-templates/coat.glb") return new Response("<html>not a glb</html>", { status: 200 });
    return new Response(null, { status: 404 });
  }) as typeof fetch;
  const fromStatic = await loadBasePiece("upper_piece", "hoodie", "#0000ff", fetchFn);
  expect(fromStatic).toMatchObject({ source: "STATIC_GLB", subcategory: "hoodie" });
  expect(fromStatic.bytes.byteLength).toBe(published.byteLength);
  expect(await loadBasePiece("upper_piece", "coat", "#0000ff", fetchFn)).toMatchObject({ source: "PROCEDURAL", subcategory: "coat" });
  expect(await loadBasePiece("upper_piece", "jacket", "#0000ff", fetchFn)).toMatchObject({ source: "PROCEDURAL", subcategory: "jacket" });
  const broken = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
  expect(await loadBasePiece("lower_piece", "jeans", "#0000ff", broken)).toMatchObject({ source: "PROCEDURAL", subcategory: "jeans" });
  await expect(loadBasePiece("nope", "jeans", "#0000ff", broken)).rejects.toThrow("ATELIER_TEMPLATE_INPUT");
});
