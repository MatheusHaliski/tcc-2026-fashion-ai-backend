import type { Taxonomy } from "@/lib/api/taxonomy";
import { keepAllowed } from "@/lib/pieces/tags";

/**
 * Pré-preenchimento de /pieces/new pela URL. Atalhos do Explorador e das marcas mandam ?category=, ?brand= e ?q=; o
 * FashionAI Lens ("É minha" sem peça parecida, LensService.prefillHref) manda também ?subcategory=, ?color=, ?material=,
 * ?styles= (lista separada por vírgula), ?from=lens, ?scan= e ?detection=.
 */
export interface PiecePrefillParams {
  category?: string; subcategory?: string; brand?: string; query?: string; color?: string; material?: string; styles?: string;
  from?: string; scan?: string; detection?: string;
}

/** O que entra no formulário: só valores que existem na taxonomia (o resto é ignorado e o campo fica como estava). */
export interface PiecePrefill {
  category: string; subcategory: string; color: string; material: string; style: string[];
  /** nome da peça: a leitura do Lens ("Camiseta preta"); dos outros atalhos o ?q= é só a busca no catálogo */
  name: string;
  fromLens: boolean;
  /** leitura de origem (link "Voltar à leitura"), só quando o id é seguro para ir num caminho */
  scan: string | null;
}

const NAME_MAX = 80;
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Lê os parâmetros da URL (sem validar: a taxonomia pode ainda não ter chegado). */
export function readPiecePrefill(params: { get(name: string): string | null }): PiecePrefillParams {
  const v = (k: string) => params.get(k)?.trim() || undefined;
  return { category: v("category"), subcategory: v("subcategory"), brand: v("brand"), query: v("q"), color: v("color"), material: v("material"),
    styles: v("styles"), from: v("from"), scan: v("scan"), detection: v("detection") };
}

/** Código canônico da lista (sem diferenciar maiúsculas), ou "" quando não existe. */
const pick = (value: string | undefined, allowed: readonly string[] | null | undefined) => {
  const k = (value ?? "").trim().toLowerCase();
  return (k && allowed?.find((a) => a.toLowerCase() === k)) || "";
};

/** Tipo da peça: só um dos oferecidos pela tela (os chips do criador). */
export const validPieceCategory = (category: string | undefined, categories: readonly string[]) => pick(category, categories);

/**
 * Valida o pré-preenchimento na taxonomia: subtipo do próprio tipo, cor, material e até 2 estilos; valor desconhecido é
 * ignorado. Sem taxonomia (ainda carregando), só o que não depende dela (tipo, nome, origem); quem chama completa depois.
 */
export function validPiecePrefill(p: PiecePrefillParams, tax: Taxonomy | null, categories: readonly string[]): PiecePrefill {
  const category = validPieceCategory(p.category, categories);
  const fromLens = p.from === "lens";
  const styles = (p.styles ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    category,
    subcategory: tax && category ? pick(p.subcategory, tax.subcategories?.[category]) : "",
    color: tax ? pick(p.color, Object.keys(tax.colors ?? {})) : "",
    material: tax ? pick(p.material, tax.materials) : "",
    style: tax?.styles?.length ? keepAllowed(styles, tax.styles) : [],
    name: fromLens ? (p.query ?? "").slice(0, NAME_MAX) : "",
    fromLens,
    scan: fromLens && p.scan && SAFE_ID.test(p.scan) ? p.scan : null,
  };
}
