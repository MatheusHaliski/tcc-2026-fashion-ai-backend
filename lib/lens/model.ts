/**
 * FashionAI Lens (RF54) — regras puras de apresentação: hotspots, recorte, confiança em texto, expiração e foco.
 * Nada aqui inventa número: sem dado, a tela diz "sem correspondência" / "dados insuficientes", nunca 0%.
 */
import type { LensBox, LensConfidenceBand, LensDetectionView } from "./types";

export const LENS_TABS = ["reading", "closet", "recreate", "style", "discover"] as const;
export type LensTab = (typeof LENS_TABS)[number];
export const parseLensTab = (v: string | null | undefined): LensTab => ((LENS_TABS as readonly string[]).includes(v ?? "") ? (v as LensTab) : "reading");

/** Ordem de leitura (de cima para baixo): ordinal do backend, depois o topo da caixa. */
export const orderDetections = (list: LensDetectionView[]) => [...list].sort((a, b) => a.ordinal - b.ordinal || a.box.y - b.box.y);

/** Faixa de confiança: a do backend; sem ela, derivada (alta ≥ 0,75, média ≥ 0,5, baixa abaixo). */
export const bandOf = (d: Pick<LensDetectionView, "confidence" | "confidenceBand">): LensConfidenceBand =>
  d.confidenceBand ?? (d.confidence >= 0.75 ? "HIGH" : d.confidence >= 0.5 ? "MEDIUM" : "LOW");

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : 0));

/** Caixa saneada (0–100, largura e altura mínimas): o backend garante, mas a UI não quebra com um valor torto. */
export function safeBox(b: LensBox): LensBox {
  const x = clamp(b.x), y = clamp(b.y);
  return { x, y, w: Math.max(1, clamp(b.w, 0, 100 - x)), h: Math.max(1, clamp(b.h, 0, 100 - y)) };
}

/** Ponto do hotspot: o centro da caixa da roupa (nunca rosto ou corpo — só a caixa da peça). */
export function hotspotPoint(b: LensBox): { left: number; top: number } {
  const s = safeBox(b);
  return { left: s.x + s.w / 2, top: s.y + s.h / 2 };
}

/**
 * Recorte da peça por CSS (sem novo upload nem canvas): `background-size`/`background-position` mostram só a caixa
 * (com uma folga de 6%). `ratio` é a proporção da caixa em pixels, para o recorte não distorcer.
 */
export function cropOf(b: LensBox, width: number, height: number, pad = 0.06): { size: string; position: string; ratio: number } {
  const s = safeBox(b);
  const px = s.w * pad, py = s.h * pad;
  const x = Math.max(0, s.x - px), y = Math.max(0, s.y - py);
  const w = Math.min(100 - x, s.w + 2 * px), h = Math.min(100 - y, s.h + 2 * py);
  const pos = (start: number, size: number) => (size >= 100 ? 0 : (start / (100 - size)) * 100);
  const ratio = width > 0 && height > 0 ? (w * width) / (h * height) : w / h;
  return { size: `${(10000 / w).toFixed(2)}% ${(10000 / h).toFixed(2)}%`, position: `${pos(x, w).toFixed(2)}% ${pos(y, h).toFixed(2)}%`, ratio };
}

/** Dias inteiros até expirar (0 = expira hoje); null quando não expira (salvo como inspiração). */
export function expiryDays(expiresAt: string | null | undefined, savedAt: string | null | undefined, now = Date.now()): number | null {
  if (savedAt || !expiresAt) return null;
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.ceil((t - now) / 86_400_000));
}

/** Semelhança para exibir: inteiro de 1 a 100; sem valor útil (0, nulo) não há selo — nunca "0%". */
export const shownSimilarity = (n: number | null | undefined) => (n == null || !Number.isFinite(n) || n <= 0 ? null : Math.min(100, Math.max(1, Math.round(n))));

/** Padrões lidos pelo PatternAnalyzer (os valores do backend chegam em caixa alta). */
export const LENS_PATTERNS = ["SOLID", "STRIPED", "CHECKED", "PRINTED"] as const;

/** Href da criação de look com as peças escolhidas no Recriar. */
export const createLookHref = (ids: string[]) => `/schemes/new?pieces=${ids.map(encodeURIComponent).join(",")}`;
