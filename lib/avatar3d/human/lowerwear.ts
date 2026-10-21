import type { GarmentSpec } from "./garments";
import type { FitClass, FitPiece } from "./garment-fit";

/** Family patterns, not measured manufacturer molds or physical fabric properties. */
export const LOWER_PROFILES: Readonly<Record<string, { fit: FitClass; spec: Partial<GarmentSpec> }>> = {
  jeans: { fit: "regular", spec: { ease: .009, waist: .18, leg: .985, legColumn: 1 } },
  tailored_pants: { fit: "estruturada", spec: { ease: .010, waist: .2, leg: .985, legColumn: 1 } },
  casual_pants: { fit: "regular", spec: { ease: .010, waist: .18, leg: .985, legColumn: 1 } },
  chino_pants: { fit: "regular", spec: { ease: .009, waist: .18, leg: .97, legColumn: .9 } },
  cargo_pants: { fit: "oversized", spec: { construction: "cargo", ease: .019, waist: .29, flare: .032, legColumn: 1 } },
  jogger_pants: { fit: "regular", spec: { ease: .012, leg: .97, legCuff: true, legColumn: 1, flare: 0 } },
  sweatpants: { fit: "regular", spec: { ease: .014, leg: .985, legCuff: true, legColumn: 1, flare: .03 } },
  leggings: { fit: "justa", spec: { ease: .002, waist: .2, leg: .97, legColumn: 0, flare: 0 } },
  culottes: { fit: "fluida", spec: { waist: .2, leg: .74, legColumn: 1.3, flare: .08 } },
  shorts: { fit: "regular", spec: { ease: .007, waist: .18, leg: .36 } },
  bermuda_shorts: { fit: "regular", spec: { ease: .009, waist: .18, leg: .5, legColumn: 1 } },
  denim_shorts: { fit: "regular", spec: { ease: .009, waist: .18, leg: .32 } },
  skirt: { fit: "fluida", spec: { waist: .2, skirt: .42, flare: .1 } },
  skort: { fit: "fluida", spec: { waist: .2, skirt: .32, flare: .08, liningLeg: .28 } },
};
export const lowerProfile = (p: FitPiece) => LOWER_PROFILES[(p.subcategory ?? "").toLowerCase()];
export function lowerVariantFit(p: FitPiece): FitClass | undefined {
  if (!lowerProfile(p)) return undefined;
  const v = (p.variation ?? "").trim().toUpperCase();
  if (p.subcategory?.toLowerCase() === "leggings") return "justa";
  return ({ PALAZZO: "fluida", GAUCHO: "fluida", BELL_BOTTOM: "fluida", BIKER: "justa", CIGARETTE: "justa", PARACHUTE: "oversized", CIRCLE: "fluida", SLIP: "fluida" } as Record<string, FitClass>)[v];
}

/** Run after silhouette rules and before explicit lengths and waistband height. */
export function applyLowerVariation(sp: GarmentSpec, p: FitPiece): void {
  if (!lowerProfile(p)) return;
  const sub = (p.subcategory ?? "").toLowerCase(), v = (p.variation ?? "").trim().toUpperCase();
  if (sub === "sweatpants" && v && v !== "CUFFED_HEM") sp.legCuff = false;
  if (["CUFFED_HEM", "PARACHUTE"].includes(v) && sp.leg > .8) sp.legCuff = true;
  if (sp.legCuff) { sp.legColumn = .6; sp.flare = 0; sp.legFlareStart = undefined; }
  if (sub === "leggings" && v === "STRAIGHT") sp.legColumn = 1;
  if (sub === "leggings" && v === "COMPRESSION") sp.ease = .0015;
  if (sp.kind === "shorts" || sp.kind === "bermuda") {
    if (v === "BIKER") { sp.leg = .42; sp.ease = .002; sp.flare = 0; sp.legColumn = 0; }
    if (v === "RELAXED") sp.ease *= 1.3;
    if (v === "CARGO") { sp.construction = "cargo"; sp.ease = Math.max(.014, sp.ease); }
    if (v === "A_LINE") sp.flare = .045;
  }
  if (sp.kind === "skirt") {
    if (v === "CIRCLE") sp.flare = .24;
    if (v === "SLIP") { sp.flare = .035; sp.ease = .006; }
  }
}
