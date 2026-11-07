/**
 * Palco do confronto dos modos FLAIR clássicos (duelo, treino, equipes e os 15 modos de look): o resultado do servidor
 * vira uma sequência de momentos (um por rodada) com a carta que representa cada lado, e daqui saem as regras de efeito
 * que a cena fotográfica (components/flair/match) desenha. Tudo é puro: nada de texto de interface, nada de rede.
 *
 * Regra dos efeitos (por momento e por lado):
 *   - Aura Hype aparece SEMPRE: a faixa real (0..5) vem do Hype da carta (card.hype.score) ou do look (stats.HYPE), com
 *     limiares 20/40/60/75/90; sem Hype = 0 (sinal baixo).
 *   - Vencedor da rodada recebe a inserção completa e a faixa de partida sobe 1 (Hype de partida, teto Viral).
 *   - Perdedor fica apagado (sem reacender a foto) e a faixa desce 1 só se perdeu por mais de 15% do placar do vencedor.
 *   - Empate: os dois lados entram com intensidade média e a faixa não muda.
 *   - METAMORFOSE quando o lado tem, na rodada, nota de sinergia/combo/bônus de tema (notes) ou o look/deck dele tem
 *     sinergia ativa, e SÓ com a permissão AURA_METAMORPHOSE.
 *   - IMPERSONATION só na rodada decisiva, só no lado A (a peça da própria pessoa; nunca a do oponente), só se o lado A
 *     não perdeu essa rodada e SÓ com a permissão AURA_IMPERSONATION. Tem prioridade sobre a Metamorfose.
 *   - Sem permissão (ou carregando, ou erro) o efeito é COMUM: fail closed.
 *   - Final: o lado vencedor da partida recebe a luz dourada (perfect) e o perdedor fica dessaturado.
 */
import type { FlairCard, FlairDeck, FlairRound } from "@/components/flair/flair-card";
import type { EffectKind } from "@/lib/flair/games";

export type MatchTier = "BRONZE" | "PRATA" | "OURO" | "ESPECIAL";
export type MatchSide = "A" | "B";
export type MatchWinner = MatchSide | "DRAW";
/** `category`: categoria/posição da peça quando o servidor a informa (upper_piece, lower_piece…); null nos lados sem peça. */
export interface MatchCard { id: string; name: string; imageUrl: string | null; tier: MatchTier; band: number; category?: string | null }
export interface MatchMoment {
  index: number; label: string; winner: MatchWinner; a: MatchCard | null; b: MatchCard | null; notes: string[]; decisive: boolean;
  scoreA: number; scoreB: number;
  /** o lado tem sinergia/combo/bônus nesta rodada (já atribuído pelo adaptador a partir das notas e do look/deck) */
  meta: Record<MatchSide, boolean>;
  /** número do par (duelo de equipes) */
  pair?: number;
}
export interface MatchTheme { label: string; emoji?: string | null }
export interface MatchData { mode: string; winner: MatchWinner; moments: MatchMoment[]; theme?: MatchTheme | null }
export interface AuraPermissions { metamorphose: boolean; impersonation: boolean }
export const NO_AURA: AuraPermissions = { metamorphose: false, impersonation: false };

export type MatchRole = "winner" | "loser" | "draw";
export interface SideEffect { role: MatchRole; kind: EffectKind; band: number; matchBand: number; sintonia: number }

const TIER_BY_RARITY: Record<string, MatchTier> = { STANDARD: "BRONZE", PREMIUM: "PRATA", LIMITED: "OURO", RARE: "ESPECIAL" };
const BAND_LIMITS = [20, 40, 60, 75, 90];

/** Nível do card pela raridade do motor (STANDARD→BRONZE, PREMIUM→PRATA, LIMITED→OURO, RARE→ESPECIAL). */
export function tierOf(rarity: string | null | undefined): MatchTier {
  return TIER_BY_RARITY[(rarity ?? "").toUpperCase()] ?? "BRONZE";
}

/** Faixa de Hype 0..5 pelo score (limiares 20/40/60/75/90); sem Hype = 0. */
export function bandOf(score: number | null | undefined): number {
  if (score == null || !Number.isFinite(score)) return 0;
  return BAND_LIMITS.filter((limit) => score >= limit).length;
}

/** A nota pertence ao lado quando começa por "A:"/"B:" ou termina com "(A)"/"(B)"; sem marca, vale para os dois. */
export function noteSide(note: string): MatchSide | null {
  const m = /^\s*([AB])\s*:/.exec(note) ?? /\(([AB])\)\s*$/.exec(note);
  return m ? (m[1] as MatchSide) : null;
}

/** Notas da rodada que contam para o lado (as sem marca contam para os dois, salvo quando `unmarked` diz outro lado). */
export function sideHasNotes(notes: string[], side: MatchSide, unmarked: MatchSide | "BOTH" | "NONE" = "BOTH"): boolean {
  return notes.some((n) => {
    const s = noteSide(n);
    if (s) return s === side;
    return unmarked === "BOTH" || unmarked === side;
  });
}

/** Rodada decisiva: a primeira em que o vencedor da partida passou a ter mais rodadas do que o rival terá no fim. */
export function decisiveIndex(winners: MatchWinner[], overall: MatchWinner): number {
  if (!winners.length) return -1;
  if (overall === "DRAW") return winners.length - 1;
  const rival = overall === "A" ? "B" : "A";
  const rivalTotal = winners.filter((w) => w === rival).length;
  let mine = 0;
  for (let i = 0; i < winners.length; i++) {
    if (winners[i] === overall) mine++;
    if (mine > rivalTotal) return i;
  }
  return winners.length - 1;
}

/** Marca a rodada decisiva nos momentos já montados. */
export function withDecisive(moments: MatchMoment[], overall: MatchWinner): MatchMoment[] {
  const at = decisiveIndex(moments.map((m) => m.winner), overall);
  return moments.map((m, i) => ({ ...m, decisive: i === at }));
}

/** Efeito de um lado num momento (a regra completa está no topo do arquivo). */
export function sideEffect(m: MatchMoment, side: MatchSide, perms: AuraPermissions): SideEffect | null {
  const card = side === "A" ? m.a : m.b;
  if (!card) return null;
  const role: MatchRole = m.winner === "DRAW" ? "draw" : m.winner === side ? "winner" : "loser";
  const mine = side === "A" ? m.scoreA : m.scoreB, other = side === "A" ? m.scoreB : m.scoreA;
  const heavyLoss = role === "loser" && other > 0 && (other - mine) / other > 0.15;
  const matchBand = role === "winner" ? Math.min(5, card.band + 1) : heavyLoss ? Math.max(0, card.band - 1) : card.band;
  let kind: EffectKind = "COMUM";
  if (side === "A" && m.decisive && role !== "loser" && perms.impersonation) kind = "IMPERSONATION";
  else if (m.meta[side] && perms.metamorphose) kind = "METAMORFOSE";
  return { role, kind, band: card.band, matchBand, sintonia: role === "winner" ? 3 : role === "draw" ? 1 : 0 };
}

/** Resultado da pessoa (WIN/LOSS/DRAW) no lado vencedor da partida. */
export function outcomeSide(o: string | null | undefined): MatchWinner {
  return o === "WIN" ? "A" : o === "LOSS" ? "B" : "DRAW";
}

// ================================================================== duelo de decks (Duelo 1×1 e Treino com a Casa)
function deckCard(deck: FlairDeck, stat: string): MatchCard | null {
  const best = deck.cards.reduce<FlairCard | null>((top, c) => (!top || (c.stats?.[stat] ?? 0) > (top.stats?.[stat] ?? 0) ? c : top), null);
  if (!best) return null;
  return { id: best.id, name: best.name, imageUrl: best.imageUrl ?? null, tier: tierOf(best.rarity), band: bandOf(best.hype?.score), category: best.category || null };
}

export interface DuelLike { mode: string; me: FlairDeck; opponent: { label: string; deck: FlairDeck }; rounds: FlairRound[]; outcome: string }

/** Duelo: em cada rodada (atributo), a carta de cada deck com o maior valor daquele atributo. */
export function fromDuel(result: DuelLike): MatchData {
  const winner = outcomeSide(result.outcome);
  const synergy = { A: result.me.combos.length > 0, B: result.opponent.deck.combos.length > 0 };
  const moments = result.rounds.map((r, index): MatchMoment => ({
    index, label: r.stat, winner: r.winner, a: deckCard(result.me, r.stat), b: deckCard(result.opponent.deck, r.stat), notes: r.notes, decisive: false,
    scoreA: r.a, scoreB: r.b, meta: { A: synergy.A || sideHasNotes(r.notes, "A"), B: synergy.B || sideHasNotes(r.notes, "B") },
  }));
  return { mode: result.mode, winner, moments: withDecisive(moments, winner) };
}

// ================================================================== duelo de equipes (3×3)
interface TeamSideLike { user: { id: string; username: string }; deck: string; power: number }
export interface TeamBattleLike { duels: { slot: number; a: TeamSideLike | null; b: TeamSideLike | null; winner: string; rounds: FlairRound[] }[]; winner: string }

function teamCard(s: TeamSideLike | null, slot: number, side: MatchSide): MatchCard | null {
  return s ? { id: `${side}${slot}:${s.user.id}`, name: `@${s.user.username} · ${s.deck}`, imageUrl: null, tier: "BRONZE", band: 0, category: null } : null;
}

/** Equipes: um palco com as duplas; cada par é um momento (vencedor do par, rodadas ganhas como placar). */
export function fromTeamBattle(result: TeamBattleLike): MatchData {
  const winner = (["A", "B"].includes(result.winner) ? result.winner : "DRAW") as MatchWinner;
  const moments = result.duels.map((d, index): MatchMoment => {
    const notes = d.rounds.flatMap((r) => r.notes);
    return {
      index, label: d.a?.deck ?? d.b?.deck ?? "", pair: d.slot, winner: (["A", "B"].includes(d.winner) ? d.winner : "DRAW") as MatchWinner,
      a: teamCard(d.a, d.slot, "A"), b: teamCard(d.b, d.slot, "B"), notes, decisive: false,
      scoreA: d.rounds.filter((r) => r.winner === "A").length, scoreB: d.rounds.filter((r) => r.winner === "B").length,
      meta: { A: sideHasNotes(notes, "A"), B: sideHasNotes(notes, "B") },
    };
  });
  return { mode: "TEAM", winner, moments: withDecisive(moments, winner) };
}

export { fromModeResult } from "@/lib/flair/match-modes";
