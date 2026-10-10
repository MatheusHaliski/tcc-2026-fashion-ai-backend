"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { label } from "@/lib/api/taxonomy";
import { useApi } from "@/lib/hooks/use-api";
import type { UserCard } from "@/lib/api/types";
import { Avatar, Badge, Button, Dialog, EmptyState, Field, Input, Select, Skeleton, useToast } from "@/components/ui";
import { DeckSummary, FlairCardView, STAT_META, type FlairDeck, type FlairRound } from "@/components/flair/flair-card";
import { tr, useI18n } from "@/lib/i18n/i18n";

/**
 * Modos clássicos do FLAIR (RF37): Duelo 1×1 e treino com a Casa, Batalha de ocasião do dia e Equipes 3×3 com liga.
 * Antes viviam na aba "Duelos e equipes"; agora são três modos do catálogo de Partidas, ao lado dos 15 modos novos.
 */
export interface Rank { code: string; label: string; points: number; next?: { label: string; at: number } | null; }
export interface Team { id: string; name: string; code: string; color: string; points: number; owner: UserCard; members: { user: UserCard; role: string }[]; mine: boolean; }
export interface FlairMe { coins: number; rank: Rank; wins: number; losses: number; draws: number; skins: string[]; activeSkin?: string | null; skinShop: Record<string, number>; season: string; team?: Team | null; ledger: { delta: number; reason: string; ref: string; at: string }[]; recent: { matchId: string; mode: string; theme?: string; date: string; deck?: string; power: number; score?: number | null; outcome?: string | null }[]; ethics: string; }
interface League { teams: Team[]; mine?: Team | null; players: { user: UserCard; rank: Rank; wins: number }[]; rule: string; battles?: { id: string; theme: string; winner: string; date: string; side: string }[]; }
interface Arena { date: string; theme: string; rule: string; leaderboard: { position: number; user: UserCard; deck?: string; score: number; power: number; you: boolean }[]; }
interface DuelResult { matchId: string; mode: string; me: FlairDeck; opponent: { label: string; deck: FlairDeck }; rounds: FlairRound[]; score: { me: number; opponent: number }; outcome: "WIN" | "LOSS" | "DRAW"; coins: number; rewardCapReached: boolean; faiPoints?: number; }
interface TeamSide { user: UserCard; deck: string; power: number; }
interface TeamBattle { teamA: Team; teamB: Team; duels: { slot: number; a: TeamSide | null; b: TeamSide | null; winner: string; rounds: FlairRound[] }[]; score: { a: number; b: number }; winner: string; faiPoints?: number; }

export const OUTCOME: Record<string, { label: string; tone: "mark" | "thread" | "chalk" }> = { WIN: { get label() { return tr("common.vitoria"); }, tone: "thread" }, LOSS: { get label() { return tr("common.derrota"); }, tone: "mark" }, DRAW: { get label() { return tr("common.empate"); }, tone: "chalk" } };
export const MODE_LABEL: Record<string, string> = { get DUEL() { return tr("flair.duelo_1_1"); }, get TREINO() { return tr("flair.treino_com_a_casa"); }, get ARENA() { return tr("flair.batalha_de_ocasiao"); }, get TEAM() { return tr("flair.equipes_3_3"); } };

/** Rodadas do duelo reveladas uma a uma (sem animação com "reduzir movimento"). */
export function Rounds({ rounds, a, b }: { rounds: FlairRound[]; a: string; b: string }) {
  const { t } = useI18n();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShown(rounds.length); return; }
    const h = setInterval(() => setShown((s) => { if (s >= rounds.length) { clearInterval(h); return s; } return s + 1; }), 450);
    return () => clearInterval(h);
  }, [rounds]);
  const max = Math.max(1, ...rounds.map((r) => Math.max(r.a, r.b)));
  return (
    <ol className="grid gap-2" aria-live="polite">
      {rounds.slice(0, shown).map((r) => (
        <li key={r.stat} className="flair-round">
          <div className="flex items-center justify-between type-caption"><b style={{ color: STAT_META[r.stat]?.color }}>{r.stat}</b><span className="text-muted">{STAT_META[r.stat]?.hint}</span></div>
          <div className="flair-round-bars">
            <span className={r.winner === "A" ? "win" : ""}>{a}</span><i><b style={{ width: `${(r.a / max) * 100}%` }} /></i><em className="tabular">{r.a}</em>
            <span className={r.winner === "B" ? "win" : ""}>{b}</span><i><b className="alt" style={{ width: `${(r.b / max) * 100}%` }} /></i><em className="tabular">{r.b}</em>
          </div>
          <p className="type-caption">{r.winner === "DRAW" ? t("common.empate") : t("flair.rodada_de", { value: r.winner === "A" ? a : b })}{r.notes.length ? ` · ${r.notes.join(" · ")}` : ""}</p>
        </li>
      ))}
    </ol>
  );
}

/** Estado comum dos três modos: decks da pessoa, deck escolhido (também por ?deck=) e a execução com erro em toast. */
function useClassic(onPlayed?: () => void) {
  const toast = useToast(); const sp = useSearchParams();
  const decks = useApi<FlairDeck[]>((signal) => api.get("/api/flair/decks", { signal }), []);
  const [deckId, setDeckId] = useState(sp.get("deck") ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (!deckId && decks.data?.[0]?.schemeId) setDeckId(decks.data[0].schemeId); }, [decks.data, deckId]);
  async function run<T>(key: string, fn: () => Promise<T>, after?: (r: T) => void) {
    setBusy(key);
    try { const r = await fn(); after?.(r); onPlayed?.(); } catch (e) { toast.fromError(e); } finally { setBusy(null); }
  }
  return { decks, deckId, setDeckId, busy, run };
}

function DeckSelect({ decks, value, onChange }: { decks: FlairDeck[]; value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  return (
    <Field label={t("flair.seu_deck_esquema")} id="deck">
      <Select id="deck" value={value} onChange={(e) => onChange(e.target.value)}>
        {decks.map((d) => <option key={d.schemeId ?? d.title} value={d.schemeId ?? ""}>{t("flair.poder", { title: d.title, power: d.power })}</option>)}
      </Select>
    </Field>
  );
}

export function DuelPanel({ onPlayed, skin }: { onPlayed?: () => void; skin?: string | null }) {
  const { t } = useI18n();
  const { decks, deckId, setDeckId, busy, run } = useClassic(onPlayed);
  const [opponent, setOpponent] = useState(""); const [duel, setDuel] = useState<DuelResult | null>(null);
  const playDuel = (opp: string) => run("duel", () => api.post<DuelResult>("/api/flair/duels", { schemeId: deckId, opponent: opp }), (r) => setDuel(r));
  if (decks.loading) return <Skeleton className="h-40" />;
  return (
    <div className="grid gap-3">
      {(decks.data?.length ?? 0) === 0 ? <EmptyState title={t("flair.voce_ainda_nao_tem_decks")} hint={t("flair.crie_um_esquema_com_pecas")} action={<Link href="/schemes/new" className="btn btn-sm">{t("common.criar_esquema")}</Link>} /> : <>
        <DeckSelect decks={decks.data ?? []} value={deckId} onChange={setDeckId} />
        <Field label={t("flair.oponente_usuario")} id="opp"><Input id="opp" placeholder="@paris_lea" value={opponent} onChange={(e) => setOpponent(e.target.value)} /></Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" loading={busy === "duel"} disabled={!deckId || !opponent.trim()} onClick={() => playDuel(opponent.trim())}>{t("flair.duelar")}</Button>
          <Button loading={busy === "duel"} disabled={!deckId} onClick={() => playDuel("CASA")}>{t("flair.treinar_com_a_casa")}</Button>
        </div>
        <p className="type-caption text-faint">{t("flair.recompensa_do_sistema_vitoria_40")}</p>
      </>}
      <Dialog open={!!duel} onClose={() => setDuel(null)} size="xl" title={duel ? `${MODE_LABEL[duel.mode] ?? t("flair.duelo")} · ${duel.opponent.label}` : ""}
        footer={<Button variant="primary" onClick={() => setDuel(null)}>{t("common.close")}</Button>}>
        {duel && <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="surface p-3"><p className="type-caption text-muted">{t("flair.voce")}</p><DeckSummary deck={duel.me} compact /><div className="mt-2 flex gap-2 overflow-x-auto">{duel.me.cards.map((c) => <FlairCardView key={c.id} card={c} size="sm" skin={skin} />)}</div></div>
            <div className="surface p-3"><p className="type-caption text-muted">{duel.opponent.label}</p><DeckSummary deck={duel.opponent.deck} compact /><div className="mt-2 flex gap-2 overflow-x-auto">{duel.opponent.deck.cards.map((c) => <FlairCardView key={c.id} card={c} size="sm" />)}</div></div>
          </div>
          <Rounds rounds={duel.rounds} a={t("flair.voce")} b={duel.opponent.label} />
          <div className="flair-result"><Badge tone={OUTCOME[duel.outcome].tone}>{OUTCOME[duel.outcome].label}</Badge><b className="tabular">{duel.score.me} × {duel.score.opponent}</b>
            <span className="type-caption">{duel.rewardCapReached ? t("flair.teto_diario_de_duelos_premiados") : t("common.coins", { coins: duel.coins })}</span>
            {(duel.faiPoints ?? 0) > 0 && <Badge tone="mark">{t("common.fai_points_ganhos", { points: duel.faiPoints })}</Badge>}</div>
        </div>}
      </Dialog>
    </div>
  );
}

export function ArenaPanel({ onPlayed }: { onPlayed?: () => void }) {
  const { t } = useI18n();
  const { decks, deckId, setDeckId, busy, run } = useClassic(onPlayed);
  const arena = useApi<Arena>((signal) => api.get("/api/flair/arena", { signal }), []);
  if (arena.loading || decks.loading || !arena.data) return <Skeleton className="h-40" />;
  const a = arena.data; const joined = a.leaderboard.some((x) => x.you);
  return (
    <div className="grid gap-3">
      <p className="type-body">{t("flair.tema_de_hoje")}{" "}<Badge tone="thread">{label(a.theme)}</Badge></p>
      <p className="type-caption text-muted">{a.rule}</p>
      {(decks.data?.length ?? 0) === 0 ? <EmptyState title={t("flair.voce_ainda_nao_tem_decks")} hint={t("flair.crie_um_esquema_com_pecas")} action={<Link href="/schemes/new" className="btn btn-sm">{t("common.criar_esquema")}</Link>} /> : <>
        <DeckSelect decks={decks.data ?? []} value={deckId} onChange={setDeckId} />
        <div><Button variant="primary" loading={busy === "arena"} disabled={!deckId || joined} onClick={() => run("arena", () => api.post<Arena>("/api/flair/arena", { schemeId: deckId }), (r) => arena.setData(r))}>
          {joined ? t("flair.voce_ja_esta_na_batalha") : t("flair.inscrever_deck")}</Button></div>
      </>}
      <ol className="fai-list">
        {a.leaderboard.slice(0, 10).map((x) => (
          <li key={x.position} className={`flex items-center gap-2 rounded px-2 py-1 ${x.you ? "bg-surface-2 ring-1 ring-thread" : ""}`}>
            <span className="w-6 tabular type-caption">{x.position}º</span><Avatar src={x.user.avatarUrl} name={x.user.displayName} size={24} />
            <span className="min-w-0 flex-1 truncate type-body-sm">@{x.user.username} · {x.deck}</span><b className="tabular type-body-sm">{x.score}</b>
          </li>
        ))}
        {a.leaderboard.length === 0 && <li className="type-caption text-muted">{t("flair.ninguem_jogou_hoje_ainda_seja")}</li>}
      </ol>
    </div>
  );
}

export function TeamPanel({ onPlayed }: { onPlayed?: () => void }) {
  const { rich, t } = useI18n();
  const { busy, run } = useClassic(onPlayed);
  const league = useApi<League>((signal) => api.get("/api/flair/teams", { signal }), []);
  const [teamForm, setTeamForm] = useState({ name: "", color: "#2D55C9", join: "", rival: "" });
  const [battle, setBattle] = useState<TeamBattle | null>(null);
  if (league.loading || !league.data) return <Skeleton className="h-40" />;
  const d = league.data;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <p className="type-caption text-muted mb-2">{d.rule}</p>
        {d.mine ? (
          <div className="surface p-3" style={{ borderLeft: `4px solid ${d.mine.color}` }}>
            <p className="type-h3">{d.mine.name} <span className="type-caption text-muted">{t("flair.pts", { points: d.mine.points })}</span></p>
            <p className="type-caption">{rich("flair.codigo_de_convite", { code: d.mine.code }, { 0: ($c) => <code className="flair-code">{$c}</code> })}</p>
            <div className="mt-2 flex flex-wrap gap-1">{d.mine.members.map((x) => <span key={x.user.id} className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 type-caption"><Avatar src={x.user.avatarUrl} name={x.user.displayName} size={18} />@{x.user.username}{x.role === "CAPITAO" ? " ★" : ""}</span>)}</div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Field label={t("flair.desafiar_a_equipe_codigo")} id="rival" className="flex-1"><Input id="rival" placeholder="T1AB2CD" value={teamForm.rival} onChange={(e) => setTeamForm({ ...teamForm, rival: e.target.value })} /></Field>
              <Button variant="primary" loading={busy === "battle"} disabled={!teamForm.rival.trim()} onClick={() => run("battle", () => api.post<TeamBattle>("/api/flair/teams/battles", { code: teamForm.rival.trim() }), (r) => { setBattle(r); league.reload(); })}>{t("flair.duelo_de_equipes")}</Button>
            </div>
            <Button size="sm" className="mt-2" onClick={() => run("leave", () => api.delete<League>("/api/flair/teams/me"), (r) => league.setData(r))}>{t("flair.sair_da_equipe")}</Button>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t("flair.nome_da_nova_equipe")} id="tname" className="flex-1"><Input id="tname" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} /></Field>
              <Field label={t("common.color")} id="tcolor"><Input id="tcolor" type="color" value={teamForm.color} onChange={(e) => setTeamForm({ ...teamForm, color: e.target.value })} className="h-10 w-14 p-1" /></Field>
              <Button variant="primary" disabled={teamForm.name.trim().length < 3} loading={busy === "team"} onClick={() => run("team", () => api.post<League>("/api/flair/teams", { name: teamForm.name, color: teamForm.color }), (r) => league.setData(r))}>{t("flair.criar")}</Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t("flair.entrar_com_codigo")} id="tjoin" className="flex-1"><Input id="tjoin" value={teamForm.join} onChange={(e) => setTeamForm({ ...teamForm, join: e.target.value })} /></Field>
              <Button disabled={!teamForm.join.trim()} loading={busy === "join"} onClick={() => run("join", () => api.post<League>("/api/flair/teams/join", { code: teamForm.join.trim() }), (r) => league.setData(r))}>{t("nav.login")}</Button>
            </div>
          </div>
        )}
        {(d.battles?.length ?? 0) > 0 && <><p className="label mt-3">{t("flair.batalhas_da_minha_equipe")}</p><ul className="fai-list">{d.battles!.map((b) => <li key={b.id} className="type-caption flex justify-between gap-2"><span className="truncate">{b.theme} · {b.date}</span><Badge tone={b.winner === "DRAW" ? "chalk" : b.winner === b.side ? "thread" : "mark"}>{b.winner === "DRAW" ? t("common.empate") : b.winner === b.side ? t("common.vitoria") : t("common.derrota")}</Badge></li>)}</ul></>}
      </div>
      <div>
        <p className="label">{t("flair.liga_semanal")}</p>
        <table className="w-full type-body-sm"><thead><tr className="text-left type-caption text-muted"><th>#</th><th>{t("flair.equipe")}</th><th>{t("flair.integrantes")}</th><th className="text-right">{t("common.pts")}</th></tr></thead>
          <tbody>{d.teams.map((x, i) => <tr key={x.id} className={x.mine ? "font-semibold" : ""}><td className="tabular">{i + 1}</td><td><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />{x.name}</td><td className="tabular">{x.members.length}/5</td><td className="text-right tabular">{x.points}</td></tr>)}</tbody></table>
        <p className="label mt-3">{t("flair.ranking_de_jogadores")}</p>
        <ol className="fai-list">{d.players.slice(0, 8).map((p, i) => <li key={p.user.id} className="flex items-center gap-2 type-body-sm"><span className="w-5 tabular type-caption">{i + 1}</span><Avatar src={p.user.avatarUrl} name={p.user.displayName} size={20} /><span className="min-w-0 flex-1 truncate">@{p.user.username}</span><Badge>{p.rank.label}</Badge><span className="tabular type-caption">{p.wins}V</span></li>)}</ol>
      </div>
      <Dialog open={!!battle} onClose={() => setBattle(null)} size="xl" title={battle ? `${battle.teamA.name} × ${battle.teamB.name}` : ""} footer={<Button variant="primary" onClick={() => setBattle(null)}>{t("common.close")}</Button>}>
        {battle && <div className="grid gap-3">
          {battle.duels.map((x) => (
            <div key={x.slot} className="surface p-3">
              <p className="type-caption text-muted">{t("flair.par", { slot: x.slot })}</p>
              <div className="flex flex-wrap items-center justify-between gap-2 type-body-sm">
                <span className={x.winner === "A" ? "font-semibold" : ""}>{x.a ? `@${x.a.user.username} · ${x.a.deck} (${x.a.power})` : t("flair.sem_deck")}</span><span className="type-caption">×</span>
                <span className={x.winner === "B" ? "font-semibold" : ""}>{x.b ? `@${x.b.user.username} · ${x.b.deck} (${x.b.power})` : t("flair.sem_deck")}</span>
              </div>
              {x.rounds.length > 0 && <p className="type-caption mt-1">{x.rounds.map((r) => `${r.stat} ${r.winner === "DRAW" ? "=" : r.winner === "A" ? "◀" : "▶"}`).join(" · ")}</p>}
            </div>))}
          <div className="flair-result"><Badge tone={battle.winner === "A" ? "thread" : battle.winner === "B" ? "mark" : "chalk"}>{battle.winner === "A" ? t("flair.vitoria_da_sua_equipe") : battle.winner === "B" ? t("flair.vitoria_da_equipe_rival") : t("common.empate")}</Badge><b className="tabular">{battle.score.a} × {battle.score.b}</b><span className="type-caption">{t("flair.vitoria_3_pontos_na_liga")}</span>{(battle.faiPoints ?? 0) > 0 && <Badge tone="mark">{t("common.fai_points_ganhos", { points: battle.faiPoints })}</Badge>}</div>
        </div>}
      </Dialog>
    </div>
  );
}
