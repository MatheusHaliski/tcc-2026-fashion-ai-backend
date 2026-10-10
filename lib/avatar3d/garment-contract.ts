/**
 * Contrato de dados da vestimenta 3D (docs/avatar3d/PIPELINE_VESTIMENTAS_3D.md §2): o que o provador sabe de uma peça
 * antes de construí-la, com a origem de cada informação. Nada aqui inventa medida, tecido ou parte oculta — o que não
 * veio do cadastro, do catálogo ou da foto fica MISSING, e o resultado de um molde é sempre uma aproximação declarada.
 *
 *   CONFIRMED  cadastro da peça, ficha do catálogo ou revisão da pessoa
 *   ESTIMATED  inferido (da subcategoria, da foto, da categoria/lugar no look), com origem e confiança
 *   MISSING    precisa de referência adicional (medida, composição, asset) — não bloqueia o cadastro
 *
 * Três caminhos de construção (§3): APPROVED_ASSET (geometria e materiais próprios da peça — ainda não existe no
 * repositório), PARAMETRIC_MOULD (molde da família adaptado ao corpo: aproximação) e IMAGE_2D (só a prévia 2D; é o
 * caso dos acessórios, que o avatar humano ainda não veste).
 */
import type { Look3dPiece } from "@/components/three/common";
import { SPECS, kindOf, type GarmentKind } from "@/lib/avatar3d/human/garments";

export const GARMENT_CONTRACT_VERSION = "1.0.0";
/** Molde e corpo: mudar qualquer um invalida os resultados aprovados que dependem dele (§7). */
export const MOULD_VERSION = "fai-mould-skinwrap-v1";
export const BODY_RIG = "fai-body-v1";
/** Margem de colisão corpo–roupa usada no teste de penetração (lib/avatar3d/human/garments.test.ts): 2 mm para dentro da pele. */
export const COLLISION_MARGIN_MM = 2;

export type Provenance = "CONFIRMED" | "ESTIMATED" | "MISSING";
export interface Attr<T> { value: T | null; provenance: Provenance; source: string; confidence?: number }
export type BuildPath = "APPROVED_ASSET" | "PARAMETRIC_MOULD" | "IMAGE_2D";
export type GarmentFamily = "TOPS" | "BOTTOMS" | "SKIRTS" | "FULL_BODY" | "OUTERWEAR" | "SHOES" | "ACCESSORIES";

export interface GarmentContract {
  version: string;
  identity: { pieceId: string; catalogProductId: string | null; variantId: string | null; category: string | null; subcategory: string | null; family: GarmentFamily | null };
  cut: { kind: Attr<GarmentKind>; length: Attr<string>; sleeve: Attr<string>; neckline: Attr<string>; opening: Attr<string>; silhouette: Attr<string> };
  dimensions: { measurementsCm: Attr<Record<string, number>>; commercialSize: Attr<string>; referenceBody: Attr<string> };
  surface: { color: Attr<string>; print: Attr<"PLAIN" | "PRINT" | "LOGO">; photo: Attr<string>; uv: "FRONT_PROJECTION" | "PANEL_UV" | "NONE"; maps: { baseColor: string; normal: string | null; roughness: string | null } };
  fabric: { material: Attr<string>; physicalThicknessMm: Attr<number>; visualThicknessMm: number | null; collisionMarginMm: number; behaviour: { drape: number | null; stiffness: Attr<number> } };
  fit: { easeM: number | null; anchors: string[]; bodyCompatibility: "ALL" | "UNKNOWN" };
  asset: { path: BuildPath; renderMesh: string | null; simulationMesh: string | null; rig: string | null; lods: number[]; assetVersion: string | null; mouldVersion: string | null };
  quality: { origin: "WARDROBE" | "CATALOG" | "DEFAULT" | "UNKNOWN"; approximation: boolean; reviewed: boolean; confidence: number; tests: string[]; approved: boolean; notes: string[] };
}

const confirmed = <T,>(value: T, source: string): Attr<T> => ({ value, provenance: "CONFIRMED", source });
const estimated = <T,>(value: T | null, source: string, confidence: number): Attr<T> => ({ value, provenance: "ESTIMATED", source, confidence });
const APPROVED: BuildPath = "APPROVED_ASSET";
const missing = <T,>(source: string): Attr<T> => ({ value: null, provenance: "MISSING", source });

const FAMILY: Record<GarmentKind, GarmentFamily> = {
  tee: "TOPS", tank: "TOPS", longsleeve: "TOPS", shirt: "TOPS", sweater: "TOPS", hoodie: "TOPS", crop: "TOPS",
  jacket: "OUTERWEAR", coat: "OUTERWEAR", dress: "FULL_BODY", jumpsuit: "FULL_BODY",
  skirt: "SKIRTS", pants: "BOTTOMS", shorts: "BOTTOMS", leggings: "BOTTOMS", shoes: "SHOES", boots: "SHOES",
};
/** O que cada família do molde controla hoje (§4); o que não está aqui é MISSING no contrato. */
export const FAMILY_PARAMETERS: Record<GarmentFamily, string[]> = {
  TOPS: ["ombros (molde da pele)", "mangas (comprimento por tipo)", "gola (faixa 3D, decote por tipo)", "busto (anel)", "barra (comprimento por tipo)", "folga do tronco (ease)"],
  OUTERWEAR: ["estrutura (camada e folga)", "espessura visual (ease)", "fechamento (aberto na frente, sem botões)", "espaço para sobreposição (underLayer)"],
  BOTTOMS: ["cós (altura)", "quadril", "pernas (tubo por tipo)", "comprimento por tipo", "abertura: não modelada"],
  SKIRTS: ["cintura", "volume (flare)", "comprimento por tipo", "barra: tubo rígido, sem simulação"],
  FULL_BODY: ["continuidade tronco–pernas", "decote", "comprimento", "cobertura entre regiões"],
  SHOES: ["fôrma por estilo (shoes.ts)", "sola com espessura", "cadarço e colarinho", "contato com o chão (SOLE_LIFT)", "cores do cabedal e da sola (foto)"],
  ACCESSORIES: [],
};

/** Comprimento, manga e decote que o molde da família assume para o tipo (do GarmentSpec), como estimativa declarada. */
function cutOf(kind: GarmentKind | null): Pick<GarmentContract["cut"], "length" | "sleeve" | "neckline" | "opening" | "silhouette"> {
  if (!kind) return { length: missing("sem molde"), sleeve: missing("sem molde"), neckline: missing("sem molde"), opening: missing("sem molde"), silhouette: missing("sem molde") };
  const sp = SPECS[kind]; const src = `molde ${kind} (SPECS)`;
  const length = kind === "pants" || kind === "leggings" ? "full_leg" : kind === "shorts" ? "above_knee" : kind === "crop" ? "cropped" : kind === "coat" || kind === "dress" ? "long" : "hip";
  const sleeve = sp.sleeve === 0 ? "sleeveless" : sp.sleeve > 0.8 ? "long" : "short";
  const neckline = sp.vneck ? "v" : sp.neck > 0.5 ? "high" : "crew";
  const opening = kind === "jacket" || kind === "coat" || kind === "shirt" ? "front" : "none";
  const silhouette = sp.flare > 0.3 ? "flared" : sp.ease > 0.02 ? "relaxed" : "fitted";
  return { length: estimated(length, src, 0.6), sleeve: estimated(sleeve, src, 0.6), neckline: estimated(neckline, src, 0.5), opening: estimated(opening, src, 0.7), silhouette: estimated(silhouette, src, 0.5) };
}

/**
 * Contrato de uma peça do look: categoria/subcategoria do cadastro encaminham a família e o molde; o que a foto e o
 * cadastro dizem entra com a origem; medidas, composição e asset próprio ficam MISSING até existirem.
 */
export function garmentContractOf(piece: Look3dPiece, extra: { material?: string | null; size?: string | null; catalogProductId?: string | null; variantId?: string | null; origin?: GarmentContract["quality"]["origin"] } = {}): GarmentContract {
  const bySub = piece.subcategory ? kindOf({ subcategory: piece.subcategory }) : null;
  const kind = kindOf(piece);
  const kindAttr: Attr<GarmentKind> = bySub ? confirmed(bySub, "subcategoria do cadastro") : kind ? estimated(kind, "categoria/lugar no look (subcategoria desconhecida)", 0.5) : missing("sem subcategoria conhecida: acessório ou tipo fora do molde");
  const family: GarmentFamily | null = kind ? FAMILY[kind] : piece.category?.toLowerCase().includes("accessory") || piece.slot === "accessory" ? "ACCESSORIES" : null;
  const path: BuildPath = kind ? "PARAMETRIC_MOULD" : "IMAGE_2D";
  const photo: Attr<string> = piece.imageUrl ? confirmed(piece.imageUrl, "foto da peça (recortada)") : piece.studioUrl ? estimated(piece.studioUrl, "foto de estúdio (fundo separado por cor)", 0.7) : missing("sem foto: só a cor do cadastro");
  const color: Attr<string> = piece.colorHex ? confirmed(piece.colorHex, "cor do cadastro") : photo.value ? estimated<string>(null, "mediana da foto (calculada ao vestir)", 0.6) : missing("sem cor nem foto");
  const notes: string[] = [];
  if (path === "PARAMETRIC_MOULD") notes.push("Molde da família adaptado ao corpo: aproximação visual, não reprodução fiel da peça.");
  if (path === "IMAGE_2D") notes.push("Acessório ou tipo sem molde: só a prévia 2D; o avatar humano não veste.");
  if (photo.provenance === "ESTIMATED") notes.push("Foto com fundo: a peça é separada do fundo por cor (menos precisa que o recorte).");
  if (piece.defaultImage) notes.push("Imagem padrão da categoria: cor do cadastro, sem estampa.");
  return {
    version: GARMENT_CONTRACT_VERSION,
    identity: { pieceId: piece.id, catalogProductId: extra.catalogProductId ?? null, variantId: extra.variantId ?? null, category: piece.category ?? null, subcategory: piece.subcategory ?? null, family },
    cut: { kind: kindAttr, ...cutOf(kind) },
    dimensions: { measurementsCm: missing("sem medidas no cadastro/catálogo"), commercialSize: extra.size ? confirmed(extra.size, "tamanho do cadastro") : missing("sem tamanho"), referenceBody: kind ? estimated(BODY_RIG, "corpo padrão do avatar", 1) : missing("sem molde") },
    surface: { color, print: photo.value ? estimated(piece.defaultImage ? "PLAIN" : "PRINT", "foto projetada na frente", 0.5) : missing("sem foto"), photo,
      uv: kind && photo.value && kind !== "shoes" && kind !== "boots" ? "FRONT_PROJECTION" : "NONE", maps: { baseColor: photo.value ? "foto + cor do tecido (canvas)" : "cor do tecido", normal: null, roughness: null } },
    fabric: { material: extra.material ? confirmed(extra.material, "material do cadastro") : missing("sem composição"), physicalThicknessMm: missing("sem espessura física: nenhuma simulação"),
      visualThicknessMm: kind ? Math.round(SPECS[kind].ease * 1000 * 10) / 10 : null, collisionMarginMm: COLLISION_MARGIN_MM, behaviour: { drape: kind ? SPECS[kind].drape : null, stiffness: missing("sem parâmetro de tecido") } },
    fit: { easeM: kind ? SPECS[kind].ease : null, anchors: kind ? ["esqueleto do corpo (pesos copiados da pele)"] : [], bodyCompatibility: kind ? "ALL" : "UNKNOWN" },
    asset: { path, renderMesh: kind ? `molde:${kind}` : null, simulationMesh: null, rig: kind ? BODY_RIG : null, lods: kind ? [0] : [], assetVersion: null, mouldVersion: kind ? MOULD_VERSION : null },
    quality: { origin: extra.origin ?? (piece.id.startsWith("fai-padrao-") ? "DEFAULT" : "UNKNOWN"), approximation: path !== APPROVED, reviewed: false,
      confidence: kindAttr.provenance === "CONFIRMED" ? 0.8 : kindAttr.provenance === "ESTIMATED" ? 0.5 : 0.2, tests: [], approved: false, notes },
  };
}

/** Linha curta para diagnóstico na interface ("preparando / ajustando / concluído" vem do estado do provador). */
export function contractSummary(c: GarmentContract): string {
  const kind = c.cut.kind.value ?? "—";
  return `${c.identity.subcategory ?? c.identity.category ?? "?"} → ${c.identity.family ?? "?"}/${kind} · ${c.asset.path}${c.quality.approximation ? " (aproximação)" : ""} · cor ${c.surface.color.provenance.toLowerCase()} · foto ${c.surface.photo.provenance.toLowerCase()}`;
}
