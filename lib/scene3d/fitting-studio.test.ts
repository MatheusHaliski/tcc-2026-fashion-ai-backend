import { describe, expect, it } from "vitest";
import { environmentFor, NEUTRAL_ENVIRONMENT } from "@/lib/tryon/fitting-room";
import { resolveScene, type SceneProduct } from "./scene";
import { isDarkWall, resolveFittingStudio, STUDIO_OBJECTS, STUDIO_PALETTE, wainscotOf } from "./fitting-studio";
const luminance = (hex: string) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) & 255) * .2126 + ((n >> 8) & 255) * .7152 + (n & 255) * .0722; };
const product = (id: string, brand: string | null): SceneProduct => ({ id, name: id, category: "upper_piece", subcategory: "blazer", imageUrl: `/references/${id}.jpg`, brand: brand ? { name: brand } : null });

describe("conceptual fitting studio with deliberate photographic references", () => {
  it("uses brand surfaces and preserves neutral floor and ceiling", () => {
    const allSaints = resolveFittingStudio(environmentFor({ name: "AllSaints" }));
    const lacoste = resolveFittingStudio(environmentFor({ name: "Lacoste" }));
    expect(allSaints.interpretation).toBe("CONCEPTUAL");
    for (const studio of [allSaints, lacoste]) {
      expect(studio.palette.wall).toBe(studio.brand.wall);
      expect(studio.palette.furniture).toBe(studio.brand.accent);
      expect(studio.palette.metal).toBe(studio.brand.accent);
      expect(studio.palette.floor).toBe(STUDIO_PALETTE.floor);
      expect(studio.palette.ceiling).toBe(STUDIO_PALETTE.ceiling);
      expect(studio.objects.some(object => String(object.id) === "curtain")).toBe(false);
    }
    expect(resolveFittingStudio(NEUTRAL_ENVIRONMENT).palette).toEqual(STUDIO_PALETTE);
    expect(lacoste.brand.key).not.toBe(allSaints.brand.key);
    expect(lacoste.brand.accent).not.toBe(allSaints.brand.accent);
  });
  it("paints the cabin in neutral finishes: two-tone wainscot from the wall, wood and hardware never take the brand accent", () => {
    // light lavender room with a green accent (a brand without a curated theme), a dark curated room and the neutral one
    const light = resolveFittingStudio(environmentFor({ name: "Bruma" })), dark = resolveFittingStudio(environmentFor({ name: "Nike" }));
    expect(isDarkWall(light.brand.wall)).toBe(false); expect(isDarkWall(dark.brand.wall)).toBe(true);
    for (const studio of [light, dark, resolveFittingStudio(NEUTRAL_ENVIRONMENT)]) {
      const p = studio.palette;
      for (const key of ["wainscot", "trim", "wood", "hardware", "fabric"] as const) expect(p[key], key).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.wainscot).toBe(wainscotOf(p.wall));
      for (const key of ["wood", "hardware", "trim", "wainscot"] as const) expect(p[key], key).not.toBe(studio.brand.accent);
    }
    // the lower band is darker on a light wall and lighter on a dark one (8–10 % of lightness, same hue family)
    expect(luminance(light.palette.wainscot)).toBeLessThan(luminance(light.palette.wall));
    expect(luminance(dark.palette.wainscot)).toBeGreaterThan(luminance(dark.palette.wall));
    expect(wainscotOf("#F0EAF0")).toBe("#DDCFDD");
    // upholstery follows the brand floor tone; the dark room gets dark trim and walnut
    expect(light.palette.fabric).toBe(light.brand.floor);
    expect(dark.palette.trim).not.toBe(light.palette.trim); expect(dark.palette.wood).not.toBe(light.palette.wood);
  });
  it("lists every cabin object with a purpose and still no curtain", () => {
    const ids = STUDIO_OBJECTS.map(object => object.id as string);
    for (const id of ["door", "wainscot", "hooks", "stool", "art", "rug", "plant", "fixtures"]) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const object of STUDIO_OBJECTS) expect(["circulation", "communication", "fitting", "organization", "ambience"]).toContain(object.purpose);
    expect(ids).not.toContain("curtain");
  });
  it("displays the selected photograph first and at most one additional reference", () => {
    const products = [product("a", "AllSaints"), product("b", "AllSaints"), product("c", "AllSaints")];
    const scene = resolveScene({ brand: { name: "AllSaints" }, product: products[1], results: products });
    expect(resolveFittingStudio(scene.brand, scene).photographs.map(p => p.id)).toEqual(["b", "a"]);
  });
  it("discards stale products and unknown provenance when the selected brand changes", () => {
    const products = [product("a", "AllSaints"), product("b", "Lacoste"), product("unknown", null)];
    const before = resolveScene({ brand: { name: "AllSaints" }, product: products[0], results: products });
    const after = resolveScene({ brand: { name: "Lacoste" }, product: products[0], results: products });
    expect(resolveFittingStudio(before.brand, before).photographs.map(p => p.id)).toEqual(["a"]);
    expect(resolveFittingStudio(after.brand, after).photographs.map(p => p.id)).toEqual(["b"]);
  });
  it("allows mixed-brand references only in the neutral studio and never repeats a product", () => {
    const p = product("a", "AllSaints"), q = product("b", null);
    const scene = resolveScene({ product: p, results: [p, p, q] });
    expect(resolveFittingStudio(NEUTRAL_ENVIRONMENT, scene).photographs.map(p => p.id)).toEqual(["a", "b"]);
  });
  it("keeps missing photos out of the gallery instead of substituting fake product volumes", () => {
    const p = { ...product("a", "Lacoste"), imageUrl: null };
    const scene = resolveScene({ brand: { name: "Lacoste" }, product: p });
    expect(resolveFittingStudio(scene.brand, scene).photographs).toEqual([]);
  });
});
