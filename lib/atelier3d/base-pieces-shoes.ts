import type { PartKit } from "./base-pieces-primitives";

/** Silhuetas de calçado: sola no chão (y = 0), bico em +z, contraforte em −z; cano para botas. */
export interface ShoeSpec {
  sole: number;
  heel?: number;
  shaft?: number;
  upper: "closed" | "open" | "low";
  laces?: boolean;
  straps?: number;
  tongue?: boolean;
}

export const SHOE_SPECS: Record<string, ShoeSpec> = {
  casual_sneakers: { sole: 0.03, upper: "closed", laces: true, tongue: true },
  running_shoes: { sole: 0.035, upper: "closed", laces: true, tongue: true },
  training_shoes: { sole: 0.03, upper: "closed", laces: true },
  basketball_shoes: { sole: 0.035, upper: "closed", laces: true, shaft: 0.06 },
  skate_shoes: { sole: 0.025, upper: "closed", laces: true, tongue: true },
  high_top_sneakers: { sole: 0.03, upper: "closed", laces: true, shaft: 0.08 },
  loafers: { sole: 0.02, upper: "low" },
  moccasins: { sole: 0.015, upper: "low" },
  oxford_shoes: { sole: 0.02, heel: 0.025, upper: "closed", laces: true },
  derby_shoes: { sole: 0.02, heel: 0.025, upper: "closed", laces: true },
  boots: { sole: 0.03, heel: 0.03, upper: "closed", shaft: 0.22 },
  ankle_boots: { sole: 0.03, heel: 0.04, upper: "closed", shaft: 0.1 },
  long_boots: { sole: 0.03, heel: 0.04, upper: "closed", shaft: 0.4 },
  combat_boots: { sole: 0.035, upper: "closed", shaft: 0.18, laces: true },
  sandals: { sole: 0.02, upper: "open", straps: 2 },
  flip_flops: { sole: 0.015, upper: "open", straps: 1 },
  heels: { sole: 0.012, heel: 0.09, upper: "low" },
  flats: { sole: 0.012, upper: "low" },
  espadrilles: { sole: 0.035, upper: "low" },
};

/** Um pé (direito); o editor pode duplicar. Comprimento 0,27 m, largura 0,1 m. */
export function buildShoe(parts: PartKit, spec: ShoeSpec) {
  const length = 0.27, width = 0.1;
  const sole = parts.box("Sole", [width, spec.sole, length], [0, spec.sole / 2, 0], parts.accent);
  sole.name = "Sole";
  const lift = spec.sole + (spec.heel ?? 0) * 0.3;
  if (spec.heel) parts.box("Heel", [width * 0.7, spec.heel, 0.06], [0, spec.heel / 2 + spec.sole, -length * 0.38], parts.accent);
  if (spec.upper === "open") {
    for (let i = 0; i < (spec.straps ?? 1); i++) {
      const strap = parts.torus(spec.straps === 1 ? "Strap" : `Strap ${i + 1}`, width * 0.5, 0.008, [0, lift, length * (0.18 - i * 0.22)], parts.material, Math.PI);
      strap.rotation.x = 0; strap.rotation.z = 0;
    }
    return;
  }
  const height = spec.upper === "low" ? 0.05 : 0.09;
  const upper = parts.sphere("Upper", 0.5, [0, lift + height * 0.35, 0.02], parts.material, [width, height, length * 0.98]);
  upper.name = "Upper";
  if (spec.tongue) parts.box("Tongue", [width * 0.45, 0.04, 0.09], [0, lift + height * 0.95, -0.02], parts.accent);
  if (spec.laces) parts.box("Laces", [width * 0.4, 0.006, 0.1], [0, lift + height * 0.98, 0.0], parts.accent);
  if (spec.shaft) parts.tube("Shaft", width * 0.5, spec.shaft, [0, lift + height * 0.8 + spec.shaft / 2, -length * 0.22], parts.material, width * 0.48);
  parts.box("Heel counter", [width * 0.9, height * 0.9, 0.02], [0, lift + height * 0.45, -length * 0.47], parts.accent);
}
