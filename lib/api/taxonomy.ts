"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

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
export const label = (s?: string | null) => (s ?? "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
