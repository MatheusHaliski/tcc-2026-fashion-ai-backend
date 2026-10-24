// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import { I18nProvider } from "@/lib/i18n/i18n";
import { mount3d, serveBodyAsset, untilReady, frames } from "@/test-utils/three";
import { HumanAvatar, type HumanParts } from "./human-avatar";
import { photoPart, photoUrls } from "./human-outfit";
import { DEFAULT_BODY } from "@/lib/avatar3d/body-spec";
import type { Look3dPiece } from "./common";
const processing = vi.hoisted(() => ({ colors: [] as string[], resolve: null as null | ((v: null) => void) }));
vi.mock("@/components/three/common", async original => ({ ...await original<typeof import("./common")>(), loadTexture: async (url: string) => {
  if (!url.includes("pending-photo")) return null;
  const texture = new THREE.Texture(); texture.image = { width: 64, height: 80 }; return texture;
} }));
vi.mock("@/lib/avatar3d/human/garment-photo", async original => ({ ...await original<typeof import("@/lib/avatar3d/human/garment-photo")>(), prepareOutfitPhoto: () => new Promise<null>(resolve => { processing.resolve = resolve; }) }));
vi.mock("@/lib/avatar3d/human/garments", async original => {
  const actual = await original<typeof import("@/lib/avatar3d/human/garments")>();
  return { ...actual, garmentTexture: (...args: Parameters<typeof actual.garmentTexture>) => {
    processing.colors.push(args[1]);
    return actual.garmentTexture(...args);
  } };
});
afterEach(() => { processing.resolve?.(null); processing.resolve = null; processing.colors = []; vi.unstubAllGlobals(); });

it("wears cargo immediately while its photo is pending, retains it on failure and refits same-URL variants", async () => {
  await serveBodyAsset();
  let parts: HumanParts | null = null;
  const body = { sex: "FEMININO" as const };
  const hair = { present: false, color: "#332211", top: 10, side: 6, bottom: -4, fringe: .2, cut: false, length: "short" as const };
  const avatar = (pieces: Look3dPiece[]) => <HumanAvatar body={body} stature={DEFAULT_BODY.FEMININO.stature} skin="#c99a6e" pieces={pieces} motion={false} hair={hair} onReady={p => { parts = p; }} />;
  const update = (pieces: Look3dPiece[]) => r.update(<I18nProvider initial="pt-BR">{avatar(pieces)}</I18nProvider>);
  const r = await mount3d(avatar([{ id: "old-jeans", name: "Jeans", category: "lower_piece", subcategory: "jeans", slot: "lower", colorHex: "#112244" }]));
  await untilReady(() => !!parts?.human.root.userData.outfitReady);
  const cargo: Look3dPiece = { id: "cargo", name: "Cargo", category: "lower_piece", subcategory: "cargo", slot: "lower", colorHex: "#227744", imageUrl: "/pending-photo-cargo.png" };
  await update([cargo]); await frames(r, 1);
  const root = parts!.human.root;
  expect(root.getObjectByName("peca-cargo")).toBeTruthy();
  expect(root.getObjectByName("peca-old-jeans")).toBeUndefined();
  expect(root.userData.outfitReady).toBe(false);
  expect(processing.colors).toContain("#227744");
  await untilReady(() => !!processing.resolve);
  processing.resolve!(null);
  await untilReady(() => !!root.userData.outfitReady);
  expect(root.getObjectByName("peca-cargo")).toBeTruthy();
  expect(root.getObjectByName("peca-fai-padrao-lower")).toBeUndefined();
  const previous = root.getObjectByName("peca-cargo") as THREE.SkinnedMesh;
  await update([{ ...cargo, colorHex: "#cc4422", variation: "SKINNY" }]); await frames(r, 1);
  expect(root.getObjectByName("peca-cargo")).not.toBe(previous);
  expect(processing.colors).toContain("#cc4422");
  // All supported clothing zones use the same immediate-selection path, without requiring Mirror.
  for (const [category, subcategory, slot, name] of [
    ["upper_piece", "shirt", "upper", "Camisa"], ["upper_piece", "jacket", "outer_layer", "Jaqueta"],
    ["lower_piece", "shorts", "lower", "Shorts"], ["lower_piece", "skirt", "lower", "Saia"],
    ["full_body_piece", "dress", "dress", "Vestido"], ["shoes_piece", "casual_sneakers", "shoes", "Tênis"],
  ]) {
    const id = `selected-${subcategory}`;
    await update([{ id, name, category, subcategory, slot, colorHex: "#2277aa", imageUrl: "/missing.png" }]);
    await frames(r, 1);
    expect(root.userData.dressed, subcategory).toBe(true);
    expect(root.userData.garments.some((name: string) => name.endsWith(id)), subcategory).toBe(true);
    expect(root.getObjectByName("peca-cargo")).toBeUndefined();
  }
  await r.unmount();
}, 60000);

 it("isolates coats and jackets as upperwear, without keeping trousers and shoes", () => {
  expect(photoPart("coat")).toBe("upper");
  expect(photoPart("jacket")).toBe("upper");
  expect(photoPart("dress")).toBe("full");
  expect(photoPart("shorts")).toBe("lower");
});

it("prefers this product's server-isolated texture and never uses a displayed fabric crop as a raw photo", () => {
 const urls=photoUrls({id:"jeans",name:"Jeans",slot:"lower",catalogProductId:"catalog-jeans",imageUrl:"/unrelated-shoe.jpg",studioUrl:"/fabric-crop.jpg"});
 expect(urls).toEqual(["/api/catalog/products/catalog-jeans/texture-image?isolated=true","/api/catalog/products/catalog-jeans/texture-image"]);
});
