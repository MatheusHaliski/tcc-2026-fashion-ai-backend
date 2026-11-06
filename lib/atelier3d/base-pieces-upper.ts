import type { PartKit } from "./base-pieces-primitives";

/** Parâmetros de silhueta da parte de cima (e do tronco das peças inteiras). Comprimentos em metros a partir da barra. */
export interface UpperSpec {
  length: number;
  sleeve: "none" | "short" | "long";
  hood?: boolean;
  collar?: "none" | "crew" | "stand" | "lapel" | "polo";
  opening?: "none" | "placket" | "full";
  pockets?: number;
  hemFlare?: number;
  cuffs?: boolean;
  straps?: boolean;
}

export const UPPER_SPECS: Record<string, UpperSpec> = {
  t_shirt: { length: 0.72, sleeve: "short", collar: "crew" },
  shirt: { length: 0.76, sleeve: "long", collar: "stand", opening: "full", cuffs: true },
  blouse: { length: 0.68, sleeve: "long", collar: "crew", hemFlare: 0.04 },
  tank_top: { length: 0.66, sleeve: "none", collar: "crew", straps: true },
  top: { length: 0.5, sleeve: "none", collar: "crew", straps: true },
  crop_top: { length: 0.46, sleeve: "short", collar: "crew" },
  polo_shirt: { length: 0.72, sleeve: "short", collar: "polo", opening: "placket" },
  bodysuit: { length: 0.78, sleeve: "long", collar: "crew" },
  sweater: { length: 0.72, sleeve: "long", collar: "crew", cuffs: true },
  sweatshirt: { length: 0.72, sleeve: "long", collar: "crew", cuffs: true },
  hoodie: { length: 0.74, sleeve: "long", hood: true, pockets: 1, cuffs: true },
  cardigan: { length: 0.74, sleeve: "long", collar: "none", opening: "full", pockets: 2 },
  vest: { length: 0.66, sleeve: "none", collar: "none", opening: "full" },
  blazer: { length: 0.78, sleeve: "long", collar: "lapel", opening: "full", pockets: 2 },
  jacket: { length: 0.7, sleeve: "long", collar: "stand", opening: "full", pockets: 2, cuffs: true },
  coat: { length: 1.05, sleeve: "long", collar: "lapel", opening: "full", pockets: 2 },
  parka: { length: 0.95, sleeve: "long", hood: true, opening: "full", pockets: 2 },
  windbreaker: { length: 0.7, sleeve: "long", hood: true, opening: "full", cuffs: true },
  kimono: { length: 1.0, sleeve: "long", collar: "none", opening: "full", hemFlare: 0.08 },
};

/** Tronco: barra em y = 0, ombros em y = length; profundidade 0,55 do raio. Partes nomeadas para edição. */
export function buildUpper(parts: PartKit, spec: UpperSpec, yOffset = 0) {
  const L = spec.length;
  const hem = 0.3 + (spec.hemFlare ?? 0);
  const body = parts.lathe("Body", [[hem, 0], [0.31, L * 0.45], [0.34, L * 0.82], [0.16, L]], 0.55);
  body.position.y = yOffset;
  const shoulder = yOffset + L * 0.86;
  if (spec.sleeve !== "none") {
    const length = spec.sleeve === "long" ? 0.58 : 0.26;
    for (const side of [-1, 1]) {
      const name = side < 0 ? "Sleeve left" : "Sleeve right";
      const sleeve = parts.lathe(name, [[0.11, 0], [0.13, length * 0.6], [0.15, length]], 0.85);
      sleeve.rotation.z = side * (Math.PI / 2 + 0.35);
      sleeve.position.set(side * 0.34, shoulder, 0);
      if (spec.cuffs) {
        const cuff = parts.torus(side < 0 ? "Cuff left" : "Cuff right", 0.11, 0.015, [side * (0.34 + Math.cos(0.35) * length * 0.98), shoulder - Math.sin(0.35) * length * 0.98, 0]);
        cuff.rotation.y = Math.PI / 2; cuff.rotation.z = side * 0.35;
      }
    }
  } else if (spec.straps) {
    for (const side of [-1, 1]) parts.box(side < 0 ? "Strap left" : "Strap right", [0.04, 0.12, 0.03], [side * 0.11, yOffset + L + 0.05, -0.02], parts.accent);
  }
  const neck = yOffset + L;
  if (spec.hood) {
    const hood = parts.sphere("Hood", 0.17, [0, neck + 0.05, -0.06], parts.material, [1, 1.1, 1]);
    hood.rotation.x = -0.2;
  }
  if (spec.collar === "crew") parts.torus("Neck rib", 0.155, 0.014, [0, neck, 0]).rotation.x = Math.PI / 2;
  if (spec.collar === "stand" || spec.collar === "polo") parts.tube("Collar", 0.165, 0.07, [0, neck + 0.03, 0], parts.accent, 0.15);
  if (spec.collar === "lapel") for (const side of [-1, 1]) {
    const lapel = parts.box(side < 0 ? "Lapel left" : "Lapel right", [0.09, 0.26, 0.012], [side * 0.08, neck - 0.14, 0.19], parts.accent);
    lapel.rotation.z = side * 0.35;
  }
  if (spec.opening === "placket") parts.box("Placket", [0.05, 0.16, 0.012], [0, neck - 0.1, 0.19], parts.accent);
  if (spec.opening === "full") parts.box("Front opening", [0.025, L * 0.95, 0.012], [0, yOffset + L * 0.48, 0.2], parts.accent);
  for (let i = 0; i < (spec.pockets ?? 0); i++) {
    const side = spec.pockets === 1 ? 0 : i === 0 ? -1 : 1;
    parts.box(spec.pockets === 1 ? "Pocket" : side < 0 ? "Pocket left" : "Pocket right", [spec.pockets === 1 ? 0.3 : 0.14, 0.14, 0.02], [side * 0.15, yOffset + L * 0.2, 0.19], parts.accent);
  }
}
