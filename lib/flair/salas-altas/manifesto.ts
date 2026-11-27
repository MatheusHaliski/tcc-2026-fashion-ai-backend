/**
 * Salas high poly (perfil `high` do motor Blender, scripts/blender3d_high): cada sala tem um GLB por nível de detalhe
 * (`alto` e `medio`, meshopt + instancing), o mapa de ambiente capturado no Cycles e a lista dos modelos prontos que
 * entram nela (os GLB do MET Gala Heist, gerados pela Meshy, apontados no lugar em que já estão). Sem o manifesto, sem
 * a entrada da sala ou na qualidade Baixa, o jogo desenha a sala procedural de sempre.
 */
import type { Qualidade } from "@/lib/flair/nucleos/scene/qualidade";

export const SALAS_ALTAS_MANIFESTO = "/flair/3d/salas/manifest.json";

export type NivelDaSala = "alto" | "medio";

export interface ArquivoDoNivel {
  url: string;
  triangles: number;
  calls: number;
  bytes: number;
}

export interface ImportadoNaSala {
  model: string;
  /** o arquivo original (alto) e a versão simplificada (médio) */
  url: string;
  medium?: string;
  /** base do modelo no espaço da sala, giro em graus em torno do eixo vertical e altura final em metros */
  pos: [number, number, number];
  rotation: number;
  height: number;
  credit?: string;
}

export interface SalaAlta {
  slug: string;
  title?: string;
  games: string[];
  environment?: string;
  levels: Partial<Record<NivelDaSala, ArquivoDoNivel>>;
  imports: ImportadoNaSala[];
}

const numero = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const tripla = (v: unknown): [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number") ? (v as [number, number, number]) : [0, 0, 0];

function nivel(v: unknown): ArquivoDoNivel | undefined {
  if (!v || typeof v !== "object" || typeof (v as { url?: unknown }).url !== "string") return undefined;
  const n = v as Record<string, unknown>;
  return { url: String(n.url), triangles: numero(n.triangles), calls: numero(n.calls), bytes: numero(n.bytes) };
}

function importado(v: unknown): ImportadoNaSala | null {
  if (!v || typeof v !== "object") return null;
  const i = v as Record<string, unknown>;
  if (typeof i.url !== "string" || typeof i.model !== "string") return null;
  return {
    model: i.model, url: i.url, medium: typeof i.medium === "string" ? i.medium : undefined, pos: tripla(i.pos),
    rotation: numero(i.rotation), height: numero(i.height) || 1, credit: typeof i.credit === "string" ? i.credit : undefined,
  };
}

/** Lê o manifesto como veio do arquivo; entradas sem slug ou sem nenhum nível ficam de fora. */
export function lerSalasAltas(json: unknown): SalaAlta[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((s): SalaAlta[] => {
    if (!s || typeof s !== "object" || typeof (s as { slug?: unknown }).slug !== "string") return [];
    const d = s as Record<string, unknown>;
    const niveis = (d.levels ?? {}) as Record<string, unknown>;
    const levels: SalaAlta["levels"] = { alto: nivel(niveis.alto), medio: nivel(niveis.medio) };
    if (!levels.alto && !levels.medio) return [];
    return [{
      slug: String(d.slug), title: typeof d.title === "string" ? d.title : undefined,
      games: Array.isArray(d.games) ? d.games.map(String) : [], environment: typeof d.environment === "string" ? d.environment : undefined,
      levels, imports: Array.isArray(d.imports) ? d.imports.map(importado).filter((i): i is ImportadoNaSala => !!i) : [],
    }];
  });
}

/** Largura de tela (px) abaixo da qual a sala vai no nível médio mesmo na qualidade Alta (celular). */
export const TELA_ESTREITA = 768;

/**
 * O nível da sala pela qualidade: Alta = alto (médio em tela estreita), Média = médio, Baixa = nenhum (a sala
 * procedural, a mais leve). Sem o nível pedido no arquivo, vale o outro.
 */
export function nivelDaSala(sala: SalaAlta, qualidade: Qualidade, larguraDaTela: number): NivelDaSala | null {
  if (qualidade === "BAIXA") return null;
  const quer: NivelDaSala = qualidade === "ALTA" && larguraDaTela >= TELA_ESTREITA ? "alto" : "medio";
  if (sala.levels[quer]) return quer;
  return sala.levels.alto ? "alto" : sala.levels.medio ? "medio" : null;
}

/** O arquivo do modelo pronto no nível: no médio, a versão simplificada quando existe. */
export const arquivoDoImportado = (i: ImportadoNaSala, n: NivelDaSala): string => (n === "medio" && i.medium ? i.medium : i.url);

/** Slug da sala do Fashion Detective ("SALAO" → "detetive-salao"). */
export const slugDoDetetive = (sala: string): string => `detetive-${sala.toLowerCase()}`;

export const salaAltaPorSlug = (lista: SalaAlta[], slug: string | null | undefined): SalaAlta | null =>
  (slug && lista.find((s) => s.slug === slug)) || null;
