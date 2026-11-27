/**
 * ACERVO — modelos GLB de marcenaria e de roupas (public/acervo/3d/<slug>.glb, listados em manifest.json). Hoje a pasta
 * só tem o manifesto, vazio (assim a cena não pede um arquivo que não existe): tudo na cena é procedural. Quando um GLB for publicado e entrar no
 * manifesto com o encaixe certo, ele substitui a parte procedural daquele encaixe; sem o arquivo, a cena continua como
 * está. O formato segue o dos objetos das salas do FLAIR 3D (lib/flair/nucleos/scene/assets.ts).
 */
import { lerManifesto, type AssetGlb } from "@/lib/flair/nucleos/scene/assets";
import type { AcervoPuxador } from "@/lib/acervo/types";

export const ACERVO_GLB_PASTA = "/acervo/3d";
export const ACERVO_GLB_MANIFESTO = `${ACERVO_GLB_PASTA}/manifest.json`;

/** Encaixes que aceitam um GLB no lugar da forma procedural. */
export type EncaixeGlb = "roupa-pendurada" | "roupa-dobrada" | "calcado" | "puxador-barra" | "puxador-botao" | "puxador-cava";
export const ENCAIXES: EncaixeGlb[] = ["roupa-pendurada", "roupa-dobrada", "calcado", "puxador-barra", "puxador-botao", "puxador-cava"];

export const urlDoGlbDoAcervo = (slug: string): string => `${ACERVO_GLB_PASTA}/${slug}.glb`;

export function lerManifestoDoAcervo(json: unknown): AssetGlb[] {
  return lerManifesto(json).filter((a) => (ENCAIXES as string[]).includes(a.movel ?? a.slug));
}

/** O GLB publicado para o encaixe, ou nulo (a cena usa a forma procedural). */
export function glbDoEncaixe(encaixe: EncaixeGlb, manifesto: AssetGlb[]): AssetGlb | null {
  return manifesto.find((a) => (a.movel ?? a.slug) === encaixe) ?? null;
}

export function encaixeDaRoupa(categoria: string, pendurada: boolean): EncaixeGlb {
  if (categoria === "shoes_piece") return "calcado";
  return pendurada ? "roupa-pendurada" : "roupa-dobrada";
}

export function encaixeDoPuxador(puxador: AcervoPuxador): EncaixeGlb | null {
  if (puxador === "BARRA") return "puxador-barra";
  if (puxador === "BOTAO") return "puxador-botao";
  return puxador === "CAVA" ? "puxador-cava" : null;
}
