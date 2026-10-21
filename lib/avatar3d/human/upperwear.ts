import type { GarmentSpec } from "./garments";
import type { FitClass, FitPiece } from "./garment-fit";

/** Estimated family patterns; no brand-wide fit or invented manufacturer measurements. */
export const UPPER_PROFILES: Readonly<Record<string, { fit: FitClass; spec: Partial<GarmentSpec> }>> = {
  t_shirt: { fit: "regular", spec: { placket: false } },
  shirt: { fit: "regular", spec: { placket: true } },
  blouse: { fit: "regular", spec: { placket: false, ease: .012, vneck: .14, drape: .85 } },
  tank_top: { fit: "justa", spec: { sleeve: 0, placket: false } },
  top: { fit: "justa", spec: { sleeve: 0, hem: .45, placket: false } },
  crop_top: { fit: "justa", spec: { hem: .45, sleeve: .28, placket: false } },
  polo_shirt: { fit: "regular", spec: { sleeve: .33, hem: -.06, placket: true, placketLength: .16 } },
  bodysuit: { fit: "justa", spec: { hem: -.18, ease: .003, drape: .15, placket: false, layer: 1 } },
  sweater: { fit: "regular", spec: { ribbed: true } },
  sweatshirt: { fit: "oversized", spec: { ease: .012, neck: .98, vneck: .06, ribbed: true } },
  hoodie: { fit: "oversized", spec: { ribbed: true } },
  cardigan: { fit: "regular", spec: { ease: .012, vneck: .24, frontOpening: .035, layer: 4, ribbed: false } },
  vest: { fit: "estruturada", spec: { ease: .010, sleeve: 0, vneck: .24 } },
  blazer: { fit: "estruturada", spec: { ease: .010, drape: .5, vneck: .24, frontOpening: .026 } },
  jacket: { fit: "estruturada", spec: { ribbed: false } },
  coat: { fit: "estruturada", spec: { ribbed: false } },
  parka: { fit: "estruturada", spec: { ease: .024, skirt: .38, neck: 1.04, vneck: .06 } },
  windbreaker: { fit: "regular", spec: { ease: .012, drape: 1, ribbed: false } },
  kimono: { fit: "fluida", spec: { ease: .014, hem: -.25, sleeve: .72, sleeveEase: .035, frontOpening: .05, ribbed: false } },
};

const VARIANT_FIT: Record<string, FitClass> = {
  BOXY: "oversized", BABY_TEE: "justa", OVERSHIRT: "oversized", TUNIC: "fluida", PEASANT: "fluida",
  PEPLUM: "fluida", BABYDOLL: "fluida", SMOCKED: "justa", CORSET: "justa", BANDEAU: "justa",
  SPORTS_BRA: "justa", BRALETTE: "justa", BUSTIER: "justa", DRAPED: "fluida",
};
export const upperProfile = (p: FitPiece) => UPPER_PROFILES[(p.subcategory ?? "").toLowerCase()];
export function upperVariantFit(p: FitPiece): FitClass | undefined {
  return upperProfile(p) ? VARIANT_FIT[(p.variation ?? "").trim().toUpperCase()] : undefined;
}
export const hasRibbing = (sp: GarmentSpec) => sp.ribbed ?? (sp.kind === "sweater" || sp.kind === "hoodie");

/** Apply before explicit LENGTH/SLEEVE_LENGTH/NECKLINE/CLOSURE overrides. */
export function applyUpperVariation(sp: GarmentSpec, p: FitPiece): void {
  if (!upperProfile(p)) return;
  const sub = (p.subcategory ?? "").toLowerCase(), v = (p.variation ?? "").trim().toUpperCase();
  if (v === "RELAXED") { sp.ease *= 1.2; sp.drape = Math.max(sp.drape, .9); }
  if (v === "BOXY") { sp.hem = .12; sp.ease = Math.max(sp.ease, .014); sp.drape = 1; }
  if (v === "BABY_TEE" && sub === "t_shirt") { sp.hem = .35; sp.sleeve = .24; sp.ease = .003; sp.drape = .15; }
  if (v === "OVERSHIRT" && sub === "shirt") { sp.layer = 5; sp.ease = .02; sp.hem = -.18; }
  if (v === "TUNIC" && sub === "blouse") { sp.hem = -.35; sp.drape = 1; }
  if (v === "PEPLUM" && sub === "blouse") { sp.hem = -.12; sp.hemFlare = .045; }
  if (v === "BOLERO" && sub === "cardigan") sp.hem = .5;
  if (v === "RUGBY" && sub === "polo_shirt") sp.sleeve = .96;
  if (v === "BANDEAU" && sub === "top") { sp.neck = .65; sp.vneck = 0; sp.sleeve = 0; sp.hem = .4; }
  if (["CORSET", "SPORTS_BRA", "BRALETTE", "BUSTIER"].includes(v) && sub === "top") {
    sp.neck = .87; sp.vneck = .16; sp.hem = .4; sp.drape = .1;
  }
  if (v === "PUFFER") sp.ease += .015;
  if (["BOMBER", "VARSITY"].includes(v) && sub === "jacket") { sp.hem = .05; sp.ribbed = true; }
  if (["MOTO", "TRUCKER"].includes(v) && sub === "jacket") { sp.hem = 0; sp.drape = .45; }
  if (v === "TRENCH" && sub === "coat") { sp.skirt = .65; sp.drape = 1; }
  if (v === "OPEN_FRONT") sp.frontOpening = Math.max(sp.frontOpening ?? 0, .035);
  if (v === "BELTED" && sub === "kimono") { sp.frontOpening = 0; sp.drape = .5; }
}
