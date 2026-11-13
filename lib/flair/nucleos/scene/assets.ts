/**
 * Objetos GLB licenciados das salas (public/flair/3d/assets/<slug>.glb, listados em manifest.json). Um móvel da
 * descrição pode apontar um slug; quando o arquivo está no manifesto, ele entra no lugar das partes procedurais, e
 * os triângulos dele (do manifesto) entram no orçamento. Sem o arquivo, a sala continua toda procedural.
 */
import type { Movel } from "@/lib/flair/nucleos/scene/types";

export const GLB_PASTA = "/flair/3d/assets";
export const GLB_MANIFESTO = `${GLB_PASTA}/manifest.json`;

export interface AssetGlb {
  slug: string;
  title?: string;
  /** códigos dos jogos em que o objeto serve */
  games?: string[];
  category?: string;
  triangles: number;
  bytes?: number;
  /** tipo de móvel procedural que o objeto substitui (opcional; sem ele vale o slug igual ao tipo em kebab-case) */
  movel?: string;
}

export type ManifestoGlb = AssetGlb[];

export const urlDoGlb = (slug: string): string => `${GLB_PASTA}/${slug}.glb`;

/** Lê o manifesto como veio do arquivo: aceita a lista direta ou `{assets: [...]}` e descarta entradas sem slug. */
export function lerManifesto(json: unknown): ManifestoGlb {
  const lista = Array.isArray(json) ? json : json && typeof json === "object" ? (json as { assets?: unknown }).assets : null;
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((a): a is Record<string, unknown> => !!a && typeof a === "object" && typeof (a as { slug?: unknown }).slug === "string")
    .map((a) => ({
      slug: String(a.slug),
      title: typeof a.title === "string" ? a.title : undefined,
      games: Array.isArray(a.games) ? a.games.map(String) : undefined,
      category: typeof a.category === "string" ? a.category : undefined,
      triangles: Number(a.triangles) > 0 ? Number(a.triangles) : 0,
      bytes: typeof a.bytes === "number" ? a.bytes : undefined,
      movel: typeof a.movel === "string" ? a.movel : undefined,
    }));
}

/** Slug convencionado de um tipo de móvel: "cadeiraDiretor" → "cadeira-diretor". */
export function slugDoTipo(tipo: string): string {
  return tipo.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * O objeto GLB disponível para o móvel, ou nulo (a sala usa as partes procedurais). Vale, nesta ordem: o slug que a
 * descrição aponta (`glb.slug`); um objeto do manifesto marcado para o tipo do móvel (`movel`) ou com o slug
 * convencionado do tipo — estes dois só quando o objeto serve ao jogo da sala (`games` vazio = todos).
 */
export function glbDoMovel(m: Movel, manifesto: ManifestoGlb, codigo?: string): AssetGlb | null {
  if (manifesto.length === 0) return null;
  if (m.glb) return manifesto.find((a) => a.slug === m.glb?.slug) ?? null;
  const serve = (a: AssetGlb) => !a.games || a.games.length === 0 || (!!codigo && a.games.includes(codigo));
  const convencionado = slugDoTipo(m.tipo);
  return manifesto.find((a) => serve(a) && (a.movel === m.tipo || a.slug === convencionado)) ?? null;
}

/** Altura do móvel procedural (do piso dele ao topo), usada para ajustar a escala do GLB. */
export function alturaDoMovel(m: Movel): number {
  let topo = 0;
  for (const p of m.partes) {
    const meia = p.forma === "esfera" ? p.tam[1] : p.forma === "plano" || p.forma === "caixa" || p.forma === "chanfrada" || p.forma === "cilindro" ? p.tam[1] / 2 : p.tam[2];
    topo = Math.max(topo, p.pos[1] + meia);
  }
  return topo;
}
