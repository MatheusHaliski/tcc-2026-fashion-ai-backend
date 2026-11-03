/*
 * Caimento por classe (PROVADOR-3D) — as dimensões declaradas da taxonomia lidas da peça: comprimento (saia/perna),
 * manga, decote, cintura (rise) e cano da bota, com as tabelas de cada valor. O nome da peça só vale sem atributo.
 */
import type { GarmentSpec } from "./garments";
import type { FitPiece } from "./garment-fit";

export const first = (p: FitPiece, dim: string) => (p.attributes?.[dim] ?? [])[0]?.toUpperCase() ?? null;

/** Comprimento da saia/vestido (m abaixo do início) pela dimensão LENGTH. */
export const SKIRT_LEN: Record<string, number> = { MICRO: 0.24, MINI: 0.32, MID_THIGH: 0.38, KNEE: 0.5, MIDI: 0.66, MAXI: 0.88, FLOOR_LENGTH: 0.95, ANKLE_LENGTH: 0.88 };
/** Comprimento da perna (0 quadril → 1 tornozelo) pela dimensão LENGTH. */
export const LEG_LEN: Record<string, number> = { MICRO: 0.18, MINI: 0.24, MID_THIGH: 0.32, KNEE: 0.5, CAPRI: 0.72, PEDAL_PUSHER: 0.66, ANKLE_LENGTH: 0.93, FULL_LENGTH: 0.985 };
/** Manga (0 ombro → 1 punho) pela dimensão SLEEVE_LENGTH. */
export const SLEEVE_LEN: Record<string, number> = { SLEEVELESS: 0, SHORT_SLEEVE: 0.33, ELBOW_SLEEVE: 0.5, THREE_QUARTER_SLEEVE: 0.72, LONG_SLEEVE: 0.96 };
/** Explicit attributes override product-title declarations; a brand never determines sleeve length. */
export function sleeveLengthOf(p: FitPiece): string | null {
  const declared = first(p, "SLEEVE_LENGTH");
  if (declared) return declared;
  const name = (p.name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\bsleeveless\b|\bsem mangas?\b/.test(name)) return "SLEEVELESS";
  if (/\bshort[ _-]?sleeve[ds]?\b|\bmangas?[ _-]?curtas?\b/.test(name)) return "SHORT_SLEEVE";
  if (/\b(?:three[ _-]?quarter|3\/4)[ _-]?sleeve[ds]?\b|\bmanga[ _-]?3\/4\b/.test(name)) return "THREE_QUARTER_SLEEVE";
  if (/\blong[ _-]?sleeve[ds]?\b|\bmangas?[ _-]?longas?\b/.test(name)) return "LONG_SLEEVE";
  return null;
}
/**
 * Decote pela dimensão NECKLINE ou pelo nome da peça (o catálogo não traz atributos: "T-Shirt De Malha Decote V").
 * Profundidade em h (quadril → pescoço = 1): V ≈ 10 cm abaixo da base do pescoço; careca ≈ 4 cm.
 */
export const NECKLINE: Record<string, Partial<Pick<GarmentSpec, "neck" | "vneck" | "neckShape">>> = {
  CREW: { neckShape: "round", vneck: 0.08 }, V_NECK: { neckShape: "v", vneck: 0.22 }, SCOOP: { neckShape: "round", vneck: 0.17 },
  BOAT: { neckShape: "boat", vneck: 0.05 }, SQUARE_NECK: { neckShape: "square", vneck: 0.16 }, SWEETHEART: { neckShape: "v", vneck: 0.24 },
  PLUNGE: { neckShape: "v", vneck: 0.34 }, OFF_SHOULDER: { neckShape: "boat", neck: 0.84, vneck: 0.03 }, STRAPLESS: { neckShape: "boat", neck: 0.8, vneck: 0.02 },
  HALTER: { neckShape: "v", vneck: 0.2 }, COWL: { neckShape: "round", vneck: 0.2 }, KEYHOLE: { neckShape: "round", vneck: 0.1 },
  TURTLENECK: { neckShape: "round", neck: 1.1, vneck: 0.02 }, MOCK_NECK: { neckShape: "round", neck: 1.05, vneck: 0.03 },
  HENLEY: { neckShape: "round", vneck: 0.12 }, POLO_COLLAR: { neckShape: "v", vneck: 0.12 },
};
const NECK_WORDS: [RegExp, string][] = [
  [/gola\s*alta|turtle\s*neck|cacharrel/, "TURTLENECK"], [/gola\s*m[eé]dia|mock\s*neck/, "MOCK_NECK"],
  [/decote\s*v\b|v[\s-]?neck|gola\s*v\b/, "V_NECK"], [/decote\s*u\b|scoop/, "SCOOP"], [/canoa|boat\s*neck/, "BOAT"],
  [/quadrad|square\s*neck/, "SQUARE_NECK"], [/cora[çc][aã]o|sweetheart/, "SWEETHEART"], [/profund|plunge/, "PLUNGE"],
  [/ombro\s*a\s*ombro|off[\s-]?shoulder|ciganinha/, "OFF_SHOULDER"], [/tomara\s*que\s*caia|strapless/, "STRAPLESS"],
  [/frente\s*[úu]nica|halter/, "HALTER"], [/\bpolo\b/, "POLO_COLLAR"], [/\bdecote\b|decotad/, "SCOOP"],
];
export function necklineOf(p: FitPiece): string | null {
  const attr = first(p, "NECKLINE"); if (attr && NECKLINE[attr]) return attr;
  const name = `${p.name ?? ""} ${p.subcategory ?? ""}`.toLowerCase();
  for (const [re, code] of NECK_WORDS) if (re.test(name)) return code;
  return null;
}
/** Início do cano da bota (0 quadril → 1 tornozelo) pela dimensão SHAFT_HEIGHT ou pela subcategoria. */
// Same normalized torso coordinate as coverageOf: higher values put the waistband higher.
export const RISE: Record<string, number> = { LOW_RISE: .10, MID_RISE: .18, HIGH_RISE: .34, SUPER_HIGH_RISE: .43 };
export function riseOf(p: FitPiece): string | null {
  const declared = first(p, "RISE");
  if (declared) return RISE[declared] === undefined ? null : declared;
  const name = (p.name ?? "").toLowerCase();
  if (/super[ -]?high[ -]?rise|cintura super alta/.test(name)) return "SUPER_HIGH_RISE";
  if (/high[ -]?rise|cintura alta/.test(name)) return "HIGH_RISE";
  if (/mid[ -]?rise|cintura m[eé]dia/.test(name)) return "MID_RISE";
  if (/low[ -]?rise|cintura baixa/.test(name)) return "LOW_RISE";
  return null;
}
export const SHAFT: Record<string, number> = { ANKLE: 0.86, MID_TOP: 0.86, HIGH_TOP: 0.82, QUARTER: 0.88, CREW: 0.8, MID_CALF: 0.72, KNEE_HIGH: 0.55, OVER_THE_KNEE: 0.42, THIGH_HIGH: 0.25 };
export const SHAFT_SUB: Record<string, number> = { ankle_boots: 0.86, combat_boots: 0.8, boots: 0.72, long_boots: 0.56 };
