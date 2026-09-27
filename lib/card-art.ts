import index from "@/lib/assets/card-art-index.json";
import { CARD_SKINS } from "@/lib/skins";
import { tr } from "@/lib/i18n/i18n";

/**
 * Arte de fundo do card (RF11 · Background Studio) resolvida em camadas para o "palco" do card.
 *
 * Regra (RF11_PROPOSTA_CONTAINER_EDITORIAL_VS_AURA §3.3/§4): a arte ocupa o fundo do card, FORA do container do esquema,
 * como um passe-partout; o container fica sempre visível por cima dela. A foto do conjunto é do usuário (como a foto de um
 * post) e nunca recebe a arte — ela só passa pelo pipeline de filtros da própria foto.
 */
export type ArtKind = "none" | "color" | "gradient" | "seasonal" | "aura" | "material" | "aura_material" | "mosaic" | "ai" | "upload";
export interface CardArt {
  kind: ArtKind; base?: string; image?: string; video?: { src: string; poster?: string | null }; material?: string; animation?: string | null;
  season?: string | null; label: string; presetId?: string;
}
interface Studio {
  color?: string | null; gradient?: unknown; gradientPresetId?: string | null; seasonalPresetId?: string | null; seasonalAuto?: boolean;
  aura?: { variantId?: string; format?: string } | null; materialId?: string | null; aiArt?: { url?: string } | null; uploadUrl?: string | null;
  container?: { color?: string | null } | null; photo?: { url?: string | null } | null; skin?: string;
  /** família de silhueta declarada por quem publica (anatomia Silhueta & Proporção) */
  silhouette?: string | null;
}
type Idx = {
  presets: Record<string, { name: string; palette: string[]; animation?: string; recommendedMaterials: string[]; variants: string[] }>;
  variants: Record<string, { presetId: string; code?: string; theme?: string; card?: string | null; preview?: string | null; animation?: string | null }>;
  materials: Record<string, { name: string; code?: string; card?: string | null; preview?: string | null }>;
  combos: Record<string, { single?: { url: string; poster?: string | null }; mosaic?: { url: string; poster?: string | null } }>;
  seasonal: Record<string, { season: string; name: string; stops: string[]; animation?: string }>;
  gradients: Record<string, { name: string; type?: string; stops: string[]; animation?: string }>;
  skins: Record<string, { nativeContainer?: string; family?: string }>;
};
export const ART_INDEX = index as unknown as Idx;
const SEASON_PRESET: Record<string, string> = { WINTER: "frost", SUMMER: "solstice", AUTUMN: "ember", SPRING: "bloom" };
const NONE: CardArt = { kind: "none", get label() { return tr("common.sem_arte"); } };

/** Aceita tanto o config salvo ({ scheme: {...}, pieces, resolved }) quanto o estado plano do Background Studio. */
export function studioOf(bg?: Record<string, unknown> | null): Studio {
  if (!bg) return {};
  const inner = bg.scheme && typeof bg.scheme === "object" ? (bg.scheme as Studio) : (bg as Studio);
  return inner ?? {};
}
function gradientCss(g: unknown): string | undefined {
  if (!g) return undefined;
  if (typeof g === "string") {
    if (g.includes("gradient(")) return g;
    try { return gradientCss(JSON.parse(g)); } catch { return undefined; }
  }
  const o = g as { type?: string; angle?: number; stops?: string[] };
  if (!o.stops?.length) return undefined;
  return o.type === "radial" ? `radial-gradient(circle, ${o.stops.join(",")})` : o.type === "conic" ? `conic-gradient(${o.stops.join(",")})` : `linear-gradient(${o.angle ?? 135}deg, ${o.stops.join(",")})`;
}
/** Caminho público seguro: cada segmento codificado (os nomes dos vídeos têm espaços e "+"). */
const media = (u?: string | null) => (!u ? undefined : /^https?:/.test(u) ? encodeURI(u) : u.split("/").map((seg) => encodeURIComponent(decodeURIComponent(seg))).join("/"));

export function resolveCardArt(bg?: Record<string, unknown> | null, opts?: { season?: string | null }): CardArt {
  const s = studioOf(bg);
  // camada base: cor → gradiente → cartela sazonal (sobrescreve o fundo manual)
  let base: string | undefined = s.color ?? undefined;
  let kind: ArtKind = base ? "color" : "none";
  let label = base ? `cor ${base}` : tr("common.sem_arte");
  let season: string | null = null;
  const grad = gradientCss(s.gradient) ?? (s.gradientPresetId && ART_INDEX.gradients[s.gradientPresetId] ? gradientCss({ type: ART_INDEX.gradients[s.gradientPresetId].type, stops: ART_INDEX.gradients[s.gradientPresetId].stops }) : undefined);
  if (grad) { base = grad; kind = "gradient"; label = s.gradientPresetId ? `gradiente ${ART_INDEX.gradients[s.gradientPresetId]?.name ?? s.gradientPresetId}` : "gradiente"; }
  const seasonalId = s.seasonalAuto && opts?.season ? SEASON_PRESET[opts.season] : s.seasonalPresetId;
  if (seasonalId && ART_INDEX.seasonal[seasonalId]) {
    const p = ART_INDEX.seasonal[seasonalId];
    base = `linear-gradient(160deg, ${p.stops.join(",")})`; kind = "seasonal"; season = p.season; label = `cartela sazonal ${p.name}`;
  }
  const art: CardArt = { kind, base, season, label };
  // camadas de imagem (a de cima vence): arte com IA / upload → AURA + material → AURA → material
  const ai = s.aiArt?.url; const upload = s.uploadUrl;
  if (ai || upload) return { ...art, kind: ai ? "ai" : "upload", image: media(ai ?? upload), label: ai ? tr("lib.cardArt.arte_com_ia") : tr("lib.cardArt.imagem_enviada") };
  const v = s.aura?.variantId ? ART_INDEX.variants[s.aura.variantId] : undefined;
  const m = s.materialId ? ART_INDEX.materials[s.materialId] : undefined;
  if (v) {
    const preset = ART_INDEX.presets[v.presetId];
    const withPalette = { ...art, base: art.base ?? `linear-gradient(135deg, ${(preset?.palette ?? ["#222", "#555"]).join(",")})`, presetId: v.presetId };
    if (m) {
      const combo = ART_INDEX.combos[`${s.aura!.variantId}|${s.materialId}`];
      if (s.aura?.format === "MOSAICO" && combo?.mosaic) return { ...withPalette, kind: "mosaic", video: { src: media(combo.mosaic.url)!, poster: media(combo.mosaic.poster) }, image: media(combo.mosaic.poster), label: tr("lib.cardArt.aura_mosaico", { name: preset?.name, name2: m.name }) };
      if (combo?.single && s.aura?.format) return { ...withPalette, kind: "aura_material", video: { src: media(combo.single.url)!, poster: media(combo.single.poster) }, image: media(combo.single.poster), label: tr("lib.cardArt.aura_imagem_unica", { name: preset?.name, name2: m.name }) };
      return { ...withPalette, kind: "aura_material", image: media(v.card), material: media(m.card), animation: v.animation, label: `AURA ${preset?.name} + ${m.name}` };
    }
    return { ...withPalette, kind: "aura", image: media(v.card), animation: v.animation, label: `AURA ${preset?.name} · ${v.theme ?? ""}` };
  }
  if (m) return { ...art, kind: "material", image: media(m.card), label: tr("lib.cardArt.material", { name: m.name }) };
  return art.kind === "none" ? NONE : art;
}

/** Cor do container: escolha manual do Studio/esquema, senão a cor nativa do skin (RF11 §3.3). */
export function containerColorOf(skin?: string | null, manual?: string | null): string {
  if (manual && /^#[0-9A-Fa-f]{6}$/.test(manual)) return manual;
  return ART_INDEX.skins[skin ?? ""]?.nativeContainer ?? CARD_SKINS[skin ?? ""]?.bg ?? "#FFFFFF";
}
/** Tinta legível sobre uma cor de container. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16); const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 140 ? "#1A1714" : "#F5F2EC";
}

/** Presets do pipeline de filtros da foto do look (não destrutivos: guardados no config e aplicados na exibição). */

/** 10 cores clássicas de blocos de encaixe: a cor dominante é quantizada para a mais próxima (anatomia/narrativa LEGO). */
export const BRICKS = ["#C91A09", "#0055BF", "#F2CD37", "#237841", "#1B2A34", "#F4F4F4", "#FE8A18", "#E4CD9E", "#6C6E68", "#582A12"];
const rgbOf = (hex: string) => { const n = parseInt(hex.replace("#", "").slice(0, 6).padEnd(6, "0"), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const brickColor = (hex?: string | null) => {
  if (!hex || !hex.startsWith("#")) return BRICKS[8];
  const [r, g, b] = rgbOf(hex);
  return BRICKS.reduce((best, c) => { const [x, y, z] = rgbOf(c); const [p, q, s] = rgbOf(best); return (x - r) ** 2 + (y - g) ** 2 + (z - b) ** 2 < (p - r) ** 2 + (q - g) ** 2 + (s - b) ** 2 ? c : best; }, BRICKS[0]);
};
/** Matiz (0–360) e croma (0–1) de uma cor #RRGGBB. */
export function hueChroma(hex: string) { const [r, g, b] = rgbOf(hex).map((v) => v / 255); const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min; let h = 0; if (c) h = max === r ? ((g - b) / c) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4; return { hue: (h * 60 + 360) % 360, chroma: c }; }
/** Textura da placa-base LEGO (imagem enviada pelo time; os pinos trazem a marca LEGO em relevo). */
export const BLOCKS_TEXTURE = "/textures/lego_placa_base_card.webp";
