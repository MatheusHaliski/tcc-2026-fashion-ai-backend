/**
 * Adaptador dos resultados dos modos de look do FLAIR (BATTLE, SQUAD, LEAGUE, TOUR, CONQUEST, MONOPOLY, DECK, WARDROBE,
 * RUNWAY, DRAFT, TAG_TEAM, BOSS, COMBO, CHESS, ULTIMATE) para os momentos do palco (lib/flair/match-stage.ts).
 * Cada rodada do servidor (`rounds`: label, a, b, scoreA, scoreB, winner, notes) vira um momento; a carta de cada lado é
 * a do look daquela rodada (o look cujo título é o da rodada, senão o look na mesma posição), rodando as cartas do look
 * em ordem, ou a capa do look quando ele não tem cartas. Modos sem look no resultado (liga, territórios, guarda-roupa,
 * xadrez) entram com o nome do lado e sem foto. TOUR e RUNWAY não têm `rounds`: o momento sai da casa do tabuleiro e
 * das fases do desfile.
 */
import type { ModeLook, ModeResult } from "@/components/flair/modes-shared";
import { bandOf, outcomeSide, sideHasNotes, tierOf, withDecisive, type MatchCard, type MatchData, type MatchMoment, type MatchSide, type MatchWinner } from "@/lib/flair/match-stage";

/** Código do palco (lib/flair/match-stages.json) para o modo gravado pelo servidor. */
const STAGE_MODE: Record<string, string> = { DECK_RESULT: "DECK", DRAFT_RESULT: "DRAFT" };
export function stageMode(mode: string): string {
  return STAGE_MODE[mode] ?? mode;
}

/**
 * A quem valem as notas sem marca de lado: no Boss e no Tour só o look da pessoa é pontuado; no Combo a nota sem marca
 * é a dica "nenhum combo ativado"; no Tag Team são a explicação da nota da dupla (e a harmonia já vem marcada por lado).
 */
const UNMARKED: Record<string, MatchSide | "BOTH" | "NONE"> = { BOSS: "A", TOUR: "A", COMBO: "NONE", TAG_TEAM: "NONE" };

type Loose = Record<string, unknown>;
const obj = (v: unknown): Loose | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Loose) : null);
function isLook(v: unknown): v is ModeLook {
  const o = obj(v);
  return !!o && typeof o.title === "string" && Array.isArray(o.cards) && !!obj(o.stats);
}
const looksIn = (v: unknown): ModeLook[] => (Array.isArray(v) ? v.filter(isLook) : isLook(v) ? [v] : []);
const image = (u: string | null | undefined): string | null => (u && u !== "null" ? u : null);

/** Looks de cada lado, onde quer que o modo os tenha posto no resultado. */
function sideLooks(r: ModeResult, side: MatchSide): ModeLook[] {
  const team = obj(side === "A" ? r.teamA : r.teamB);
  if (r.mode === "RUNWAY") return side === "A" ? looksIn(r.field).slice(0, 1) : looksIn(r.field).slice(1);
  if (side === "B") return [...looksIn(obj(r.opponent)?.look), ...looksIn(obj(r.opponent)?.looks), ...looksIn(team?.looks)];
  const roster = Object.values(obj(r.roster) ?? {}).map((x) => obj(x)?.look);
  return [...looksIn(r.me), ...looksIn(r.look), ...looksIn(team?.looks), ...looksIn(roster)];
}

function pickLook(looks: ModeLook[], title: string, index: number): ModeLook | null {
  if (!looks.length || title === "—") return null;
  return looks.find((l) => l.title === title) ?? looks[index % looks.length];
}

/** A carta que representa o look na rodada (rodando as cartas em ordem) ou a capa do look. */
export function lookCard(look: ModeLook, index: number): MatchCard {
  const band = bandOf(look.stats?.HYPE);
  const c = look.cards.length ? look.cards[index % look.cards.length] : null;
  if (c) return { id: c.id, name: c.name, imageUrl: image(c.imageUrl), tier: tierOf(c.rarity), band, category: c.category || null };
  return { id: look.schemeId ?? `look:${look.title}`, name: look.title, imageUrl: image(look.coverUrl), tier: "BRONZE", band, category: null };
}

function namedCard(name: string | null | undefined, side: MatchSide, index: number): MatchCard | null {
  const n = (name ?? "").trim();
  return n && n !== "—" ? { id: `${side}${index}:${n}`, name: n, imageUrl: null, tier: "BRONZE", band: 0, category: null } : null;
}

interface Clash { label: string; a: string; b: string; scoreA: number; scoreB: number; winner: MatchWinner; notes: string[] }

/** Rodadas sintetizadas para os modos sem `rounds` (TOUR: a casa do tabuleiro; RUNWAY: as fases em que a pessoa desfilou). */
function syntheticClashes(r: ModeResult, mine: ModeLook | null): Clash[] {
  if (r.mode === "TOUR") {
    const square = obj(r.square), score = obj(r.score);
    const notes = Array.isArray(score?.notes) ? (score!.notes as string[]) : [];
    return [{ label: String(square?.title ?? ""), a: mine?.title ?? "", b: "", scoreA: r.scoreA, scoreB: r.scoreB, winner: r.pass ? "A" : "B", notes }];
  }
  if (r.mode !== "RUNWAY" || !Array.isArray(r.stages)) return [];
  const me = mine ? `${mine.title} (@${mine.owner})` : "";
  return (r.stages as Loose[]).flatMap((st): Clash[] => {
    const results = (Array.isArray(st.results) ? st.results : []) as Loose[];
    const label = String(st.stage ?? "");
    if (results.some((x) => "advanced" in x)) {
      const you = results.find((x) => x.you), rival = results.find((x) => !x.you);
      if (!you) return [];
      return [{ label, a: String(you.title), b: String(rival?.title ?? ""), scoreA: Number(you.score), scoreB: Number(rival?.score ?? 0), winner: you.advanced ? "A" : "B", notes: [] }];
    }
    const duel = results.find((x) => x.you && (x.a === me || x.b === me));
    if (!duel) return [];
    const flip = duel.b === me;
    const w = duel.winner === "A" ? (flip ? "B" : "A") : (flip ? "A" : "B");
    return [{ label, a: String(flip ? duel.b : duel.a), b: String(flip ? duel.a : duel.b), scoreA: Number(flip ? duel.scoreB : duel.scoreA), scoreB: Number(flip ? duel.scoreA : duel.scoreB), winner: w, notes: [] }];
  });
}

const titleOf = (s: string) => s.replace(/\s\(@[^)]*\)$/, "");

/** Resultado de qualquer modo genérico → momentos do palco. `myLook` é o look escolhido no painel, quando o resultado não traz o da pessoa. */
export function fromModeResult(r: ModeResult, myLook?: ModeLook | null): MatchData {
  const winner = outcomeSide(r.outcome);
  const lookA = sideLooks(r, "A"), lookB = sideLooks(r, "B");
  const looksA = lookA.length ? lookA : myLook ? [myLook] : [];
  const clashes: Clash[] = (r.rounds?.length ? r.rounds : syntheticClashes(r, looksA[0] ?? null)) as Clash[];
  const unmarked = UNMARKED[r.mode] ?? "BOTH";
  const moments = clashes.map((c, index): MatchMoment => {
    const la = pickLook(looksA, titleOf(c.a), index), lb = pickLook(lookB, titleOf(c.b), index);
    const notes = c.notes ?? [];
    return {
      index, label: c.label, winner: c.winner, notes, decisive: false, scoreA: Number(c.scoreA) || 0, scoreB: Number(c.scoreB) || 0,
      a: la ? lookCard(la, index) : namedCard(c.a, "A", index), b: lb ? lookCard(lb, index) : namedCard(c.b, "B", index),
      meta: { A: (la?.synergies?.length ?? 0) > 0 || sideHasNotes(notes, "A", unmarked), B: (lb?.synergies?.length ?? 0) > 0 || sideHasNotes(notes, "B", unmarked) },
    };
  });
  const theme = obj(r.theme);
  return { mode: r.mode, winner, moments: withDecisive(moments, winner), theme: theme?.label ? { label: String(theme.label), emoji: (theme.emoji as string) ?? null } : null };
}
