/**
 * Globo do Painel global com camadas de Hype (RF53 × RF26) — regras puras, sem React: filtros ⇄ URL, o número de cada
 * camada, a geometria das colunas na projeção ortográfica, os bonecos por criadores e a escolha/empilhamento dos cards.
 * Uma codificação por canal: a ALTURA da coluna é a métrica escolhida (magnitude), a COR é sempre a faixa do Hype (com o
 * nome da faixa em texto ao lado), o número vai em texto.
 */
import { qs } from "@/lib/api/client";
import { LEVELS } from "./model";
import type { HypeEntity, HypeGlobeCountry, HypeLevel } from "./types";

export const GLOBE_LAYERS = ["numbers", "columns", "figures", "cards", "heat"] as const;
export type GlobeLayer = (typeof GLOBE_LAYERS)[number];
/** Camadas que abrem ligadas: números, colunas e cards. */
export const DEFAULT_GLOBE_LAYERS: GlobeLayer[] = ["numbers", "columns", "cards"];
export const GLOBE_METRICS = ["avg", "max", "volume", "growth"] as const;
export type GlobeMetric = (typeof GLOBE_METRICS)[number];
export type GlobeWindow = "1" | "7" | "30";

/** Estado do globo = o que está na URL (?layers&metric&type&window&category&minLevel). */
export interface GlobeFilters { layers: GlobeLayer[]; metric: GlobeMetric; type: HypeEntity; window: GlobeWindow; category: string; minLevel: HypeLevel | "" }

export function globeFiltersFrom(sp: Pick<URLSearchParams, "get"> | null | undefined): GlobeFilters {
  const get = (k: string) => (sp?.get(k) ?? "").trim();
  const rawLayers = sp?.get("layers");
  const layers = rawLayers == null ? DEFAULT_GLOBE_LAYERS
    : GLOBE_LAYERS.filter((l) => rawLayers.split(",").map((x) => x.trim().toLowerCase()).includes(l));
  const metric = get("metric").toLowerCase() as GlobeMetric;
  const type = get("type").toUpperCase();
  const win = get("window");
  const min = get("minLevel").toUpperCase() as HypeLevel;
  return {
    layers: [...layers],
    metric: (GLOBE_METRICS as readonly string[]).includes(metric) ? metric : "avg",
    type: type === "LOOK" || type === "LOOKS" || type === "SCHEME" ? "SCHEME" : "PIECE",
    window: win === "1" || win === "30" ? win : "7",
    category: get("category").toLowerCase(),
    minLevel: LEVELS.includes(min) ? min : "",
  };
}

/** Parâmetros da API (o look vai como LOOK; vazios ficam de fora). Camadas e métrica são só de desenho. */
export function globeQuery(f: GlobeFilters) {
  return qs({ type: f.type === "SCHEME" ? "LOOK" : "PIECE", window: f.window, category: f.category, minLevel: f.minLevel });
}

/** Grava os filtros na URL atual (valores padrão saem da URL) — devolve a query nova, sem o "?". */
export function globeSearch(f: GlobeFilters, current: string, country?: string) {
  const p = new URLSearchParams(current);
  p.set("tab", "map");
  const put = (k: string, v: string, def = "") => (v && v !== def ? p.set(k, v) : p.delete(k));
  const sameAsDefault = f.layers.length === DEFAULT_GLOBE_LAYERS.length && DEFAULT_GLOBE_LAYERS.every((l) => f.layers.includes(l));
  if (sameAsDefault) p.delete("layers"); else p.set("layers", GLOBE_LAYERS.filter((l) => f.layers.includes(l)).join(","));
  put("metric", f.metric, "avg");
  put("type", f.type === "SCHEME" ? "LOOK" : "");
  put("window", f.window, "7");
  put("category", f.category);
  put("minLevel", f.minLevel);
  if (country !== undefined) put("country", country);
  return p.toString();
}

/* ---------------------------------------------------------------- números e faixas */
/** Régua padrão das faixas (HypeScoreConfig: 20,40,60,75,90) — só para quando a API não manda a faixa pronta. */
export const DEFAULT_LEVEL_THRESHOLDS = [20, 40, 60, 75, 90];
export function levelFromScore(score: number, thresholds = DEFAULT_LEVEL_THRESHOLDS): HypeLevel {
  const s = Math.round(score);   // a faixa segue o número exibido
  for (let i = thresholds.length - 1; i >= 0; i--) if (s >= thresholds[i]) return LEVELS[i + 1];
  return LEVELS[0];
}

/** O Hype que o globo mostra no país: o máximo na métrica "Hype máximo"; nas demais, o médio. */
export function hypeShown(c: HypeGlobeCountry, metric: GlobeMetric): { value: number | null; level: HypeLevel | null; kind: "avg" | "max" } {
  const kind = metric === "max" ? "max" : "avg";
  const value = (kind === "max" ? c.maxHype : c.avgHype) ?? null;
  const level = (kind === "max" ? c.maxLevel : c.avgLevel) ?? (value != null ? levelFromScore(value) : null);
  return { value, level, kind };
}

/** O número da métrica escolhida (altura das colunas e ordem dos cards). */
export function metricValue(c: HypeGlobeCountry, metric: GlobeMetric): number | null {
  switch (metric) {
    case "max": return c.maxHype ?? null;
    case "volume": return c.count;
    case "growth": return c.trend ?? null;
    default: return c.avgHype ?? null;
  }
}

/* ---------------------------------------------------------------- colunas 3D */
/** Altura máxima da coluna (fração do raio do globo). */
export const COLUMN_MAX = 0.3;

/**
 * Altura relativa da coluna (0…COLUMN_MAX do raio), proporcional ao valor — escala sequencial com zero na superfície.
 * Hype e crescimento usam a escala absoluta 0–100 (comparável entre recortes); volume é relativo ao maior país do recorte.
 */
export function columnHeight(value: number | null | undefined, metric: GlobeMetric, maxVolume = 1) {
  if (value == null || !Number.isFinite(value)) return 0;
  const n = metric === "volume" ? value / Math.max(1, maxVolume) : value / 100;
  return COLUMN_MAX * Math.max(0, Math.min(1, n));
}

/**
 * Topo de uma coluna radial de altura h (fração do raio) em pé no ponto projetado p. A projeção ortográfica é linear: o
 * ponto a (1+h)·R do centro da esfera, na mesma direção, cai em c + (1+h)·(p − c).
 */
export function columnTop(center: readonly [number, number], p: readonly [number, number], h: number): [number, number] {
  return [center[0] + (1 + h) * (p[0] - center[0]), center[1] + (1 + h) * (p[1] - center[1])];
}

/* ---------------------------------------------------------------- bonecos */
export const MAX_FIGURES = 3;
/** Um boneco por pessoa criadora, até 3; o resto vira "+N". */
export function figuresFor(creators: number) {
  const n = Math.max(0, Math.floor(creators || 0));
  return { shown: Math.min(MAX_FIGURES, n), extra: Math.max(0, n - MAX_FIGURES) };
}

/* ---------------------------------------------------------------- cards */
export const CARD_K = 3;

/**
 * Países com card: os K mais altos na métrica entre os visíveis (frente do globo) com dados suficientes e um destaque,
 * mais o selecionado (se também estiver visível e suficiente). Abaixo do mínimo nunca há card.
 */
export function pickCards(visible: { country: string; sufficient: boolean; hasTop: boolean; value: number | null }[], selected?: string, k = CARD_K): string[] {
  const ok = visible.filter((v) => v.sufficient && v.hasTop);
  const top = ok.slice().sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.country.localeCompare(b.country)).slice(0, k).map((v) => v.country);
  if (selected && !top.includes(selected) && ok.some((v) => v.country === selected)) top.push(selected);
  return top;
}

export interface CardSlot { country: string; side: "left" | "right"; x: number; y: number; anchor: [number, number] }

/**
 * Empilhamento simples por lado: o card vai para o lado do país (esquerda/direita do centro), na altura do país; quando
 * dois se encostam, o de baixo desce; se passar do fim, a pilha sobe. Nunca se sobrepõem.
 */
export function stackCards(anchors: { country: string; at: [number, number] }[], o: { centerX: number; leftX: number; rightX: number; cardH: number; gap: number; top: number; bottom: number }): CardSlot[] {
  const out: CardSlot[] = [];
  for (const side of ["left", "right"] as const) {
    const list = anchors.filter((a) => (a.at[0] < o.centerX) === (side === "left")).sort((a, b) => a.at[1] - b.at[1] || a.country.localeCompare(b.country));
    const ys = list.map((a) => a.at[1] - o.cardH / 2);
    for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], o.top, i ? ys[i - 1] + o.cardH + o.gap : -Infinity);
    for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i], o.bottom - o.cardH, i < ys.length - 1 ? ys[i + 1] - o.cardH - o.gap : Infinity);
    list.forEach((a, i) => out.push({ country: a.country, side, x: side === "left" ? o.leftX : o.rightX, y: ys[i], anchor: a.at }));
  }
  return out;
}

/** Nome curto para o card (o nome inteiro vai no title e no rótulo acessível). */
export const shortName = (name: string | null | undefined, max = 15) => {
  const s = (name ?? "").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};

/** Distribuição das faixas em ordem (sinal baixo → viral), só com o que tem item. */
export function levelRows(levels: Partial<Record<HypeLevel, number>> | null | undefined) {
  return LEVELS.map((l) => ({ level: l, count: levels?.[l] ?? 0 })).filter((r) => r.count > 0);
}
