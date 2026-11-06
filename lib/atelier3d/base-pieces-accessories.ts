import type { PartKit } from "./base-pieces-primitives";

export const ACCESSORY_SUBCATEGORIES = ["handbag", "tote_bag", "clutch", "backpack", "crossbody_bag", "belt", "cap", "hat", "beanie", "scarf", "tie", "bow_tie", "sunglasses", "eyeglasses", "necklace", "bracelet", "earrings", "ring", "watch", "wallet", "gloves", "socks", "hair_accessory"] as const;

/** Acessórios: formas simples com ponto de fixação explícito (alça, aro, haste) para o editor ajustar. */
export function buildAccessory(parts: PartKit, subcategory: string) {
  switch (subcategory) {
    case "handbag": { parts.box("Bag body", [0.32, 0.22, 0.12], [0, 0.11, 0]); for (const side of [-1, 1]) parts.torus(side < 0 ? "Handle left" : "Handle right", 0.09, 0.008, [side * 0.06, 0.22, 0], parts.accent, Math.PI); return; }
    case "tote_bag": { parts.box("Bag body", [0.36, 0.36, 0.12], [0, 0.18, 0]); for (const side of [-1, 1]) parts.torus(side < 0 ? "Handle left" : "Handle right", 0.12, 0.008, [side * 0.1, 0.36, 0], parts.accent, Math.PI); return; }
    case "clutch": parts.box("Clutch body", [0.26, 0.14, 0.03], [0, 0.07, 0]); parts.box("Flap", [0.26, 0.07, 0.006], [0, 0.11, 0.018], parts.accent); return;
    case "backpack": { parts.box("Backpack body", [0.3, 0.4, 0.16], [0, 0.2, 0]); parts.box("Front pocket", [0.22, 0.14, 0.04], [0, 0.12, 0.1], parts.accent); for (const side of [-1, 1]) parts.box(side < 0 ? "Shoulder strap left" : "Shoulder strap right", [0.05, 0.36, 0.02], [side * 0.09, 0.2, -0.09], parts.accent); return; }
    case "crossbody_bag": parts.box("Bag body", [0.22, 0.16, 0.07], [0, 0.08, 0]); parts.torus("Strap", 0.3, 0.006, [0, 0.16, 0], parts.accent, Math.PI); return;
    case "belt": parts.torus("Belt strap", 0.42, 0.018, [0, 0.42, 0], parts.material).rotation.x = Math.PI / 2; parts.box("Buckle", [0.05, 0.04, 0.012], [0, 0.42, 0.43], parts.accent); return;
    case "cap": parts.sphere("Crown", 0.11, [0, 0.11, 0], parts.material, [1, 0.8, 1]); parts.box("Brim", [0.16, 0.006, 0.12], [0, 0.11, 0.14], parts.accent); return;
    case "hat": parts.tube("Crown", 0.1, 0.11, [0, 0.055, 0], parts.material, 0.09); parts.torus("Brim", 0.15, 0.01, [0, 0.0, 0], parts.accent).rotation.x = Math.PI / 2; parts.box("Hat band", [0.21, 0.03, 0.21], [0, 0.03, 0], parts.accent); return;
    case "beanie": parts.sphere("Crown", 0.115, [0, 0.115, 0], parts.material, [1, 1.1, 1]); parts.torus("Fold", 0.11, 0.02, [0, 0.07, 0], parts.accent).rotation.x = Math.PI / 2; return;
    case "scarf": parts.box("Scarf band", [0.18, 1.6, 0.012], [0, 0.8, 0]); for (const side of [-1, 1]) parts.box(side < 0 ? "Fringe left" : "Fringe right", [0.18, 0.05, 0.006], [0, side < 0 ? 0.02 : 1.58, 0], parts.accent); return;
    case "tie": parts.box("Tie blade", [0.08, 0.5, 0.008], [0, 0.25, 0]); parts.box("Knot", [0.06, 0.06, 0.03], [0, 0.53, 0], parts.accent); return;
    case "bow_tie": for (const side of [-1, 1]) parts.box(side < 0 ? "Wing left" : "Wing right", [0.06, 0.04, 0.012], [side * 0.045, 0.02, 0]); parts.box("Knot", [0.025, 0.03, 0.016], [0, 0.02, 0], parts.accent); return;
    case "sunglasses": case "eyeglasses": {
      for (const side of [-1, 1]) { parts.torus(side < 0 ? "Lens frame left" : "Lens frame right", 0.026, 0.004, [side * 0.034, 0.03, 0], parts.accent); parts.sphere(side < 0 ? "Lens left" : "Lens right", 0.025, [side * 0.034, 0.03, 0], parts.material, [1, 1, 0.1]); }
      parts.box("Bridge", [0.016, 0.004, 0.004], [0, 0.034, 0], parts.accent);
      for (const side of [-1, 1]) parts.box(side < 0 ? "Temple left" : "Temple right", [0.004, 0.004, 0.13], [side * 0.062, 0.034, -0.065], parts.accent);
      return;
    }
    case "necklace": parts.torus("Chain", 0.11, 0.003, [0, 0.11, 0], parts.accent).rotation.x = 0.3; parts.sphere("Pendant", 0.014, [0, 0.0, 0.03], parts.material); return;
    case "bracelet": parts.torus("Band", 0.035, 0.006, [0, 0.035, 0], parts.material).rotation.x = Math.PI / 2; parts.sphere("Charm", 0.008, [0.038, 0.035, 0], parts.accent); return;
    case "earrings": for (const side of [-1, 1]) parts.torus(side < 0 ? "Earring left" : "Earring right", 0.015, 0.002, [side * 0.07, 0.02, 0], parts.accent); return;
    case "ring": parts.torus("Band", 0.01, 0.002, [0, 0.01, 0], parts.accent).rotation.x = Math.PI / 2; parts.sphere("Stone", 0.004, [0, 0.022, 0], parts.material); return;
    case "watch": parts.torus("Strap", 0.034, 0.006, [0, 0.034, 0], parts.material).rotation.x = Math.PI / 2; parts.box("Case", [0.036, 0.008, 0.036], [0, 0.07, 0], parts.accent); return;
    case "wallet": parts.box("Wallet body", [0.11, 0.09, 0.02], [0, 0.045, 0]); parts.box("Flap", [0.11, 0.045, 0.004], [0, 0.07, 0.012], parts.accent); return;
    case "gloves": for (const side of [-1, 1]) { parts.box(side < 0 ? "Glove left" : "Glove right", [0.09, 0.2, 0.03], [side * 0.08, 0.1, 0]); parts.torus(side < 0 ? "Wrist left" : "Wrist right", 0.045, 0.008, [side * 0.08, 0.005, 0], parts.accent).rotation.x = Math.PI / 2; }
      return;
    case "socks": for (const side of [-1, 1]) { parts.tube(side < 0 ? "Sock left" : "Sock right", 0.045, 0.22, [side * 0.07, 0.15, 0]); parts.sphere(side < 0 ? "Foot left" : "Foot right", 0.05, [side * 0.07, 0.04, 0.04], parts.material, [0.9, 0.7, 1.5]); parts.torus(side < 0 ? "Rib left" : "Rib right", 0.046, 0.006, [side * 0.07, 0.26, 0], parts.accent).rotation.x = Math.PI / 2; }
      return;
    default: parts.torus("Headband", 0.1, 0.008, [0, 0.1, 0], parts.material, Math.PI); parts.box("Bow", [0.06, 0.03, 0.02], [0.05, 0.19, 0], parts.accent); return;
  }
}
