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
    }));
}

/** O objeto GLB disponível para o móvel (nulo: o móvel não aponta um slug ou o arquivo não está no manifesto). */
export function glbDoMovel(m: Movel, manifesto: ManifestoGlb): AssetGlb | null {
  if (!m.glb) return null;
  return manifesto.find((a) => a.slug === m.glb?.slug) ?? null;
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
