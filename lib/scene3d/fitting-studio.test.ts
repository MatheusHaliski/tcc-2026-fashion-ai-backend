import { describe, expect, it } from "vitest";
import { environmentFor, NEUTRAL_ENVIRONMENT } from "@/lib/tryon/fitting-room";
import { resolveScene, type SceneProduct } from "./scene";
import { resolveFittingStudio, STUDIO_PALETTE } from "./fitting-studio";
const product = (id: string, brand: string | null): SceneProduct => ({ id, name: id, category: "upper_piece", subcategory: "blazer", imageUrl: `/references/${id}.jpg`, brand: brand ? { name: brand } : null });

describe("conceptual fitting studio with deliberate photographic references", () => {
  it("keeps architecture and evaluation colours neutral for different brands", () => {
    const allSaints = resolveFittingStudio(environmentFor({ name: "AllSaints" }));
    const lacoste = resolveFittingStudio(environmentFor({ name: "Lacoste" }));
    expect(allSaints.interpretation).toBe("CONCEPTUAL");
    expect(allSaints.palette).toEqual(STUDIO_PALETTE); expect(lacoste.palette).toEqual(allSaints.palette);
    expect(lacoste.brand.key).not.toBe(allSaints.brand.key);
    expect(lacoste.brand.accent).not.toBe(allSaints.brand.accent);
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
