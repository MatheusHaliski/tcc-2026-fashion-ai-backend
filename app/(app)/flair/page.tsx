"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { label } from "@/lib/api/taxonomy";
import { useApi } from "@/lib/hooks/use-api";
import type { UserCard } from "@/lib/api/types";
import { RequireAuth } from "@/components/app-shell";
import { Avatar, Badge, Button, Card, Chip, Dialog, EmptyState, ErrorState, Field, Input, PageHeader, Select, Skeleton, SkeletonGrid, Tabs, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { DeckSummary, FlairCardView, RARITY_META, SEASON_LABEL, STAT_META, type FlairCard, type FlairDeck, type FlairRound } from "@/components/flair/flair-card";
import { FlairModes } from "@/components/flair/modes";
import { checkLabel, couponText, GAME_TYPE_LABEL, VoucherDialog, type Combination, type Voucher } from "@/components/flair/flair-shared";
import { tr, useI18n } from "@/lib/i18n/i18n";

interface Rank { code: string; label: string; points: number; next?: { label: string; at: number } | null; }
interface Team { id: string; name: string; code: string; color: string; points: number; owner: UserCard; members: { user: UserCard; role: string }[]; mine: boolean; }
interface Entry { matchId: string; mode: string; theme?: string; date: string; deck?: string; power: number; score?: number | null; outcome?: string | null; }
interface Me { coins: number; rank: Rank; wins: number; losses: number; draws: number; skins: string[]; activeSkin?: string | null; skinShop: Record<string, number>; season: string; team?: Team | null; ledger: { delta: number; reason: string; ref: string; at: string }[]; recent: Entry[]; ethics: string; }
interface League { teams: Team[]; mine?: Team | null; players: { user: UserCard; rank: Rank; wins: number }[]; rule: string; battles?: { id: string; theme: string; winner: string; date: string; side: string }[]; }
interface Arena { date: string; theme: string; rule: string; leaderboard: { position: number; user: UserCard; deck?: string; score: number; power: number; you: boolean }[]; }
interface Quest { code: string; label: string; period: "DAY" | "WEEK"; rule: string; coins: number; progress: number; target: number; done: boolean; claimed: boolean; }
interface DuelResult { matchId: string; mode: string; me: FlairDeck; opponent: { label: string; deck: FlairDeck }; rounds: FlairRound[]; score: { me: number; opponent: number }; outcome: "WIN" | "LOSS" | "DRAW"; coins: number; rewardCapReached: boolean; }
interface TeamSide { user: UserCard; deck: string; power: number; }
interface TeamBattle { teamA: Team; teamB: Team; duels: { slot: number; a: TeamSide | null; b: TeamSide | null; winner: string; rounds: FlairRound[] }[]; score: { a: number; b: number }; winner: string; }

const OUTCOME: Record<string, { label: string; tone: "mark" | "thread" | "chalk" }> = { WIN: { get label() { return tr("common.vitoria"); }, tone: "thread" }, LOSS: { get label() { return tr("common.derrota"); }, tone: "mark" }, DRAW: { get label() { return tr("common.empate"); }, tone: "chalk" } };
const MODE_LABEL: Record<string, string> = { get DUEL() { return tr("flair.duelo_1_1"); }, get TREINO() { return tr("flair.treino_com_a_casa"); }, get ARENA() { return tr("flair.batalha_de_ocasiao"); }, get TEAM() { return tr("flair.equipes_3_3"); } };
const SKIN_LABEL: Record<string, string> = { get BRAND_FRAME() { return tr("flair.moldura_de_marca"); }, get HOLOGRAFICO() { return tr("sealMedallion.holografico"); }, get CHAMPION() { return tr("flair.campeao"); } };


/** Rodadas do duelo reveladas uma a uma (sem animação com "reduzir movimento"). */
function Rounds({ rounds, a, b }: { rounds: FlairRound[]; a: string; b: string }) {
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

function FlairInner() {
  const { rich, t } = useI18n();
  const toast = useToast(); const sp = useSearchParams();
  const initial = (sp.get("tab") ?? "modos") as "modos" | "jogar" | "cartas" | "decks" | "lojas" | "carteira" | "quests";
  const [tab, setTab] = useState(initial);
  const me = useApi<Me>((signal) => api.get("/api/flair/me", { signal }), []);
  const decks = useApi<FlairDeck[]>((signal) => api.get("/api/flair/decks", { signal }), []);
  const cards = useApi<{ season: string; cards: FlairCard[]; album: { slots: number; collected: number; rows: { category: string; rarities: Record<string, boolean> }[] } }>((signal) => api.get("/api/flair/cards", { signal }), [], { enabled: tab === "cartas" });
  const arena = useApi<Arena>((signal) => api.get("/api/flair/arena", { signal }), [], { enabled: tab === "jogar" });
  const league = useApi<League>((signal) => api.get("/api/flair/teams", { signal }), [], { enabled: tab === "jogar" });
  const combos = useApi<Combination[]>((signal) => api.get("/api/flair/combinations", { signal }), [], { enabled: tab === "lojas" });
  const vouchers = useApi<Voucher[]>((signal) => api.get("/api/flair/vouchers", { signal }), [], { enabled: tab === "carteira" || tab === "lojas" });
  const quests = useApi<Quest[]>((signal) => api.get("/api/flair/quests", { signal }), [], { enabled: tab === "quests" });
  const [deckId, setDeckId] = useState(""); const [opponent, setOpponent] = useState("");
  const [duel, setDuel] = useState<DuelResult | null>(null); const [battle, setBattle] = useState<TeamBattle | null>(null);
  const [teamForm, setTeamForm] = useState({ name: "", color: "#2D55C9", join: "", rival: "" });
  const [busy, setBusy] = useState<string | null>(null); const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [filter, setFilter] = useState("TODAS");
  useEffect(() => { if (!deckId && decks.data?.[0]?.schemeId) setDeckId(decks.data[0].schemeId); }, [decks.data, deckId]);
  const skin = me.data?.activeSkin ?? null;

  async function run<T>(key: string, fn: () => Promise<T>, after?: (r: T) => void) {
    setBusy(key);
    try { const r = await fn(); after?.(r); } catch (e) { toast.fromError(e); } finally { setBusy(null); }
  }
  const playDuel = (opp: string) => run("duel", () => api.post<DuelResult>("/api/flair/duels", { schemeId: deckId, opponent: opp }), (r) => { setDuel(r); me.reload(); });
  const deckSelect = (
    <Field label={t("flair.seu_deck_esquema")} id="deck">
      <Select id="deck" value={deckId} onChange={(e) => setDeckId(e.target.value)}>
        {(decks.data ?? []).map((d) => <option key={d.schemeId ?? d.title} value={d.schemeId ?? ""}>{t("flair.poder", { title: d.title, power: d.power })}</option>)}
      </Select>
    </Field>
  );
  const m = me.data;
  const nextAt = m?.rank.next?.at ?? m?.rank.points ?? 1;

  return (
    <>
      <PageHeader title="FLAIR" kicker={t("flair.rf37_jogo_de_cartas")}
        lead={t("flair.o_guarda_roupa_e_a")}
        actions={m ? <div className="flex flex-wrap items-center gap-2"><Badge tone="thread"><span title={t("flair.rankHint")}>{m.rank.label}</span></Badge><Badge><span title={t("flair.coinsHint")}>{t("flair.coins_3", { coins: m.coins })}</span></Badge><Badge tone="chalk"><span aria-label={t("flair.recordLong", { wins: m.wins, draws: m.draws, losses: m.losses })} title={t("flair.recordLong", { wins: m.wins, draws: m.draws, losses: m.losses })}>{t("flair.recordShort", { wins: m.wins, draws: m.draws, losses: m.losses })}</span></Badge></div> : undefined} />
      {m && (
        <div className="surface mb-4 flex flex-wrap items-center gap-4 p-3">
          <div className="min-w-[180px] flex-1">
            <p className="type-caption text-muted">{t("flair.rank_pts", { label: m.rank.label, points: m.rank.points, value: m.rank.next ? t("flair.em", { label: m.rank.next.label, at: m.rank.next.at }) : "" })}</p>
            <div className="hype-bar mt-1"><i style={{ width: `${Math.min(100, (m.rank.points / nextAt) * 100)}%`, background: "var(--thread)" }} /></div>
          </div>
          <p className="type-caption">{rich("flair.estacao_do_jogo_cartas_da", { value: SEASON_LABEL[m.season] ?? m.season }, { 0: ($c) => <b>{$c}</b> })}</p>
          {m.team && <p className="type-caption">{rich("flair.equipe_pts", { name: m.team.name, points: m.team.points }, { 0: ($c) => <b style={{ color: m.team?.color }}>{$c}</b> })}</p>}
        </div>
      )}
      <Tabs tabs={[{ id: "modos", label: t("flair.modos_de_jogo") }, { id: "jogar", label: t("flair.duelos_e_equipes") }, { id: "cartas", label: t("flair.cartas_e_album") }, { id: "decks", label: t("flair.decks"), count: decks.data?.length }, { id: "lojas", label: t("flair.combinacoes_das_lojas") }, { id: "carteira", label: t("flair.carteira") }, { id: "quests", label: t("flair.quests") }]} value={tab} onChange={setTab} />

      {tab === "modos" && <FlairModes initial={sp.get("mode")} />}

      {tab === "jogar" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="flex items-center gap-2"><FaiIcon id="ACT-46" size={24} decorative /><h2 className="type-h3">{t("flair.duelo_de_estilo_1_1")}</h2></div>
            <p className="type-body-sm text-muted mb-2">{t("flair.n5_rodadas_edge_range_clout")}</p>
            {(decks.data?.length ?? 0) === 0 ? <EmptyState title={t("flair.voce_ainda_nao_tem_decks")} hint={t("flair.crie_um_esquema_com_pecas")} action={<Link href="/schemes/new" className="btn btn-sm">{t("common.criar_esquema")}</Link>} /> : <>
              {deckSelect}
              <Field label={t("flair.oponente_usuario")} id="opp"><Input id="opp" placeholder="@paris_lea" value={opponent} onChange={(e) => setOpponent(e.target.value)} /></Field>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" loading={busy === "duel"} disabled={!deckId || !opponent.trim()} onClick={() => playDuel(opponent.trim())}>{t("flair.duelar")}</Button>
                <Button loading={busy === "duel"} disabled={!deckId} onClick={() => playDuel("CASA")}>{t("flair.treinar_com_a_casa")}</Button>
              </div>
              <p className="type-caption text-faint mt-2">{t("flair.recompensa_do_sistema_vitoria_40")}</p>
            </>}
          </Card>

          <Card>
            <div className="flex items-center gap-2"><FaiIcon id="ACT-44" size={24} decorative /><h2 className="type-h3">{t("flair.batalha_de_ocasiao_do_dia")}</h2></div>
            {arena.loading ? <Skeleton className="h-40" /> : arena.data && <>
              <p className="type-body-sm mb-1">{t("flair.tema_de_hoje")}{" "}<Badge tone="thread">{label(arena.data.theme)}</Badge></p>
              <p className="type-caption text-muted mb-2">{arena.data.rule}</p>
              {deckSelect}
              <Button variant="primary" loading={busy === "arena"} disabled={!deckId || arena.data.leaderboard.some((x) => x.you)}
                onClick={() => run("arena", () => api.post<Arena>("/api/flair/arena", { schemeId: deckId }), (r) => { arena.setData(r); me.reload(); })}>
                {arena.data.leaderboard.some((x) => x.you) ? t("flair.voce_ja_esta_na_batalha") : t("flair.inscrever_deck")}
              </Button>
              <ol className="mt-3 grid gap-1">
                {arena.data.leaderboard.slice(0, 10).map((x) => (
                  <li key={x.position} className={`flex items-center gap-2 rounded px-2 py-1 ${x.you ? "bg-surface-2 ring-1 ring-thread" : ""}`}>
                    <span className="w-6 tabular type-caption">{x.position}º</span><Avatar src={x.user.avatarUrl} name={x.user.displayName} size={24} />
                    <span className="min-w-0 flex-1 truncate type-body-sm">@{x.user.username} · {x.deck}</span><b className="tabular type-body-sm">{x.score}</b>
                  </li>
                ))}
                {arena.data.leaderboard.length === 0 && <li className="type-caption text-muted">{t("flair.ninguem_jogou_hoje_ainda_seja")}</li>}
              </ol>
            </>}
          </Card>

          <Card className="lg:col-span-2">
            <div className="flex items-center gap-2"><FaiIcon id="ACT-45" size={24} decorative /><h2 className="type-h3">{t("flair.equipes_3_3_e_liga")}</h2></div>
            {league.loading ? <Skeleton className="h-40" /> : league.data && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="type-caption text-muted mb-2">{league.data.rule}</p>
                  {league.data.mine ? (
                    <div className="surface p-3" style={{ borderLeft: `4px solid ${league.data.mine.color}` }}>
                      <p className="type-h3">{league.data.mine.name} <span className="type-caption text-muted">{t("flair.pts", { points: league.data.mine.points })}</span></p>
                      <p className="type-caption">{rich("flair.codigo_de_convite", { code: league.data.mine.code }, { 0: ($c) => <code className="flair-code">{$c}</code> })}</p>
                      <div className="mt-2 flex flex-wrap gap-1">{league.data.mine.members.map((x) => <span key={x.user.id} className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 type-caption"><Avatar src={x.user.avatarUrl} name={x.user.displayName} size={18} />@{x.user.username}{x.role === "CAPITAO" ? " ★" : ""}</span>)}</div>
                      <div className="mt-3 flex flex-wrap items-end gap-2">
                        <Field label={t("flair.desafiar_a_equipe_codigo")} id="rival" className="flex-1"><Input id="rival" placeholder="T1AB2CD" value={teamForm.rival} onChange={(e) => setTeamForm({ ...teamForm, rival: e.target.value })} /></Field>
                        <Button variant="primary" loading={busy === "battle"} disabled={!teamForm.rival.trim()} onClick={() => run("battle", () => api.post<TeamBattle>("/api/flair/teams/battles", { code: teamForm.rival.trim() }), (r) => { setBattle(r); league.reload(); me.reload(); })}>{t("flair.duelo_de_equipes")}</Button>
                      </div>
                      <Button size="sm" className="mt-2" onClick={() => run("leave", () => api.delete<League>("/api/flair/teams/me"), (r) => { league.setData(r); me.reload(); })}>{t("flair.sair_da_equipe")}</Button>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <div className="flex flex-wrap items-end gap-2">
                        <Field label={t("flair.nome_da_nova_equipe")} id="tname" className="flex-1"><Input id="tname" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} /></Field>
                        <Field label={t("common.color")} id="tcolor"><Input id="tcolor" type="color" value={teamForm.color} onChange={(e) => setTeamForm({ ...teamForm, color: e.target.value })} className="h-10 w-14 p-1" /></Field>
                        <Button variant="primary" disabled={teamForm.name.trim().length < 3} loading={busy === "team"} onClick={() => run("team", () => api.post<League>("/api/flair/teams", { name: teamForm.name, color: teamForm.color }), (r) => { league.setData(r); me.reload(); })}>{t("flair.criar")}</Button>
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <Field label={t("flair.entrar_com_codigo")} id="tjoin" className="flex-1"><Input id="tjoin" value={teamForm.join} onChange={(e) => setTeamForm({ ...teamForm, join: e.target.value })} /></Field>
                        <Button disabled={!teamForm.join.trim()} loading={busy === "join"} onClick={() => run("join", () => api.post<League>("/api/flair/teams/join", { code: teamForm.join.trim() }), (r) => { league.setData(r); me.reload(); })}>{t("nav.login")}</Button>
                      </div>
                    </div>
                  )}
                  {(league.data.battles?.length ?? 0) > 0 && <><p className="label mt-3">{t("flair.batalhas_da_minha_equipe")}</p><ul className="grid gap-1">{league.data.battles!.map((b) => <li key={b.id} className="type-caption flex justify-between gap-2"><span className="truncate">{b.theme} · {b.date}</span><Badge tone={b.winner === "DRAW" ? "chalk" : b.winner === b.side ? "thread" : "mark"}>{b.winner === "DRAW" ? t("common.empate") : b.winner === b.side ? t("common.vitoria") : t("common.derrota")}</Badge></li>)}</ul></>}
                </div>
                <div>
                  <p className="label">{t("flair.liga_semanal")}</p>
                  <table className="w-full type-body-sm"><thead><tr className="text-left type-caption text-muted"><th>#</th><th>{t("flair.equipe")}</th><th>{t("flair.integrantes")}</th><th className="text-right">{t("common.pts")}</th></tr></thead>
                    <tbody>{league.data.teams.map((t, i) => <tr key={t.id} className={t.mine ? "font-semibold" : ""}><td className="tabular">{i + 1}</td><td><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />{t.name}</td><td className="tabular">{t.members.length}/5</td><td className="text-right tabular">{t.points}</td></tr>)}</tbody></table>
                  <p className="label mt-3">{t("flair.ranking_de_jogadores")}</p>
                  <ol className="grid gap-1">{league.data.players.slice(0, 8).map((p, i) => <li key={p.user.id} className="flex items-center gap-2 type-body-sm"><span className="w-5 tabular type-caption">{i + 1}</span><Avatar src={p.user.avatarUrl} name={p.user.displayName} size={20} /><span className="min-w-0 flex-1 truncate">@{p.user.username}</span><Badge>{p.rank.label}</Badge><span className="tabular type-caption">{p.wins}V</span></li>)}</ol>
                </div>
              </div>
            )}
          </Card>

          <Card className="lg:col-span-2">
            <h2 className="type-h3 mb-1">{t("flair.variacoes_de_jogo")}</h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 type-body-sm">
              <li>{rich("flair.combinacao_da_loja_um_deck", undefined, { 0: ($c) => <b>{$c}</b> })}</li>
              <li>{rich("flair.colecao_a_loja_pede_um", undefined, { 0: ($c) => <b>{$c}</b> })}</li>
              <li>{rich("flair.duelo_patrocinado_vencer_duelos_na", undefined, { 0: ($c) => <b>{$c}</b> })}</li>
              <li>{rich("flair.duelo_1_1_e_treino", undefined, { 0: ($c) => <b>{$c}</b>, 1: ($c) => <b>{$c}</b> })}</li>
              <li>{rich("flair.batalha_de_ocasiao_tema_do", undefined, { 0: ($c) => <b>{$c}</b> })}</li>
              <li>{rich("flair.equipes_3_3_e_liga_2", undefined, { 0: ($c) => <b>{$c}</b>, 1: ($c) => <b>{$c}</b> })}</li>
              <li>{rich("flair.quests_diarias_e_semanais_album", undefined, { 0: ($c) => <b>{$c}</b>, 1: ($c) => <b>{$c}</b>, 2: ($c) => <b>{$c}</b> })}</li>
              <li>{rich("flair.skins_de_carta_compradas_com", undefined, { 0: ($c) => <b>{$c}</b> })}</li>
            </ul>
          </Card>
        </div>
      )}

      {tab === "cartas" && (cards.error ? <ErrorState error={cards.error} onRetry={cards.reload} /> : cards.loading || !cards.data ? <SkeletonGrid /> : <>
        <Card className="mb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="type-h3">{t("flair.album_de_raridades")}</h2><span className="type-caption tabular">{t("flair.figurinhas", { collected: cards.data.album.collected, slots: cards.data.album.slots })}</span></div>
          <div className="mt-2 overflow-x-auto"><table className="flair-album"><thead><tr><th />{Object.keys(RARITY_META).map((r) => <th key={r}>{RARITY_META[r].label}</th>)}</tr></thead>
            <tbody>{cards.data.album.rows.map((row) => <tr key={row.category}><th>{label(row.category)}</th>{Object.entries(row.rarities).map(([r, ok]) => <td key={r}><span className={ok ? "flair-slot on" : "flair-slot"} style={ok ? { background: RARITY_META[r].frame } : undefined} aria-label={ok ? t("flair.coletada") : t("flair.faltando")}>{ok ? "✓" : ""}</span></td>)}</tr>)}</tbody></table></div>
          <p className="type-caption text-muted mt-2">{t("flair.raridade_rare_hype_80_ou")}</p>
        </Card>
        {cards.data.cards.length === 0 ? <EmptyState title={t("flair.nenhuma_carta_ainda")} hint={t("flair.cada_peca_do_seu_guarda")} action={<Link className="btn btn-sm" href="/pieces/new">{t("common.cadastrar_peca")}</Link>} /> :
          <div className="flair-grid">{cards.data.cards.map((c) => <FlairCardView key={c.id} card={c} skin={skin} />)}</div>}
      </>)}

      {tab === "decks" && (decks.error ? <ErrorState error={decks.error} onRetry={decks.reload} /> : decks.loading ? <SkeletonGrid /> : (decks.data ?? []).length === 0 ? <EmptyState title={t("flair.nenhum_deck")} hint={t("flair.cada_esquema_com_pecas_e")} /> :
        <div className="grid gap-4">{decks.data!.map((d) => (
          <Card key={d.schemeId ?? d.title}>
            <DeckSummary deck={d} />
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{d.cards.map((c) => <FlairCardView key={c.id} card={c} size="sm" skin={skin} />)}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={() => { setDeckId(d.schemeId ?? ""); setTab("jogar"); }}>{t("flair.jogar_com_este_deck")}</Button>
              {d.schemeId && <Link className="btn btn-sm" href={`/schemes/${d.schemeId}`}>{t("flair.abrir_esquema")}</Link>}
            </div>
          </Card>))}</div>)}

      {tab === "lojas" && (combos.error ? <ErrorState error={combos.error} onRetry={combos.reload} /> : combos.loading ? <SkeletonGrid /> : <>
        <div className="mb-3 flex flex-wrap gap-1.5">{["TODAS", "PRONTAS", "COMBINACAO", "COLECAO", "DUELO_PATROCINADO"].map((f) => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f === "TODAS" ? t("flair.todas") : f === "PRONTAS" ? t("flair.prontas_para_trocar") : GAME_TYPE_LABEL[f]}</Chip>)}</div>
        {(combos.data ?? []).length === 0 ? <EmptyState title={t("flair.nenhuma_loja_com_combinacao_ativa")} hint={t("flair.lojas_participantes_publicam")} /> :
          <div className="grid gap-4 md:grid-cols-2">{combos.data!.filter((c) => filter === "TODAS" || (filter === "PRONTAS" ? c.complete && !c.redemption : c.gameType === filter)).map((c) => (
            <Card key={c.id} pad={false} className="overflow-hidden">
              <div className="flair-combo-head" style={{ background: c.accentColor }}>
                <p className="type-caption opacity-90">{GAME_TYPE_LABEL[c.gameType]} · {c.brandSlug ? <Link href={`/brands/${c.brandSlug}`} className="underline">{c.brandName}</Link> : c.brandName}</p>
                <p className="type-h3">{c.name}</p>
                <p className="flair-coupon">{c.coupon.title} <span>{couponText(c.coupon)}</span></p>
              </div>
              <div className="p-3">
                {c.description && <p className="type-body-sm text-muted mb-2">{c.description}</p>}
                <ul className="grid gap-1">{(c.checks ?? []).map((x, i) => <li key={i} className="flex items-start gap-2 type-body-sm"><span className={x.ok ? "flair-check ok" : "flair-check"} aria-hidden>{x.ok ? "✓" : "✕"}</span><span>{checkLabel(x)}</span><span className="sr-only">{x.ok ? t("flair.cumprido") : t("flair.faltando")}</span></li>)}</ul>
                {c.bestDeck && <p className="type-caption mt-2">{rich("flair.melhor_deck_poder", { title: c.bestDeck.title, power: c.bestDeck.power }, { 0: ($c) => <b>{$c}</b> })}</p>}
                <p className="type-caption text-faint mt-1">{t("flair.validade_de_dias_apos_a", { value: c.stock != null ? t("flair.cupons_restantes", { Math: Math.max(0, c.stock - c.redeemed) }) : "", validDays: c.coupon.validDays })}</p>
                <div className="mt-3">
                  {c.redemption ? <Button size="sm" onClick={() => setVoucher(c.redemption!)}>{t("flair.ver_cupom", { code: c.redemption.code })}</Button> :
                    <Button size="sm" variant="primary" disabled={!c.complete || !c.available} loading={busy === c.id}
                      onClick={() => run(c.id, () => api.post<Voucher>(`/api/flair/combinations/${c.id}/redeem${c.bestDeck ? `?schemeId=${c.bestDeck.schemeId}` : ""}`), (v) => { setVoucher(v); combos.reload(); vouchers.reload(); me.reload(); })}>
                      {c.complete ? t("flair.trocar_pelo_cupom") : t("flair.complete_os_requisitos")}
                    </Button>}
                </div>
              </div>
            </Card>))}</div>}
      </>)}

      {tab === "carteira" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-2"><h2 className="type-h3">{t("flair.cupons")}</h2><Link href="/lookbook?tab=cupons" className="btn btn-sm">{t("common.meus_cupons_resgatados")}</Link></div>
            {vouchers.loading ? <Skeleton className="h-32" /> : (vouchers.data ?? []).length === 0 ? <EmptyState title={t("flair.nenhum_cupom_ainda")} hint={t("flair.complete_uma_combinacao_de_loja")} action={<Button size="sm" onClick={() => setTab("lojas")}>{t("flair.ver_combinacoes")}</Button>} /> :
              <ul className="grid gap-2">{vouchers.data!.map((v) => (
                <li key={v.id}><button type="button" className="flair-voucher w-full text-left" style={{ borderColor: v.combination.accentColor }} onClick={() => setVoucher(v)}>
                  <div className="min-w-0 flex-1"><p className="type-caption text-muted">{v.combination.brandName} · {v.combination.name}</p><p className="type-body font-semibold">{v.combination.coupon}</p><p className="type-caption">{couponText(v.combination)}</p></div>
                  <div className="text-right"><code className="flair-code">{v.code}</code><p className="type-caption mt-1"><Badge tone={v.status === "EMITIDO" ? "thread" : v.status === "USADO" ? "chalk" : "mark"}>{v.status}</Badge></p></div>
                </button></li>))}</ul>}
          </Card>
          <Card>
            <h2 className="type-h3 mb-1">{t("flair.skins_de_carta")}</h2>
            <p className="type-caption text-muted mb-2">{t("flair.coins_so_compram_itens_cosmeticos", { ethics: m?.ethics })}</p>
            {m && Object.entries(m.skinShop).map(([s, price]) => {
              const owned = m.skins.includes(s); const active = m.activeSkin === s;
              return <div key={s} className="mb-2 flex items-center justify-between gap-2"><span className="type-body-sm">{SKIN_LABEL[s] ?? s}</span>
                <Button size="sm" variant={active ? "default" : "primary"} disabled={active || (!owned && m.coins < price)} loading={busy === s}
                  onClick={() => run(s, () => api.post<Me>(`/api/flair/skins/${s}`), (r) => me.setData(r))}>{active ? t("flair.ativa") : owned ? t("flair.usar") : t("flair.coins", { price })}</Button></div>;
            })}
            <h3 className="label mt-3">{t("common.extrato")}</h3>
            <ul className="grid gap-0.5">{(m?.ledger ?? []).slice(0, 12).map((e, i) => <li key={i} className="flex justify-between type-caption"><span className="truncate">{e.reason.replace(/_/g, " ").toLowerCase()}</span><b className={`tabular ${e.delta < 0 ? "text-mark" : ""}`}>{e.delta > 0 ? "+" : ""}{e.delta}</b></li>)}</ul>
            <h3 className="label mt-3">{t("flair.partidas_recentes")}</h3>
            <ul className="grid gap-0.5">{(m?.recent ?? []).map((e) => <li key={e.matchId} className="flex justify-between gap-2 type-caption"><span className="truncate">{MODE_LABEL[e.mode] ?? e.mode} · {e.theme ? label(e.theme.replace(/^@/, "@")) : ""}</span>{e.outcome ? <Badge tone={OUTCOME[e.outcome]?.tone}>{OUTCOME[e.outcome]?.label}</Badge> : <span className="tabular">{e.score}</span>}</li>)}</ul>
          </Card>
        </div>
      )}

      {tab === "quests" && (quests.loading ? <Skeleton className="h-48" /> : <div className="grid gap-3 md:grid-cols-2">{(quests.data ?? []).map((q) => (
        <Card key={q.code}>
          <div className="flex items-start justify-between gap-2"><div><Badge tone={q.period === "DAY" ? "thread" : "chalk"}>{q.period === "DAY" ? t("flair.diaria") : t("flair.semanal")}</Badge><p className="type-h3 mt-1">{q.label}</p><p className="type-body-sm text-muted">{q.rule}</p></div><b className="tabular">{t("flair.coins_3", { coins: q.coins })}</b></div>
          <div className="hype-bar mt-2"><i style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%`, background: q.done ? "var(--thread)" : "var(--mark)" }} /></div>
          <p className="type-caption tabular">{Math.round(q.progress)}/{q.target}</p>
          <Button size="sm" className="mt-2" variant="primary" disabled={!q.done || q.claimed} loading={busy === q.code}
            onClick={() => run(q.code, () => api.post<Me>(`/api/flair/quests/${q.code}/claim`), (r) => { me.setData(r); quests.reload(); })}>{q.claimed ? t("flair.resgatada") : q.done ? t("common.resgatar") : t("flair.em_andamento")}</Button>
        </Card>))}</div>)}

      <Dialog open={!!duel} onClose={() => setDuel(null)} size="xl" title={duel ? `${MODE_LABEL[duel.mode] ?? t("flair.duelo")} · ${duel.opponent.label}` : ""}
        footer={<Button variant="primary" onClick={() => setDuel(null)}>{t("common.close")}</Button>}>
        {duel && <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="surface p-3"><p className="type-caption text-muted">{t("flair.voce")}</p><DeckSummary deck={duel.me} compact /><div className="mt-2 flex gap-2 overflow-x-auto">{duel.me.cards.map((c) => <FlairCardView key={c.id} card={c} size="sm" skin={skin} />)}</div></div>
            <div className="surface p-3"><p className="type-caption text-muted">{duel.opponent.label}</p><DeckSummary deck={duel.opponent.deck} compact /><div className="mt-2 flex gap-2 overflow-x-auto">{duel.opponent.deck.cards.map((c) => <FlairCardView key={c.id} card={c} size="sm" />)}</div></div>
          </div>
          <Rounds rounds={duel.rounds} a={t("flair.voce")} b={duel.opponent.label} />
          <div className="flair-result"><Badge tone={OUTCOME[duel.outcome].tone}>{OUTCOME[duel.outcome].label}</Badge><b className="tabular">{duel.score.me} × {duel.score.opponent}</b>
            <span className="type-caption">{duel.rewardCapReached ? t("flair.teto_diario_de_duelos_premiados") : t("common.coins", { coins: duel.coins })}</span></div>
        </div>}
      </Dialog>

      <Dialog open={!!battle} onClose={() => setBattle(null)} size="xl" title={battle ? `${battle.teamA.name} × ${battle.teamB.name}` : ""} footer={<Button variant="primary" onClick={() => setBattle(null)}>{t("common.close")}</Button>}>
        {battle && <div className="grid gap-3">
          {battle.duels.map((d) => (
            <div key={d.slot} className="surface p-3">
              <p className="type-caption text-muted">{t("flair.par", { slot: d.slot })}</p>
              <div className="flex flex-wrap items-center justify-between gap-2 type-body-sm">
                <span className={d.winner === "A" ? "font-semibold" : ""}>{d.a ? `@${d.a.user.username} · ${d.a.deck} (${d.a.power})` : t("flair.sem_deck")}</span><span className="type-caption">×</span>
                <span className={d.winner === "B" ? "font-semibold" : ""}>{d.b ? `@${d.b.user.username} · ${d.b.deck} (${d.b.power})` : t("flair.sem_deck")}</span>
              </div>
              {d.rounds.length > 0 && <p className="type-caption mt-1">{d.rounds.map((r) => `${r.stat} ${r.winner === "DRAW" ? "=" : r.winner === "A" ? "◀" : "▶"}`).join(" · ")}</p>}
            </div>))}
          <div className="flair-result"><Badge tone={battle.winner === "A" ? "thread" : battle.winner === "B" ? "mark" : "chalk"}>{battle.winner === "A" ? t("flair.vitoria_da_sua_equipe") : battle.winner === "B" ? t("flair.vitoria_da_equipe_rival") : t("common.empate")}</Badge><b className="tabular">{battle.score.a} × {battle.score.b}</b><span className="type-caption">{t("flair.vitoria_3_pontos_na_liga")}</span></div>
        </div>}
      </Dialog>

      <VoucherDialog voucher={voucher} onClose={() => setVoucher(null)} />
    </>
  );
}


export default function FlairPage() { return <RequireAuth><Suspense><FlairInner /></Suspense></RequireAuth>; }
