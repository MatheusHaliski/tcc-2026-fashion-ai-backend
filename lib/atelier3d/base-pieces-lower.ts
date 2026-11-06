import type { PartKit } from "./base-pieces-primitives";
import { buildUpper, UPPER_SPECS } from "./base-pieces-upper";

/** Silhuetas da parte de baixo: cós em y = waist, pernas/saia até o chão (ou comprimento menor). */
export interface LowerSpec {
  kind: "pants" | "shorts" | "skirt";
  length: number;
  flare?: number;
  slim?: boolean;
  cuffs?: boolean;
  cargo?: boolean;
  waist?: number;
}

export const LOWER_SPECS: Record<string, LowerSpec> = {
  jeans: { kind: "pants", length: 1.0 },
  tailored_pants: { kind: "pants", length: 1.02, flare: 0.01 },
  casual_pants: { kind: "pants", length: 1.0 },
  chino_pants: { kind: "pants", length: 0.98 },
  cargo_pants: { kind: "pants", length: 1.0, cargo: true },
  jogger_pants: { kind: "pants", length: 0.96, cuffs: true },
  sweatpants: { kind: "pants", length: 0.98, cuffs: true },
  leggings: { kind: "pants", length: 0.98, slim: true },
  culottes: { kind: "pants", length: 0.7, flare: 0.08 },
  shorts: { kind: "shorts", length: 0.4 },
  bermuda_shorts: { kind: "shorts", length: 0.52 },
  denim_shorts: { kind: "shorts", length: 0.32 },
  skirt: { kind: "skirt", length: 0.6, flare: 0.14 },
  skort: { kind: "skirt", length: 0.42, flare: 0.1 },
};

/** Cós no topo (y = length) e pernas/saia descendo até y = 0. */
export function buildLower(parts: PartKit, spec: LowerSpec, waistY = spec.length) {
  const waist = spec.waist ?? 0.33;
  const band = parts.tube("Waistband", waist, 0.06, [0, waistY + 0.03, 0], parts.accent);
  band.scale.z = 0.6;
  if (spec.kind === "skirt") {
    parts.lathe("Skirt", [[waist + (spec.flare ?? 0.1) + 0.08, waistY - spec.length], [waist + 0.03, waistY - spec.length * 0.45], [waist, waistY]], 0.7);
    return;
  }
  const legRadius = spec.slim ? 0.095 : 0.125;
  const bottom = legRadius + (spec.flare ?? 0) - (spec.cuffs ? 0.03 : 0);
  for (const side of [-1, 1]) {
    const name = side < 0 ? "Leg left" : "Leg right";
    const leg = parts.lathe(name, [[bottom, waistY - spec.length], [legRadius + 0.01, waistY - spec.length * 0.5], [legRadius + 0.05, waistY - 0.02]], 0.9);
    leg.position.x = side * 0.165;
    if (spec.cargo) parts.box(side < 0 ? "Cargo pocket left" : "Cargo pocket right", [0.12, 0.16, 0.03], [side * 0.3, waistY - spec.length * 0.55, 0.0], parts.accent);
    if (spec.cuffs) parts.torus(side < 0 ? "Cuff left" : "Cuff right", bottom + 0.005, 0.014, [side * 0.165, waistY - spec.length + 0.02, 0]).rotation.x = Math.PI / 2;
  }
  parts.lathe("Crotch", [[waist - 0.04, waistY - 0.26], [waist, waistY - 0.02]], 0.62);
}

/** Peças inteiras: tronco sobre saia ou pernas; macacão tem peitilho e alças. */
export function buildFullBody(parts: PartKit, subcategory: string) {
  if (subcategory === "dress") {
    buildLower(parts, { kind: "skirt", length: 0.75, flare: 0.16 }, 0.75);
    buildUpper(parts, { length: 0.5, sleeve: "short", collar: "crew" }, 0.74);
    return;
  }
  if (subcategory === "romper") {
    buildLower(parts, { kind: "shorts", length: 0.4 }, 0.7);
    buildUpper(parts, { length: 0.48, sleeve: "short", collar: "crew" }, 0.69);
    return;
  }
  if (subcategory === "overalls") {
    buildLower(parts, { kind: "pants", length: 1.0 }, 1.0);
    parts.box("Bib", [0.3, 0.26, 0.03], [0, 1.16, 0.17], parts.material);
    for (const side of [-1, 1]) parts.box(side < 0 ? "Strap left" : "Strap right", [0.05, 0.3, 0.025], [side * 0.11, 1.4, -0.02], parts.accent);
    return;
  }
  // jumpsuit e matching_set: tronco de manga longa sobre calça
  buildLower(parts, { kind: "pants", length: 1.0 }, 1.0);
  buildUpper(parts, { ...UPPER_SPECS.shirt, length: 0.56, opening: subcategory === "matching_set" ? "none" : "full" }, 0.98);
}
