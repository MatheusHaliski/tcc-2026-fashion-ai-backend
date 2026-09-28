"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { PT_LABELS } from "@/lib/api/labels-pt";
import { EN_LABELS } from "@/lib/api/labels-en";
import { ES_LABELS } from "@/lib/api/labels-es";
import { PSEUDO_LOCALE, baseLocale, getCurrentLocale } from "@/lib/i18n/state";
import { pseudo } from "@/lib/i18n/pseudo";

export interface Taxonomy {
  subcategories: Record<string, string[]>; colors: Record<string, string>; colorFamilies?: Record<string, string>; materials: string[]; sizes: string[]; sexes: string[];
  occasions: string[]; styles: string[]; allowedOccasionsByCategory: Record<string, string[]>;
  /** imagem padrão (asset) por categoria e a genérica — preenchida na peça antes de qualquer upload (RF4) */ defaultImages?: Record<string, string>;
  /** imagem-asset de cada subcategoria (a prévia troca ao escolher o subtipo, enquanto não há foto) */ defaultImagesBySubcategory?: Record<string, string>;
  brands: { id: string; name: string; slug: string; logoUrl?: string | null }[]; marketSeasons?: string[]; marketGenders?: string[];
}
let cache: Taxonomy | null = null;
export function useTaxonomy() {
  const [tax, setTax] = useState<Taxonomy | null>(cache);
  useEffect(() => { if (cache) return; api.get<Taxonomy>("/api/taxonomy", { anonymous: true }).then((t) => { cache = t; setTax(t); }).catch(() => undefined); }, []);
  return tax;
}

const TABLES: Record<"pt-BR" | "en" | "es", Record<string, string>> = { "pt-BR": PT_LABELS, en: EN_LABELS, es: ES_LABELS };
export const CATEGORY_KEYS = ["upper_piece", "lower_piece", "shoes_piece", "accessory_piece", "full_body_piece"] as const;

/**
 * Rótulo legível de uma chave da taxonomia no idioma corrente (RF23): tabela do idioma → tabela pt-BR → a própria chave
 * formatada. No pseudo-idioma o rótulo sai pseudolocalizado, como qualquer texto do catálogo.
 */
export const label = (s?: string | null) => {
  const key = (s ?? "").trim();
  if (!key) return "";
  const locale = getCurrentLocale();
  const k = key.toLowerCase();
  const hit = TABLES[baseLocale(locale)][k] ?? PT_LABELS[k];
  const out = hit ?? key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return locale === PSEUDO_LOCALE ? pseudo(out) : out;
};

/** Rótulos das cinco categorias, sempre no idioma corrente (objeto vivo: `CATEGORY_LABEL[x]`, `Object.keys`, `Object.entries`). */
export const CATEGORY_LABEL: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_t, k) => (typeof k === "string" && (CATEGORY_KEYS as readonly string[]).includes(k) ? label(k) : undefined),
  has: (_t, k) => typeof k === "string" && (CATEGORY_KEYS as readonly string[]).includes(k),
  ownKeys: () => [...CATEGORY_KEYS],
  getOwnPropertyDescriptor: (_t, k) => (typeof k === "string" && (CATEGORY_KEYS as readonly string[]).includes(k) ? { enumerable: true, configurable: true, writable: false, value: label(k) } : undefined),
});
