import { describe, expect, it } from "vitest";
import { garmentPhotoKey, garmentPhotoUrls, isIsolatedCatalogPhoto } from "./garment-photo-source";
import type { Look3dPiece } from "@/components/three/common";

const piece: Look3dPiece = { id: "c:shirt", name: "Camisa", slot: "upper", category: "upper_piece", subcategory: "shirt",
  catalogProductId: "shirt", catalogVariantId: "red", catalogImageId: "red-front", textureRevision: "sha-v2",
  imageUrl: "/raw-model.jpg", studioUrl: "/fabric.jpg" };

describe("product photograph identity in the 3D transport", () => {
  it("requests this exact variant and image, without substituting a fabric card or unchecked model photo", () => {
    const urls = garmentPhotoUrls(piece);
    expect(urls).toHaveLength(2);
    for (const url of urls) {
      const parsed = new URL(url, "https://fai.invalid");
      expect(parsed.pathname).toBe("/api/catalog/products/shirt/texture-image");
      expect(parsed.searchParams.get("variantId")).toBe("red");
      expect(parsed.searchParams.get("imageId")).toBe("red-front");
      expect(parsed.searchParams.get("v")).toBe("sha-v2:0");
    }
    expect(isIsolatedCatalogPhoto(piece, urls[0])).toBe(true);
    expect(isIsolatedCatalogPhoto(piece, urls[1])).toBe(false);
    expect(isIsolatedCatalogPhoto(piece, urls[0].replace("red-front", "other-image"))).toBe(false);
  });
  it("invalidates memory and HTTP caches for a new variant, new photo revision or explicit retry only", () => {
    const key = garmentPhotoKey("upper", piece);
    expect(garmentPhotoKey("upper", { ...piece, catalogVariantId: "green" })).not.toBe(key);
    expect(garmentPhotoKey("upper", { ...piece, textureRevision: "new-segmentation" })).not.toBe(key);
    expect(garmentPhotoKey("upper", piece, 1)).not.toBe(key);
    expect(garmentPhotoKey("upper", { ...piece, name: "Edited title" })).toBe(key);
    expect(garmentPhotoUrls(piece, 1)[0]).toContain("v=sha-v2%3A1");
    expect(isIsolatedCatalogPhoto(piece, garmentPhotoUrls(piece, 1)[0], 1)).toBe(true);
  });
  it("preserves local and wardrobe paths without adding query parameters to signed image URLs", () => {
    const wardrobe = { ...piece, catalogProductId: null, studioUrl: null, imageUrl: "https://storage.example/photo?signature=unchanged" };
    expect(garmentPhotoUrls(wardrobe, 2)).toEqual(["https://storage.example/photo?signature=unchanged"]);
    expect(isIsolatedCatalogPhoto(wardrobe, garmentPhotoUrls(wardrobe)[0])).toBe(false);
  });
});
