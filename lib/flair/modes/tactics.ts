/**
 * Leitura tática das Partidas FLAIR, calculada no navegador com os mesmos dados que o servidor usa (atributos do look,
 * pesos do tema, atributos do chefe): quanto cada look combina com o tema, qual a melhor escolha e onde o look ganha ou
 * perde do chefe. Só orienta a decisão; a nota oficial continua vindo do servidor. Também diz qual efeito cada carta de
 * roupa acende no cenário (pela categoria) e qual foi a carta MVP do confronto. Puro: sem texto de interface.
 */
import type { MatchData, MatchMoment } from "@/lib/flair/match-stage";

export interface TacticLook { schemeId: string | null; title: string; rating: number; stats: Record<string, number>; synergies: { code: string }[] }
export interface TacticTheme { weights: Record<string, number> }

/** Encaixe 0..100: média dos atributos ponderada pelos pesos do tema (atributo sem peso vale 1) + 2 por sinergia ativa. */
export function themeFit(look: TacticLook, theme?: TacticTheme | null): number {
  const entries = Object.entries(look.stats);
  if (!entries.length) return Math.round(look.rating);
  let sum = 0, weight = 0;
  for (const [stat, value] of entries) {
    const w = Number(theme?.weights?.[stat] ?? 1) || 1;
    sum += value * w; weight += w;
  }
  return Math.max(0, Math.min(100, Math.round(sum / weight + 2 * look.synergies.length)));
}

/** Os atributos que o tema mais valoriza (peso > 1), do mais pesado ao menos. */
export function keyStats(theme?: TacticTheme | null, n = 3): string[] {
  return Object.entries(theme?.weights ?? {}).filter(([, w]) => Number(w) > 1).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, n).map(([k]) => k);
}

export interface RankedLook<T extends TacticLook> { look: T; fit: number }
export function rankLooks<T extends TacticLook>(looks: T[], theme?: TacticTheme | null): RankedLook<T>[] {
  return looks.map((look) => ({ look, fit: themeFit(look, theme) })).sort((a, b) => b.fit - a.fit || b.look.rating - a.look.rating);
}

/** Os `n` melhores looks para o tema (ids), para o botão "Sugestão do estrategista". */
export function bestPicks<T extends TacticLook>(looks: T[], theme: TacticTheme | null | undefined, n: number): string[] {
  return rankLooks(looks, theme).slice(0, n).map((r) => r.look.schemeId ?? "").filter(Boolean);
}

/** Atributo a atributo contra o chefe: quantos o look vence e a maior diferença contra. */
export function bossMatchup(look: TacticLook, boss: Record<string, number>): { wins: number; total: number; weakest: string | null } {
  let wins = 0, total = 0, weakest: string | null = null, worst = 0;
  for (const [stat, need] of Object.entries(boss)) {
    total++;
    const gap = (look.stats[stat] ?? 0) - need;
    if (gap >= 0) wins++;
    else if (gap < worst) { worst = gap; weakest = stat; }
  }
  return { wins, total, weakest };
}

/** Efeito que a carta acende no cenário, pela categoria da peça (o palco desenha o mesmo efeito na foto). */
export type CardSceneEffect = "spotlight" | "runway" | "floor" | "sparkle" | "aura" | "wind";
const EFFECT_BY_CATEGORY: Record<string, CardSceneEffect> = {
  upper_piece: "spotlight", lower_piece: "runway", shoes_piece: "floor", accessory_piece: "sparkle", full_body_piece: "aura", outerwear_piece: "wind",
};
export function cardSceneEffect(category: string | null | undefined): CardSceneEffect {
  return EFFECT_BY_CATEGORY[category ?? ""] ?? "spotlight";
}

/** MVP: a rodada que o lado A venceu com a maior folga (senão a decisiva); null quando A não venceu nenhuma. */
export function mvpMoment(data: MatchData | null): MatchMoment | null {
  const won = (data?.moments ?? []).filter((m) => m.winner === "A" && m.a);
  if (!won.length) return null;
  return won.reduce((best, m) => (m.scoreA - m.scoreB > best.scoreA - best.scoreB ? m : best));
}
