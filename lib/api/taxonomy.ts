"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { PT_LABELS } from "@/lib/api/labels-pt";

export interface Taxonomy {
  subcategories: Record<string, string[]>; colors: Record<string, string>; colorFamilies?: Record<string, string>; materials: string[]; sizes: string[]; sexes: string[];
  occasions: string[]; styles: string[]; allowedOccasionsByCategory: Record<string, string[]>; pieceSeals: string[]; schemeSeals: string[];
  brands: { id: string; name: string; slug: string; logoUrl?: string | null }[]; marketSeasons?: string[]; marketGenders?: string[];
}
let cache: Taxonomy | null = null;
export function useTaxonomy() {
  const [tax, setTax] = useState<Taxonomy | null>(cache);
  useEffect(() => { if (cache) return; api.get<Taxonomy>("/api/taxonomy", { anonymous: true }).then((t) => { cache = t; setTax(t); }).catch(() => undefined); }, []);
  return tax;
}
export const CATEGORY_LABEL: Record<string, string> = { upper_piece: "Parte superior", lower_piece: "Parte inferior", shoes_piece: "Calçados", accessory_piece: "Acessórios", full_body_piece: "Corpo inteiro" };
/** Idioma dos rótulos de taxonomia — o I18nProvider atualiza quando o usuário troca de idioma. */
let labelLocale = "pt-BR";
export const setLabelLocale = (l: string) => { labelLocale = l; };
/** Rótulo legível de uma chave da taxonomia: em pt-BR usa o dicionário; nos demais idiomas, a própria chave formatada. */
export const label = (s?: string | null) => {
  const key = (s ?? "").trim();
  if (labelLocale === "pt-BR") { const pt = PT_LABELS[key.toLowerCase()]; if (pt) return pt; }
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
};
