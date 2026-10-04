/**
 * RF47/RF45 · Guias de fotografia por categoria — configuração extensível (nada de if/else espalhado pela interface).
 * Cada guia diz qual é a primeira foto com maior valor de identificação para aquele tipo de peça, quais regiões a IA
 * analisa (ROIs calculadas sobre a peça detectada, não coordenadas fixas) e que foto complementar pode ser pedida.
 * Os textos são chaves i18n (pieces.guide.*); a ilustração é um glifo SVG com as regiões destacadas.
 */
export type GuideId = "upper_piece" | "lower_piece" | "shoes_piece" | "full_body_piece" | "accessory_bag" | "accessory_cap"
  | "accessory_glasses" | "accessory_watch" | "accessory_belt" | "accessory_jewelry" | "accessory_other";
export type CaptureCategory = "upper_piece" | "lower_piece" | "shoes_piece" | "accessory_piece" | "full_body_piece";
export type PrimaryView = "FRONT_VIEW" | "BACK_VIEW" | "LEFT_SIDE" | "TEMPLE_DETAIL" | "WATCH_FACE" | "BUCKLE_DETAIL" | "MACRO";
export type Illustration = "tshirt" | "pants_back" | "sneaker_side" | "dress" | "bag" | "cap" | "glasses_side" | "watch" | "belt" | "jewelry" | "generic";

export interface CaptureGuide {
  id: GuideId;
  category: CaptureCategory;
  /** subcategorias da taxonomia que caem neste guia (vazio = qualquer uma da categoria) */
  subcategories: string[];
  primaryView: PrimaryView;
  illustration: Illustration;
  /** regiões destacadas na ilustração e analisadas pela IA, na ordem de prioridade */
  highlightedRegions: string[];
  title: string;
  description: string;
  regionsNote: string;
  tips: string[];
  secondaryCaptureSuggestion: string;
  /** overlay discreto da câmera (silhueta): o mesmo id do glifo */
  overlay: Illustration;
}

const k = (s: string) => `pieces.guide.${s}`;

const guide = (id: GuideId, category: CaptureCategory, subcategories: string[], primaryView: PrimaryView, illustration: Illustration,
  regions: string[], tips: string[]): CaptureGuide => ({
  id, category, subcategories, primaryView, illustration, highlightedRegions: regions, overlay: illustration,
  title: k(`${id}.title`), description: k(`${id}.description`), regionsNote: k(`${id}.regions_note`),
  tips: tips.map((t) => k(`tip.${t}`)), secondaryCaptureSuggestion: k(`${id}.secondary`),
});

/** Guias na ordem em que aparecem; os de acessório são escolhidos pela segunda segmentação ("Qual tipo de acessório?"). */
export const CAPTURE_GUIDES: Record<GuideId, CaptureGuide> = {
  upper_piece: guide("upper_piece", "upper_piece", [], "FRONT_VIEW", "tshirt", ["chest_left", "chest_right", "chest_center", "collar"],
    ["flat", "light", "no_objects", "perpendicular", "whole"]),
  lower_piece: guide("lower_piece", "lower_piece", [], "BACK_VIEW", "pants_back", ["waistband", "patch", "back_pocket_left", "back_pocket_right"],
    ["flat", "light", "perpendicular", "whole", "back_first"]),
  shoes_piece: guide("shoes_piece", "shoes_piece", [], "LEFT_SIDE", "sneaker_side", ["side_panel", "tongue", "heel", "midsole"],
    ["side_outer", "light", "whole", "single_shoe"]),
  full_body_piece: guide("full_body_piece", "full_body_piece", [], "FRONT_VIEW", "dress", ["neckline", "chest_center", "hem"],
    ["flat", "light", "no_objects", "whole"]),
  accessory_bag: guide("accessory_bag", "accessory_piece", ["handbag", "crossbody_bag", "tote_bag", "clutch", "backpack"], "FRONT_VIEW", "bag",
    ["logo", "clasp", "plate", "pattern"], ["bag_front", "light", "empty_bag"]),
  accessory_cap: guide("accessory_cap", "accessory_piece", ["cap", "hat", "beanie"], "FRONT_VIEW", "cap", ["front_panel", "side_left", "side_right", "brim"],
    ["cap_front", "light"]),
  accessory_glasses: guide("accessory_glasses", "accessory_piece", ["sunglasses", "eyeglasses"], "TEMPLE_DETAIL", "glasses_side", ["temple", "hinge", "logo", "model_code"],
    ["temple_side", "light", "no_reflection"]),
  accessory_watch: guide("accessory_watch", "accessory_piece", ["watch"], "WATCH_FACE", "watch", ["dial", "bezel", "crown"],
    ["watch_face", "no_reflection", "light"]),
  accessory_belt: guide("accessory_belt", "accessory_piece", ["belt"], "BUCKLE_DETAIL", "belt", ["buckle", "logo", "engraving"],
    ["buckle_center", "light"]),
  accessory_jewelry: guide("accessory_jewelry", "accessory_piece", ["necklace", "bracelet", "earrings", "ring"], "MACRO", "jewelry",
    ["engraving", "symbols", "stones", "clasp"], ["macro", "light", "plain_background"]),
  accessory_other: guide("accessory_other", "accessory_piece", [], "FRONT_VIEW", "generic", ["label", "logo"], ["flat", "light", "whole"]),
};

/** Tipos de acessório da segunda segmentação ("Qual tipo de acessório você vai adicionar?"). */
export const ACCESSORY_TYPES: { id: GuideId; label: string; description: string; subcategory: string }[] = [
  { id: "accessory_bag", label: k("acc.bag"), description: k("acc.bag_desc"), subcategory: "handbag" },
  { id: "accessory_cap", label: k("acc.cap"), description: k("acc.cap_desc"), subcategory: "cap" },
  { id: "accessory_glasses", label: k("acc.glasses"), description: k("acc.glasses_desc"), subcategory: "sunglasses" },
  { id: "accessory_watch", label: k("acc.watch"), description: k("acc.watch_desc"), subcategory: "watch" },
  { id: "accessory_belt", label: k("acc.belt"), description: k("acc.belt_desc"), subcategory: "belt" },
  { id: "accessory_jewelry", label: k("acc.jewelry"), description: k("acc.jewelry_desc"), subcategory: "necklace" },
  { id: "accessory_other", label: k("acc.other"), description: k("acc.other_desc"), subcategory: "" },
];

/** Cards da primeira segmentação ("O que você vai adicionar?"). */
export const CATEGORY_CARDS: { id: CaptureCategory; label: string; description: string; illustration: Illustration }[] = [
  { id: "upper_piece", label: k("cat.upper"), description: k("cat.upper_desc"), illustration: "tshirt" },
  { id: "lower_piece", label: k("cat.lower"), description: k("cat.lower_desc"), illustration: "pants_back" },
  { id: "shoes_piece", label: k("cat.shoes"), description: k("cat.shoes_desc"), illustration: "sneaker_side" },
  { id: "accessory_piece", label: k("cat.accessory"), description: k("cat.accessory_desc"), illustration: "bag" },
  { id: "full_body_piece", label: k("cat.full"), description: k("cat.full_desc"), illustration: "dress" },
];

/** Guia de uma categoria/subcategoria; acessório sem subcategoria não tem guia (precisa da segunda segmentação). */
export function guideFor(category: string | null | undefined, subcategory?: string | null): CaptureGuide | null {
  if (!category) return null;
  if (category !== "accessory_piece") return (CAPTURE_GUIDES as Record<string, CaptureGuide>)[category] ?? null;
  if (!subcategory) return null;
  return Object.values(CAPTURE_GUIDES).find((g) => g.category === "accessory_piece" && g.subcategories.includes(subcategory)) ?? CAPTURE_GUIDES.accessory_other;
}

/** Guia pelo id vindo da taxonomia (ex.: card do acessório) */
export function guideById(id: string | null | undefined): CaptureGuide | null {
  return id ? (CAPTURE_GUIDES as Record<string, CaptureGuide>)[id] ?? null : null;
}

export const ALL_TIPS = ["flat", "light", "no_objects", "perpendicular", "whole", "back_first", "side_outer", "single_shoe", "bag_front", "empty_bag",
  "cap_front", "temple_side", "no_reflection", "watch_face", "buckle_center", "macro", "plain_background"] as const;
