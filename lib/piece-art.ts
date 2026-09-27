/**
 * RF11 · arte do card da peça — modelo v2 (template, composição, fundo artístico, superfície interna e efeitos).
 *
 * O config continua sendo o JSON livre de `WardrobeItem.backgroundConfigJson` (PUT /api/pieces/{id}/background): os campos
 * do Background Studio (cor, gradiente, cartela sazonal, AURA, material, arte com IA, upload, skin, anatomia) ficam onde
 * sempre estiveram, e a v2 acrescenta `v`, `template`, `composition`, `surface` e `effects`. Configs antigos (sem `v`)
 * são LIDOS como v2 com valores padrão — nada é regravado até a pessoa aplicar no editor.
 */
export type ArtFamily = "classic" | "bento" | "blocks" | "seasonal" | "xray" | "runway";
export type ArtVariant = "a" | "b";
export type Season = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";
/** Ênfase da área artística: as laterais têm sempre a mesma largura (a foto fica comparável); topo e base variam. */
export type Emphasis = "balanced" | "top" | "bottom";
export type Finish = "none" | "metallic" | "iridescent";
export type Texture = "none" | "paper" | "fabric" | "ceramic";

export interface ArtEffects {
  /** aura em volta do conteúdo: intensidade e alcance (0–1) */
  aura: { on: boolean; intensity: number; reach: number };
  rim: boolean; glow: boolean; glass: boolean; finish: Finish; relief: boolean; texture: Texture; collage: boolean;
  particles: boolean;
  /** movimento ambiente (opcional): só no card ampliado, respeita "reduzir movimento" e pausa fora da tela */
  motion: boolean;
}
export interface PieceArt {
  v: 2;
  template: { family: ArtFamily; variant: ArtVariant; season: Season };
  composition: { emphasis: Emphasis };
  /** superfície interna (container do conteúdo): cor própria ou a nativa do skin; sólida ou vidro fosco */
  surface: { color: string | null; style: "solid" | "frosted" };
  effects: ArtEffects;
}

export const FAMILIES: ArtFamily[] = ["classic", "bento", "blocks", "seasonal", "xray", "runway"];
export const SEASONS: Season[] = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];

/** Efeitos que combinam com cada família (os outros ficam desabilitados no editor e são ignorados na renderização). */
export const FAMILY_EFFECTS: Record<ArtFamily, (keyof ArtEffects)[]> = {
  classic: ["aura", "rim", "glow", "glass", "finish", "relief", "texture", "particles"],
  bento: ["aura", "rim", "glow", "glass", "texture", "collage"],
  blocks: ["rim", "glow", "relief", "texture", "particles"],
  seasonal: ["aura", "glow", "texture", "collage", "particles", "motion"],
  xray: ["rim", "glow", "glass", "finish", "particles", "motion"],
  runway: ["aura", "rim", "glow", "finish", "particles", "motion"],
};
/** Ênfase padrão de cada família e variação (composição própria: palco na base, painéis no topo, janela no topo…). */
export const FAMILY_EMPHASIS: Record<ArtFamily, Record<ArtVariant, Emphasis>> = {
  classic: { a: "balanced", b: "balanced" }, bento: { a: "top", b: "top" }, blocks: { a: "bottom", b: "bottom" },
  seasonal: { a: "top", b: "top" }, xray: { a: "balanced", b: "balanced" }, runway: { a: "bottom", b: "top" },
};
/** Zona do selo (RF20/21) de cada família — reaproveita as anatomias de peça existentes. */
export const FAMILY_ANATOMY: Record<ArtFamily, string> = {
  classic: "PECA_AMPLIADO", bento: "BENTO", blocks: "LEGO", seasonal: "PECA_AMPLIADO", xray: "RAIO_X", runway: "PASSARELA",
};
const ANATOMY_FAMILY: Record<string, ArtFamily> = { BENTO: "bento", LEGO: "blocks", RAIO_X: "xray", PASSARELA: "runway" };

/** Máximo de efeitos simultâneos (sem contar a aura): mais que isso compete com a foto. */
export const EFFECT_LIMIT = 3;
/** Teto da aura: nunca clareia/escurece a borda da foto a ponto de mudar a leitura da cor. */
export const AURA_MAX = 0.8;

export const NO_EFFECTS: ArtEffects = { aura: { on: false, intensity: 0.5, reach: 0.5 }, rim: false, glow: false, glass: false, finish: "none", relief: false, texture: "none", collage: false, particles: false, motion: false };

export function defaultArt(family: ArtFamily = "classic", variant: ArtVariant = "a"): PieceArt {
  return { v: 2, template: { family, variant, season: "SPRING" }, composition: { emphasis: FAMILY_EMPHASIS[family][variant] }, surface: { color: null, style: "solid" }, effects: { ...NO_EFFECTS, aura: { ...NO_EFFECTS.aura } } };
}

const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback);
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback);

/** Efeitos ativos que contam no limite (a aura e o movimento ficam de fora). */
export function activeEffects(e: ArtEffects): string[] {
  return [e.rim && "rim", e.glow && "glow", e.glass && "glass", e.finish !== "none" && "finish", e.relief && "relief", e.texture !== "none" && "texture", e.collage && "collage", e.particles && "particles"].filter(Boolean) as string[];
}

/**
 * Efeitos válidos para a família: remove os que não combinam, respeita o limite de {@link EFFECT_LIMIT} (mantém os
 * primeiros na ordem de prioridade), limita a aura e só deixa o movimento quando há partículas ou aura para mover.
 */
export function constrainEffects(e: ArtEffects, family: ArtFamily): ArtEffects {
  const allowed = new Set(FAMILY_EFFECTS[family]);
  const out: ArtEffects = {
    aura: { on: allowed.has("aura") && e.aura.on, intensity: Math.min(AURA_MAX, e.aura.intensity), reach: e.aura.reach },
    rim: allowed.has("rim") && e.rim, glow: allowed.has("glow") && e.glow, glass: allowed.has("glass") && e.glass,
    finish: allowed.has("finish") ? e.finish : "none", relief: allowed.has("relief") && e.relief, texture: allowed.has("texture") ? e.texture : "none",
    collage: allowed.has("collage") && e.collage, particles: allowed.has("particles") && e.particles, motion: false,
  };
  const order: (keyof ArtEffects)[] = ["texture", "relief", "rim", "glow", "glass", "finish", "collage", "particles"];
  let n = 0;
  for (const k of order) {
    const on = k === "finish" ? out.finish !== "none" : k === "texture" ? out.texture !== "none" : !!out[k];
    if (!on) continue;
    if (++n > EFFECT_LIMIT) { if (k === "finish") out.finish = "none"; else if (k === "texture") out.texture = "none"; else (out as unknown as Record<string, boolean>)[k] = false; }
  }
  out.motion = allowed.has("motion") && e.motion && (out.particles || out.aura.on);
  return out;
}

/**
 * Lê o config salvo (v1 ou v2) como v2. v1: a anatomia de peça escolhida antes vira a família equivalente (Bento, Blocos
 * [LEGO], Raio-X, Passarela; as demais, Clássica), a cor de container vira a superfície interna e nenhum efeito é ligado.
 */
export function readPieceArt(bg?: Record<string, unknown> | null): PieceArt {
  const raw = (bg ?? {}) as Record<string, unknown>;
  const container = raw.container as { color?: string | null } | null | undefined;
  if (raw.v !== 2) {
    const family = ANATOMY_FAMILY[String(raw.anatomy ?? "")] ?? "classic";
    const a = defaultArt(family, "a");
    return { ...a, surface: { color: container?.color ?? null, style: "solid" } };
  }
  const tpl = (raw.template ?? {}) as Record<string, unknown>;
  const family = oneOf(tpl.family, FAMILIES, "classic");
  const variant = oneOf(tpl.variant, ["a", "b"] as const, "a");
  const comp = (raw.composition ?? {}) as Record<string, unknown>;
  const surf = (raw.surface ?? {}) as Record<string, unknown>;
  const fx = (raw.effects ?? {}) as Record<string, unknown>;
  const aura = (fx.aura ?? {}) as Record<string, unknown>;
  const effects: ArtEffects = {
    aura: { on: aura.on === true, intensity: num(aura.intensity, 0.5), reach: num(aura.reach, 0.5) },
    rim: fx.rim === true, glow: fx.glow === true, glass: fx.glass === true, finish: oneOf(fx.finish, ["none", "metallic", "iridescent"] as const, "none"),
    relief: fx.relief === true, texture: oneOf(fx.texture, ["none", "paper", "fabric", "ceramic"] as const, "none"), collage: fx.collage === true,
    particles: fx.particles === true, motion: fx.motion === true,
  };
  return {
    v: 2,
    template: { family, variant, season: oneOf(tpl.season, SEASONS, "SPRING") },
    composition: { emphasis: oneOf(comp.emphasis, ["balanced", "top", "bottom"] as const, FAMILY_EMPHASIS[family][variant]) },
    surface: { color: typeof surf.color === "string" && /^#[0-9a-f]{6}$/i.test(surf.color) ? surf.color : container?.color ?? null, style: oneOf(surf.style, ["solid", "frosted"] as const, "solid") },
    effects: constrainEffects(effects, family),
  };
}

/**
 * Config para salvar: os campos antigos do Studio (arte, skin) preservados, a v2 por cima e a anatomia sincronizada com a
 * família (a zona do selo acompanha). `container.color` continua sendo escrito para quem ainda lê a v1.
 */
export function writePieceArt(prev: Record<string, unknown> | null | undefined, art: PieceArt, studio: Record<string, unknown>): Record<string, unknown> {
  const family = art.template.family;
  return {
    ...(prev ?? {}), ...studio,
    v: 2, template: art.template, composition: art.composition, surface: art.surface, effects: constrainEffects(art.effects, family),
    container: { color: art.surface.color }, anatomy: FAMILY_ANATOMY[family],
  };
}

/** Campos do fundo artístico (Background Studio) dentro do config. */
export const STUDIO_KEYS = ["color", "gradient", "gradientPresetId", "seasonalPresetId", "aura", "materialId", "aiArt", "uploadUrl", "animation", "posterUrl", "skin"] as const;
export function studioPart(bg?: Record<string, unknown> | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of STUDIO_KEYS) if (bg && bg[k] !== undefined) out[k] = bg[k];
  return out;
}
