import { brandKey, type BrandEnvironment } from "@/lib/tryon/fitting-room";
import type { SceneProduct, StoreScene } from "./scene";

/** No physical-store reference/assets are supplied by today's catalogue. Keep
 * the architecture explicitly conceptual and the clothing evaluation neutral.
 * Brand colour is used only in the identity plaque, never as an illuminant.
 */
export const STUDIO_PALETTE = {
  wall: "#ECE8E2", floor: "#BFB8AE", ceiling: "#F4F2EE", curtain: "#CFC6B8",
  furniture: "#685747", metal: "#55534F", ink: "#262522",
} as const;
export const STUDIO_OBJECTS = [
  { id: "shell", purpose: "circulation" }, // Neutral walls and matte floor
  { id: "identity", purpose: "communication" }, // One brand identity plaque
  { id: "curtain", purpose: "fitting" }, // Privacy curtain and horizontal rail
  { id: "mirror", purpose: "fitting" }, // Full-height mirror
  { id: "bench", purpose: "fitting" }, // Seat at ordinary furniture scale
  { id: "rail", purpose: "organization" }, // Hangers for the fitting area, without fake catalogue garments
  { id: "gallery", purpose: "communication" }, // At most two framed catalogue reference photographs
] as const;

export interface FittingStudioProfile {
  interpretation: "CONCEPTUAL";
  brand: BrandEnvironment;
  palette: typeof STUDIO_PALETTE;
  objects: typeof STUDIO_OBJECTS;
  photographs: SceneProduct[];
}

/** A brand change resolves a fresh gallery; never carry products of the previous
 * brand into a room. Unknown product brands are allowed only in the neutral room.
 */
export function resolveFittingStudio(brand: BrandEnvironment, scene?: StoreScene | null): FittingStudioProfile {
  const candidates = scene ? [...(scene.hero ? [scene.hero] : []), ...scene.display] : [];
  const seen = new Set<string>();
  const photographs = candidates.filter(product => {
    if (!product.imageUrl || seen.has(product.id)) return false;
    const key = product.brand?.slug || product.brand?.name;
    if (brand.key !== "neutral" && (!key || brandKey(key) !== brand.key)) return false;
    seen.add(product.id); return true;
  }).slice(0, 2);
  return { interpretation: "CONCEPTUAL", brand, palette: STUDIO_PALETTE, objects: STUDIO_OBJECTS, photographs };
}
