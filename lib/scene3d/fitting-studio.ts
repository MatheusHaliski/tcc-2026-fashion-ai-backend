import { brandKey, type BrandEnvironment } from "@/lib/tryon/fitting-room";
import type { SceneProduct, StoreScene } from "./scene";

/** No physical-store reference/assets are supplied by today's catalogue. Keep
 * the architecture explicitly conceptual and the clothing evaluation neutral.
 * Brand colours personalize surfaces; illumination remains neutral.
 */
const hexRgb = (hex: string) => { const n = parseInt(hex.replace("#", "").slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255); };
/** Relative luminance (sRGB): below .25 the room is a dark one (trim and wainscot invert). */
export function isDarkWall(hex: string): boolean {
  const [r, g, b] = hexRgb(hex).map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b < .25;
}
/** Two-tone paint: the wall colour with its HSL lightness shifted by `amount` — darker on light walls, lighter on dark ones. */
export function wainscotOf(wall: string, amount = .09): string {
  const [r, g, b] = hexRgb(wall), max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0; const l0 = (max + min) / 2, s = d ? d / (1 - Math.abs(2 * l0 - 1)) : 0;
  if (d) h = ((max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4) + 6) % 6;
  const l = Math.min(1, Math.max(0, l0 + (isDarkWall(wall) ? amount : -amount))), c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(h % 2 - 1)), m = l - c / 2;
  const [r1, g1, b1] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return "#" + [r1, g1, b1].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}
const WALL = "#ECE8E2";
/** `furniture`/`metal` follow the brand accent but only for small details (cushion piping, sign underline); large
 * surfaces use the neutral `wood`, `hardware`, `trim`, `wainscot` and `fabric` so the accent never dominates the room. */
export const STUDIO_PALETTE = {
  wall: WALL, floor: "#BFB8AE", ceiling: "#F4F2EE", curtain: "#CFC6B8",
  furniture: "#685747", metal: "#55534F", ink: "#262522",
  wainscot: wainscotOf(WALL), trim: "#F7F4EE", wood: "#B8946C", hardware: "#9E9A93", fabric: "#CFC6B8",
} as const;
export const STUDIO_OBJECTS = [
  { id: "shell", purpose: "circulation" }, // Four walls (the one facing the camera is cut away) and matte floor
  { id: "identity", purpose: "communication" }, // One brand identity plaque
  { id: "mirror", purpose: "fitting" }, // Full-height mirror
  { id: "bench", purpose: "fitting" }, // Seat at ordinary furniture scale
  { id: "rail", purpose: "organization" }, // Hangers for the fitting area, without fake catalogue garments
  { id: "gallery", purpose: "communication" }, // At most two framed catalogue reference photographs
  { id: "door", purpose: "circulation" }, // Closed cabin door on the front wall, with a robe hook and an empty hanger
  { id: "wainscot", purpose: "ambience" }, // Two-tone paint, chair rail, baseboard and panel mouldings on every wall
  { id: "hooks", purpose: "organization" }, // Three-hook rail beside the door with empty hangers
  { id: "stool", purpose: "fitting" }, // Upholstered bench and pouf to sit while changing shoes
  { id: "art", purpose: "ambience" }, // One abstract framed print in the brand tints (no catalogue photo repeated)
  { id: "rug", purpose: "fitting" }, // Rug marking where to stand
  { id: "plant", purpose: "ambience" }, // Potted plant in the corner (skipped on weak phones)
  { id: "fixtures", purpose: "communication" }, // Lightbox fitting-room sign and ceiling spots faked with emissive surfaces (no extra lights)
] as const;

export interface FittingStudioProfile {
  interpretation: "CONCEPTUAL";
  brand: BrandEnvironment;
  palette: { [K in keyof typeof STUDIO_PALETTE]: string };
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
  const dark = isDarkWall(brand.wall);
  const palette = brand.key === "neutral" ? { ...STUDIO_PALETTE } : {
    ...STUDIO_PALETTE, wall: brand.wall, furniture: brand.accent, metal: brand.accent,
    wainscot: wainscotOf(brand.wall), trim: dark ? "#2A2D33" : STUDIO_PALETTE.trim, wood: dark ? "#6E5440" : STUDIO_PALETTE.wood, fabric: brand.floor,
  };
  return { interpretation: "CONCEPTUAL", brand, palette, objects: STUDIO_OBJECTS, photographs };
}
