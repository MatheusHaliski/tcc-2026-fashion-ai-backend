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

/* ---------------------------------------------------------------- colunas */
/**
 * Altura máxima da coluna (fração do raio do globo, medida na TELA). Lote A3: a coluna radial pura encurtava perto do
 * centro do disco (na projeção ortográfica ela aponta para quem olha) e o mesmo valor ficava com alturas diferentes
 * conforme a posição; agora a altura desenhada é proporcional só à métrica, em qualquer ponto do globo.
 */
export const COLUMN_MAX = 0.22;
/** Altura mínima visível de um país com dados suficientes (fração do raio): valor baixo não faz a coluna sumir. */
export const COLUMN_MIN = 0.04;
/** Inclinação para fora: no centro do disco a coluna fica em pé; na borda tomba ~27° do eixo vertical (efeito de globo). */
export const COLUMN_LEAN = 0.5;
/** Espessura da coluna e raio da tampa (× tamanho do globo / 420). */
export const COLUMN_W = 7;
export const COLUMN_CAP = 3.6;

/**
 * Altura relativa da coluna (0…COLUMN_MAX do raio), proporcional ao valor — escala sequencial com zero na superfície.
 * Hype e crescimento usam a escala absoluta 0–100 (comparável entre recortes); volume é relativo ao maior país do recorte.
 * País com dados suficientes nunca fica abaixo de COLUMN_MIN; sem valor ("sem dados") não há coluna (nunca vira 0 desenhado).
 */
export function columnHeight(value: number | null | undefined, metric: GlobeMetric, maxVolume = 1, sufficient = false) {
  if (value == null || !Number.isFinite(value)) return 0;
  const n = metric === "volume" ? value / Math.max(1, maxVolume) : value / 100;
  const h = COLUMN_MAX * Math.max(0, Math.min(1, n));
  return sufficient ? Math.max(COLUMN_MIN, h) : h;
}

/**
 * Direção (unitária, na tela) da coluna em pé no ponto projetado p: para cima, inclinada para fora na proporção da
 * distância horizontal ao centro do disco. Contínua enquanto o globo gira (sem viradas bruscas ao cruzar o centro).
 */
export function columnDirection(center: readonly [number, number], p: readonly [number, number], radius: number): [number, number] {
  const ux = radius > 0 ? Math.max(-1, Math.min(1, (p[0] - center[0]) / radius)) : 0;
  const dx = COLUMN_LEAN * ux; const n = Math.hypot(dx, 1);
  return [dx / n, -1 / n];
}

/** Topo de uma coluna de altura h (fração do raio) em pé no ponto projetado p: p + h·R·direção. */
export function columnTop(center: readonly [number, number], p: readonly [number, number], h: number, radius: number): [number, number] {
  const [dx, dy] = columnDirection(center, p, radius);
  return [p[0] + dx * h * radius, p[1] + dy * h * radius];
}

/* ---------------------------------------------------------------- bonecos */
export const MAX_FIGURES = 3;
/** Um boneco por pessoa criadora, até 3; o resto vira "+N". */
export function figuresFor(creators: number) {
  const n = Math.max(0, Math.floor(creators || 0));
  return { shown: Math.min(MAX_FIGURES, n), extra: Math.max(0, n - MAX_FIGURES) };
}
/** Desenho do boneco: 7 × 14,2 unidades com os pés na origem, um a cada 7,5; ampliado FIGURE_SCALE × (tamanho / 420). */
export const FIGURE_W = 7;
export const FIGURE_H = 14.2;
export const FIGURE_STEP = 7.5;
/** Lote A3: o dobro do desenho original (no globo de 420 px, ~28 px de altura em vez de ~14). */
export const FIGURE_SCALE = 2;
/** Largura reservada para o "+N" depois do último boneco (× tamanho / 420). */
export const FIGURE_MORE_W = 18;

/* ---------------------------------------------------------------- marcas de um país (sem sobreposição) */
export interface Box { x: number; y: number; w: number; h: number }
export const PILL_H = 16;
/** Largura da pílula do número (× k): folga + ~7 por algarismo. */
export const pillWidth = (text: string, k = 1) => (12 + 7 * text.length) * k;
/** Duas caixas se sobrepõem? (encostar não conta) */
export const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export interface CountryMarks {
  /** topo da coluna (= o ponto do país quando não há coluna) */
  top: [number, number];
  /** pílula do número (caixa) */
  pill: Box | null;
  /** bonecos: pés do primeiro (x, y), lado em que a fila cresce, escala e a caixa ocupada */
  figures: { x: number; y: number; dir: 1 | -1; scale: number; box: Box } | null;
  /** número da lista estreita (fora da pílula, da coluna e dos bonecos) */
  marker: [number, number];
}

/**
 * Onde cada marca de um país vai, sem uma cobrir a outra: a coluna sobe (inclinada para fora), os bonecos ficam em pé do
 * OUTRO lado (para dentro do disco, longe das calhas dos cards), a pílula do número fica acima do topo da coluna e, quando
 * há bonecos, também acima da cabeça deles; o marcador da lista estreita vai ao lado da pílula, no lado da coluna.
 */
export function countryMarks(o: { center: readonly [number, number]; p: readonly [number, number]; radius: number; h: number; k: number; pillW?: number | null; figures?: number; extra?: boolean }): CountryMarks {
  const { p, k } = o;
  const top = columnTop(o.center, p, o.h, o.radius);
  const dir: 1 | -1 = p[0] > o.center[0] ? -1 : 1;   // a coluna tomba para fora; os bonecos ficam do lado de dentro
  let figures: CountryMarks["figures"] = null;
  if (o.figures && o.figures > 0) {
    const s = FIGURE_SCALE * k; const half = (FIGURE_W * s) / 2;
    const x = p[0] + dir * (Math.max(COLUMN_W / 2, COLUMN_CAP) * k + 2 * k + half);
    const y = p[1] + 1.5 * k;
    const span = (o.figures - 1) * FIGURE_STEP * s + FIGURE_W * s + (o.extra ? FIGURE_MORE_W * k : 0);
    const near = x - dir * half;
    figures = { x, y, dir, scale: s, box: { x: dir > 0 ? near : near - span, y: y - FIGURE_H * s, w: span, h: FIGURE_H * s } };
  }
  const gap = 3 * k; const ph = PILL_H * k;
  let pill: Box | null = null;
  if (o.pillW) {
    let cy = top[1] - (o.h > 0 ? COLUMN_CAP * k : 0) - gap - ph / 2;
    if (figures) cy = Math.min(cy, figures.box.y - gap - ph / 2);
    pill = { x: top[0] - o.pillW / 2, y: cy - ph / 2, w: o.pillW, h: ph };
  }
  const marker: [number, number] = pill ? [top[0] - dir * (pill.w / 2 + 9 * k), pill.y + ph / 2] : [top[0] - dir * 10 * k, top[1] - 6 * k];
  return { top, pill, figures, marker };
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
