import manifest from "@/lib/assets/default-garments.json";
import { defaultGarmentUrl } from "@/lib/catalog/default-garment";
import { isCategoryIllustration } from "@/lib/avatar3d/human/default-outfit";
import { mediaUrl, thumbUrl } from "@/lib/api/client";

/**
 * Uma só fonte para a imagem de uma peça em qualquer superfície (miniatura, carta, capa de look, ACERVO, desafio,
 * lavanderia, espelho). A peça cadastrada sem foto guarda como imagem a ilustração da categoria, que tem cor própria
 * (camiseta azul, bota laranja). Quando a cor do cadastro é conhecida, a miniatura passa a ser a mesma ilustração
 * pintada nessa cor (como no card do guarda-roupa); a foto real da peça continua como está.
 */
export type PieceImageInput = {
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  defaultImage?: boolean | null;
  category?: string | null;
  subcategory?: string | null;
  colorHex?: string | null;
  color?: string | null;
};

type Kind = { category: string; subcategory: string | null };

/** "/assets_pecas/01_Parte_superior/01_camiseta_referencia.png" e a miniatura derivada viram a mesma chave. */
function illustrationKey(url: string): string {
  const path = decodeURI(url.split("?")[0]);
  const derived = path.match(/^\/_derived\/pecas_thumb\/(.+?)-\d+\.webp$/i);
  if (derived) return derived[1].toLowerCase();
  return path.replace(/^\/assets_pecas\//i, "").replace(/\.[a-z0-9]+$/i, "").split("/").join("_").toLowerCase();
}

const KIND_BY_KEY: Map<string, Kind> = (() => {
  const out = new Map<string, Kind>();
  for (const [category, url] of Object.entries(manifest.categories)) out.set(illustrationKey(url), { category, subcategory: null });
  for (const [subcategory, v] of Object.entries(manifest.subcategories)) out.set(illustrationKey(v.url), { category: v.category, subcategory });
  return out;
})();

/** Foto de estúdio gerada a partir da ilustração (".../media/defaults/studio/01_camiseta_referencia/…"): também é azul. */
const STUDIO_DEFAULT = /\/media\/defaults\/studio\/([^/]+)\//i;

/** A imagem é a ilustração da categoria (ou a foto de estúdio feita dela), não uma foto da peça. */
export function isIllustration(url?: string | null): boolean {
  return !!url && (isCategoryIllustration(url) || STUDIO_DEFAULT.test(url));
}

/** Tipo da peça a partir da própria ilustração (para as superfícies que recebem só a URL e a cor). */
export function kindOfIllustration(url?: string | null): Kind | null {
  if (!url) return null;
  const studio = url.match(STUDIO_DEFAULT);
  if (studio) {
    const stem = "_" + studio[1].toLowerCase();
    for (const [key, kind] of KIND_BY_KEY) if (key.endsWith(stem)) return kind;
    return null;
  }
  if (!isCategoryIllustration(url)) return null;
  return KIND_BY_KEY.get(illustrationKey(url)) ?? null;
}

function hasColour(p: PieceImageInput): boolean {
  return !!(p.colorHex?.trim() || p.color?.trim());
}

/** A peça não tem foto própria: só a ilustração da categoria (ou nenhuma imagem). */
export function isWithoutPhoto(p: PieceImageInput): boolean {
  const raw = p.thumbnailUrl || p.imageUrl;
  return p.defaultImage === true || !raw || isIllustration(raw) || isIllustration(p.imageUrl);
}

/**
 * URL da imagem da peça para mostrar na tela. Sem foto e com cor cadastrada: a ilustração na cor do cadastro.
 * Com foto: a miniatura (quando `size` é dado) ou a imagem original.
 */
export function pieceImageUrl(p: PieceImageInput, size?: 320 | 640): string | undefined {
  const raw = p.thumbnailUrl || p.imageUrl;
  if (isWithoutPhoto(p) && hasColour(p)) {
    const kind = kindOfIllustration(p.imageUrl) ?? kindOfIllustration(p.thumbnailUrl);
    const category = p.category ?? kind?.category ?? null;
    const subcategory = p.subcategory ?? (kind && kind.category === category ? kind.subcategory : null);
    if (category || kind) return defaultGarmentUrl(category, subcategory, p.colorHex, p.color, "WHOLE");
  }
  return size ? thumbUrl(raw, size) : mediaUrl(raw);
}
