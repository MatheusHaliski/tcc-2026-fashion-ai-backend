/**
 * RF25 — os três tipos de selo do criador e os modelos de cada um (catálogo gerado por scripts/selos/build_templates.py
 * a partir das artes enviadas; o backend valida os mesmos ids em SealDesigns):
 *  - CIRCULAR: anel com o centro livre; o núcleo é editável: elemento (sacola FAI, coroa, monograma…), imagem enviada
 *    ou texto.
 *    O gerador de medalhões (paleta/padrão/material) e o upload de um selo pronto também são selos circulares;
 *  - FOLHA: selo de folha picotada (4:5); todos os textos (série, título, subtítulo, rótulo, legenda, ano e o texto do
 *    emblema) são editáveis e o emblema central pode virar uma imagem enviada ou um texto;
 *  - FASHIONAI: o medalhão padrão do FashionAI, pronto (a arte escolhida é o selo inteiro).
 */
import catalog from "./templates.json";

export type SealKind = "CIRCULAR" | "FOLHA" | "FASHIONAI";
export const SEAL_KINDS: SealKind[] = ["CIRCULAR", "FOLHA", "FASHIONAI"];

export interface FaiTemplate { id: string; src: string; color: string }
/** `center`: raio do disco liso do centro (fração do raio do selo); `plain`: o centro é liso (sem estampa). */
export interface CircularTemplate { id: string; src: string; center: number; plain: boolean; color: string }
/** Texto editável da folha: posição e estilo medidos na arte original (`m` = matriz SVG até a raiz). */
export interface FolhaSlot { text: string; x: number; y: number; m: number[]; size: number; weight: string; family: string; italic: boolean; ls: number; anchor: string; fill: string; opacity: number; w: number }
export type FolhaSlotKey = "series" | "title" | "subtitle" | "style" | "caption" | "year" | "emblem";
/** Folha em camadas: arte sem textos (`src`), emblema central recortado (`emblem`, trocável) e os textos (`slots`). */
export interface FolhaTemplate { id: string; src: string; emblem: { src: string; x: number; y: number; w: number; h: number } | null; ink: string; style: string; slots: Partial<Record<FolhaSlotKey, FolhaSlot>> }
/** Ordem dos campos de texto no editor e limite de caracteres de cada um (o backend aplica os mesmos). */
export const FOLHA_TEXT_LIMITS: Record<FolhaSlotKey, number> = { title: 22, series: 40, subtitle: 36, style: 28, caption: 40, year: 6, emblem: 4 };
/** Caixa do núcleo quando a folha não tem emblema recortado (monograma no painel). */
export const FOLHA_DEFAULT_CORE = { x: 70, y: 118, w: 100, h: 100 };

export const FAI_TEMPLATES: FaiTemplate[] = catalog.fai;
export const CIRCULAR_TEMPLATES: CircularTemplate[] = catalog.circular;
export const FOLHA_TEMPLATES = catalog.folha as FolhaTemplate[];

/** Proporção da folha (largura/altura) — viewBox 240×300 da arte original. */
export const FOLHA_RATIO = 240 / 300;
export const LABEL_MAX = 22;
export const CAPTION_MAX = 40;
export const CORE_TEXT_MAX = 24;

const BY_ID = new Map<string, FaiTemplate | CircularTemplate | FolhaTemplate>([...FAI_TEMPLATES, ...CIRCULAR_TEMPLATES, ...FOLHA_TEMPLATES].map((t) => [t.id, t]));

export function kindOfTemplate(id?: string | null): SealKind | null {
  if (!id) return null;
  if (id.startsWith("fai/")) return "FASHIONAI";
  if (id.startsWith("folha/")) return "FOLHA";
  if (id.startsWith("circular/")) return "CIRCULAR";
  return null;
}
export const faiTemplate = (id?: string | null) => (id?.startsWith("fai/") ? (BY_ID.get(id) as FaiTemplate | undefined) : undefined);
export const circularTemplate = (id?: string | null) => (id?.startsWith("circular/") ? (BY_ID.get(id) as CircularTemplate | undefined) : undefined);
export const folhaTemplate = (id?: string | null) => (id?.startsWith("folha/") ? (BY_ID.get(id) as FolhaTemplate | undefined) : undefined);

/** Primeiro modelo de cada tipo: ponto de partida ao trocar de tipo no criador. */
export const FIRST_TEMPLATE: Record<SealKind, string> = { CIRCULAR: CIRCULAR_TEMPLATES[0].id, FOLHA: FOLHA_TEMPLATES[0].id, FASHIONAI: FAI_TEMPLATES[0].id };

function rgb(hex: string): [number, number, number] { const n = parseInt(hex.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
/** Modelo de cor mais próxima (distância RGB ponderada pela percepção) — usado pelo modo "Com IA". */
export function nearestByColor<T extends { color: string }>(list: T[], hex: string): T {
  const [r, g, b] = rgb(hex);
  let best = list[0], bd = Infinity;
  for (const t of list) { const [r2, g2, b2] = rgb(t.color); const rm = (r + r2) / 2; const d = (2 + rm / 256) * (r - r2) ** 2 + 4 * (g - g2) ** 2 + (2 + (255 - rm) / 256) * (b - b2) ** 2; if (d < bd) { bd = d; best = t; } }
  return best;
}
