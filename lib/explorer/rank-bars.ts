/**
 * Regras puras das barras dos Insights globais do Explorador (RF26, P2-04), sem React nem i18n: quais linhas de ranking
 * entram, a largura da barra de Hype (escala absoluta 0–100), a barra divergente do Crescimento (TREND, 50 = estável)
 * e a barra relativa do Volume. Extraído de `app/(site)/(app)/explorer/page.tsx` com o mesmo cálculo e as mesmas strings
 * de estilo (o DOM não muda).
 */

/** Uma linha de ranking com rótulo e valor (no Hype v2, também a faixa e quantos itens públicos sustentam a média). */
export interface RankValue { value: number | string | null | undefined }

export type GrowthDirection = "up" | "down" | "flat";

/** Só entram no Hype/Crescimento as linhas com valor finito (nulo, ausente ou não numérico saem — nunca viram 0). */
export function finiteRankRows<T extends RankValue>(rows?: T[] | null): T[] {
  return (rows ?? []).filter((r) => r.value != null && Number.isFinite(Number(r.value)));
}

/** Largura da barra de Hype na escala absoluta, limitada a 0–100 %. */
export function hypeBarWidth(value: number): string {
  return `${Math.max(0, Math.min(100, value))}%`;
}

/**
 * Crescimento: valor limitado a 0–100, número arredondado, direção pelo número arredondado (50 = estável) e a barra que
 * sai do meio (left = min(50, v), width = |v − 50|).
 */
export function growthBar(raw: number | string | null | undefined): { shown: number; dir: GrowthDirection; left: string; width: string } {
  const v = Math.max(0, Math.min(100, Number(raw)));
  const shown = Math.round(v);
  const dir: GrowthDirection = shown > 50 ? "up" : shown < 50 ? "down" : "flat";
  return { shown, dir, left: `${Math.min(50, v)}%`, width: `${Math.abs(v - 50)}%` };
}

/** Valor de volume: não numérico conta como 0. */
export function volumeValue(raw: number | string | null | undefined): number {
  return Number(raw) || 0;
}

/** Larguras das barras de Volume relativas ao maior valor do ranking (mínimo 1, para nunca dividir por 0). */
export function volumeBarWidths(rows: RankValue[]): string[] {
  const max = Math.max(1, ...rows.map((r) => volumeValue(r.value)));
  return rows.map((r) => `${(100 * volumeValue(r.value)) / max}%`);
}
