/**
 * O que duas cartas têm em comum, pelos dados que a carta já traz (marca, subcategoria, categoria, estilo, cor e
 * ocasião): serve só de pista na bandeja, para a pessoa ver quais cartas conversam com as vizinhas. Quem decide a
 * cor da linha e a química é sempre o servidor (/conferir), que também conta famílias e harmonias de cor.
 */
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";

export type Atributo = "MARCA" | "SUBCATEGORIA" | "CATEGORIA" | "ESTILO" | "COR" | "OCASIAO";

const igual = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

const cruzam = (a?: string[] | null, b?: string[] | null) => !!a && !!b && a.some((x) => b.some((y) => igual(x, y)));

/** Atributos que as duas cartas têm iguais. */
export function emComum(a: FlairCollectionCard, b: FlairCollectionCard): Atributo[] {
  const sai: Atributo[] = [];
  if (igual(a.brandName, b.brandName)) sai.push("MARCA");
  if (igual(a.subcategory, b.subcategory)) sai.push("SUBCATEGORIA");
  if (igual(a.category, b.category)) sai.push("CATEGORIA");
  if (cruzam(a.tags?.styles, b.tags?.styles)) sai.push("ESTILO");
  if (cruzam(a.tags?.colors, b.tags?.colors)) sai.push("COR");
  if (cruzam(a.tags?.occasions, b.tags?.occasions)) sai.push("OCASIAO");
  return sai;
}

/** Atributos que a carta tem em comum com alguma das cartas vizinhas (sem repetir), na ordem acima. */
export function emComumComVizinhas(carta: FlairCollectionCard, vizinhas: FlairCollectionCard[]): Atributo[] {
  const todos = new Set(vizinhas.filter((v) => v.id !== carta.id).flatMap((v) => emComum(carta, v)));
  return (["MARCA", "SUBCATEGORIA", "CATEGORIA", "ESTILO", "COR", "OCASIAO"] as Atributo[]).filter((a) => todos.has(a));
}
