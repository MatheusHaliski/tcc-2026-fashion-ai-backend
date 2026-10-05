"use client";
import { useEffect, useMemo, useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import type { UserCard } from "@/lib/api/types";
import { Avatar, Badge, Button, Card, cn, ErrorState, Field, Input, Select, Skeleton, useToast } from "@/components/ui";
import { FlairCardView, type FlairCard } from "@/components/flair/flair-card";
import { LookPicker, LookTile, OpponentField, PlayButton, ResultView, STAT_LABEL, ThemeBadge, type ModeLook, type ModeResult, type Theme } from "@/components/flair/modes-shared";
import { tr, trRich, useI18n } from "@/lib/i18n/i18n";
import { currentIntl } from "@/lib/i18n/state";

interface Mode { code: string; name: string; emoji: string; group: "NUCLEO" | "ESPECIAL"; summary: string; how: string; }
interface Square { index: number; city: string; title: string; emoji: string; type: string; theme: string; target: number; reward: number; rule: string; }
interface Territory { map: string; code: string; name: string; emoji: string; style: string; theme: string; bonus: string; }
interface Boss { code: string; name: string; emoji: string; theme: string; stats: Record<string, number>; lesson: string; }
interface Catalog { architecture: string[]; modes: Mode[]; themes: Theme[]; bosses: Boss[]; board: Square[]; territories: Territory[]; chessBoard: string[]; roles: string[]; ethics: string; divisions: { from: number; code: string; label: string }[]; }

/** Hook comum: executa a jogada, mostra o erro e guarda o resultado. */
function usePlay() {
  const toast = useToast(); const [busy, setBusy] = useState(false); const [result, setResult] = useState<ModeResult | null>(null);
  async function play<T = ModeResult>(fn: () => Promise<T>, keep = true): Promise<T | null> {
    setBusy(true);
    try { const r = await fn(); if (keep) setResult(r as unknown as ModeResult); return r; } catch (e) { toast.fromError(e); return null; } finally { setBusy(false); }
  }
  return { busy, result, setResult, play };
}

/**
 * Modos do FLAIR: o guarda-roupa é a coleção de cartas, os looks são as unidades de combate e vários looks formam um
 * time/deck. Núcleo (6) + eventos especiais (9), todos sobre o mesmo banco de atributos do Fashion AI.
 */
export function FlairModes({ initial }: { initial?: string | null }) {
  const { t } = useI18n();
  const catalog = useApi<Catalog>((signal) => api.get("/api/flair/modes", { signal }), []);
  const looks = useApi<{ looks: ModeLook[] }>((signal) => api.get("/api/flair/modes/looks", { signal }), []);
  const trophies = useApi<{ id: string; title: string; mode: string }[]>((signal) => api.get("/api/flair/modes/trophies", { signal }), []);
  const [mode, setMode] = useState<string | null>(initial ?? null);
  if (catalog.error) return <ErrorState error={catalog.error} onRetry={catalog.reload} />;
  if (catalog.loading || !catalog.data) return <Skeleton className="h-64" />;
  const c = catalog.data; const my = looks.data?.looks ?? [];
  const current = c.modes.find((m) => m.code === mode);
  const props = { looks: my, catalog: c, onDone: () => trophies.reload() };
  return (
    <div className="grid gap-4">
      <div className="mode-arch" aria-label={t("flair.modes.arquitetura_do_flair")}>{c.architecture.map((x, i) => <span key={x}>{i > 0 && <em aria-hidden>→</em>}<b>{x}</b></span>)}</div>
      {(trophies.data?.length ?? 0) > 0 && <div className="flex flex-wrap gap-1.5" aria-label={t("flair.modes.trofeus_flair")}>{trophies.data!.slice(0, 8).map((t) => <span key={t.id} className="mode-trophy">🏆 {t.title}</span>)}</div>}
      {!current && <>
        <section><h2 className="type-h3 mb-2">{t("flair.modes.nucleo_do_flair")}</h2><div className="mode-grid">{c.modes.filter((m) => m.group === "NUCLEO").map((m) => <ModeCard key={m.code} m={m} onOpen={() => setMode(m.code)} />)}</div></section>
        <section><h2 className="type-h3 mb-2">{t("flair.modes.eventos_e_modos_especiais")}</h2><div className="mode-grid">{c.modes.filter((m) => m.group === "ESPECIAL").map((m) => <ModeCard key={m.code} m={m} onOpen={() => setMode(m.code)} />)}</div></section>
        <p className="type-caption text-muted">{t("hypeFlair.modes_nota", { ethics: c.ethics })}</p>
      </>}
      {current && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center gap-2"><Button size="sm" onClick={() => setMode(null)}>{t("flair.modes.modos")}</Button><h2 className="type-h2">{current.emoji} {current.name}</h2><Badge tone={current.group === "NUCLEO" ? "thread" : "chalk"}>{current.group === "NUCLEO" ? t("flair.modes.nucleo") : t("flair.modes.especial")}</Badge></div>
          <p className="type-body-sm text-muted mb-3">{current.how}</p>
          {current.code === "BATTLE" && <BattlePanel {...props} />}
          {current.code === "SQUAD" && <SquadPanel {...props} />}
          {current.code === "LEAGUE" && <LeaguePanel {...props} />}
          {current.code === "TOUR" && <TourPanel {...props} />}
          {(current.code === "CONQUEST" || current.code === "MONOPOLY") && <TerritoryPanel map={current.code} {...props} />}
          {current.code === "DECK" && <DeckPanel {...props} />}
          {current.code === "WARDROBE" && <WardrobePanel {...props} />}
          {current.code === "RUNWAY" && <RunwayPanel {...props} />}
          {current.code === "DRAFT" && <DraftPanel {...props} />}
          {current.code === "TAG_TEAM" && <TagPanel {...props} />}
          {current.code === "BOSS" && <BossPanel {...props} />}
          {current.code === "COMBO" && <ComboPanel {...props} />}
          {current.code === "CHESS" && <ChessPanel {...props} />}
          {current.code === "ULTIMATE" && <UltimatePanel {...props} />}
        </Card>
      )}
    </div>
  );
}

function ModeCard({ m, onOpen }: { m: Mode; onOpen: () => void }) {
  return <button type="button" className="mode-card text-left" onClick={onOpen}><span className="mode-card-emoji" aria-hidden>{m.emoji}</span><p className="type-h3">{m.name}</p><p className="type-body-sm text-muted">{m.summary}</p></button>;
}

type PanelProps = { looks: ModeLook[]; catalog: Catalog; onDone: () => void };

// ------------------------------------------------------------------ 1. Battle of Looks
function BattlePanel({ looks, catalog, onDone }: PanelProps) {
  const { t } = useI18n();
  const [pick, setPick] = useState<string[]>([]); const [opp, setOpp] = useState("CASA"); const [theme, setTheme] = useState("");
  const { busy, result, play } = usePlay();
  const r = result as (ModeResult & { me?: ModeLook; opponent?: { label: string; look: ModeLook } }) | null;
  return (
    <div className="grid gap-3">
      <LookPicker looks={looks} value={pick} onChange={setPick} />
      <OpponentField value={opp} onChange={setOpp} />
      <Field label={t("settings.theme")} id="b-theme"><Select id="b-theme" value={theme} onChange={(e) => setTheme(e.target.value)}><option value="">{t("flair.modes.sortear_tema")}</option>{catalog.themes.map((t) => <option key={t.code} value={t.code}>{t.emoji} {t.label}</option>)}</Select></Field>
      <div><PlayButton busy={busy} disabled={!pick[0]} onClick={() => play(() => api.post("/api/flair/modes/battle", { schemeId: pick[0], opponent: opp || "CASA", theme: theme || null })).then(onDone)}>{t("flair.modes.batalhar")}</PlayButton></div>
      {r && <div className="grid gap-3 md:grid-cols-2">{r.me && <LookTile look={r.me} />}{r.opponent?.look && <LookTile look={r.opponent.look} />}</div>}
      <ResultView result={result} />
    </div>
  );
}

// ------------------------------------------------------------------ 2. Squad 5×5
function SquadPanel({ looks, onDone }: PanelProps) {
  const { t } = useI18n();
  const [pick, setPick] = useState<string[]>([]); const [opp, setOpp] = useState("CASA");
  const { busy, result, play } = usePlay();
  return (
    <div className="grid gap-3">
      <LookPicker looks={looks} value={pick} onChange={setPick} max={5} label={t("flair.modes.seu_fashion_squad_vazio_o")} />
      <OpponentField value={opp} onChange={setOpp} />
      <div><PlayButton busy={busy} onClick={() => play(() => api.post("/api/flair/modes/squad", { schemeIds: pick, opponent: opp || "CASA" })).then(onDone)}>{t("flair.modes.jogar_5_5")}</PlayButton></div>
      <p className="type-caption text-muted">{t("flair.modes.rodadas_date_night_business_meeting")}</p>
      <ResultView result={result} />
    </div>
  );
}

// ------------------------------------------------------------------ 3. Fashion League
/** Linha da tabela da liga. `stylePoints` = soma das notas das rodadas (não é HypeScore); `hype` é o alias antigo, deprecado. */
export interface LeagueRow { position: number; user: UserCard; played: number; wins: number; draws: number; losses: number; points: number; stylePoints?: number; /** @deprecated use stylePoints */ hype?: number; division: { label: string }; you: boolean; }

/** Tabela da Fashion League: a última coluna numérica é "Pontos de estilo" (antes rotulada "Hype", só homônima). */
export function LeagueTable({ rows }: { rows: LeagueRow[] }) {
  const { t } = useI18n();
  return (
    <div className="overflow-x-auto"><table className="mode-table"><thead><tr><th>#</th><th>{t("flair.modes.jogador")}</th><th>J</th><th>V</th><th>E</th><th>D</th><th>{t("common.pts")}</th><th title={t("hypeFlair.pontos_de_estilo_hint")}>{t("hypeFlair.pontos_de_estilo")}</th><th>{t("flair.modes.divisao")}</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.user.id} className={r.you ? "font-semibold" : ""}><td>{r.position}</td><td><span className="flex items-center gap-1"><Avatar src={r.user.avatarUrl} name={r.user.displayName} size={20} />@{r.user.username}</span></td><td>{r.played}</td><td>{r.wins}</td><td>{r.draws}</td><td>{r.losses}</td><td><b>{r.points}</b></td><td>{(r.stylePoints ?? r.hype ?? 0).toLocaleString(currentIntl())}</td><td>{r.division.label}</td></tr>)}
        {rows.length === 0 && <tr><td colSpan={9} className="text-muted">{t("flair.modes.ninguem_escalou_o_elenco_nesta")}</td></tr>}</tbody></table></div>
  );
}
function LeaguePanel({ looks, onDone }: PanelProps) {
  const { rich, t } = useI18n();
  const toast = useToast();
  const league = useApi<{ season: string; table: LeagueRow[]; roster: { starters?: string[]; reserves?: string[]; specials?: string[] }; division: { label: string }; rule: string }>((signal) => api.get("/api/flair/modes/league", { signal }), []);
  const cards = useApi<{ cards: FlairCard[] }>((signal) => api.get("/api/flair/cards", { signal }), []);
  const [starters, setStarters] = useState<string[]>([]); const [reserves, setReserves] = useState<string[]>([]); const [specials, setSpecials] = useState<string[]>([]);
  const { busy, result, play } = usePlay();
  useEffect(() => { const r = league.data?.roster; if (r) { setStarters(r.starters ?? []); setReserves(r.reserves ?? []); setSpecials(r.specials ?? []); } }, [league.data]);
  if (league.loading || !league.data) return <Skeleton className="h-48" />;
  const d = league.data;
  async function save() { try { league.setData(await api.put("/api/flair/modes/league/roster", { starters, reserves, specials })); toast.success(t("flair.modes.elenco_salvo")); } catch (e) { toast.fromError(e); } }
  return (
    <div className="grid gap-4">
      <p className="type-body-sm">{rich("flair.modes.temporada_sua_divisao", { season: d.season }, { 0: ($c) => <b>{$c}</b> })}{" "}<Badge tone="thread">{d.division.label}</Badge></p>
      <p className="type-caption text-muted">{d.rule}</p>
      <LeagueTable rows={d.table} />
      <LookPicker looks={looks} value={starters} onChange={(v) => { setStarters(v); setReserves(reserves.filter((x) => !v.includes(x))); }} max={5} label={t("flair.modes.titulares")} />
      <LookPicker looks={looks.filter((l) => !starters.includes(l.schemeId ?? ""))} value={reserves} onChange={setReserves} max={3} label={t("flair.modes.reservas")} />
      <div><p className="label">{t("flair.modes.pecas_especiais_5_3_na", { specialsCount: specials.length })}</p>
        <div className="flex gap-2 overflow-x-auto pb-1">{(cards.data?.cards ?? []).map((c) => <FlairCardView key={c.id} card={c} size="sm" selected={specials.includes(c.id)} onClick={() => setSpecials(specials.includes(c.id) ? specials.filter((x) => x !== c.id) : specials.length >= 5 ? specials : [...specials, c.id])} />)}</div></div>
      <div className="flex flex-wrap gap-2"><Button onClick={save} disabled={starters.length === 0}>{t("flair.modes.salvar_elenco")}</Button><PlayButton busy={busy} disabled={!d.roster.starters?.length} onClick={() => play(() => api.post("/api/flair/modes/league/play")).then(() => { league.reload(); onDone(); })}>{t("flair.modes.jogar_rodada")}</PlayButton></div>
      <ResultView result={result} />
    </div>
  );
}

// ------------------------------------------------------------------ 4. Fashion World Tour
interface TourState { board: Square[]; cities: string[]; position: number; lap: number; points: number; pending?: number | null; lastRoll?: number; log: { text: string }[]; rollsLeft: number; rule: string; }
function TourPanel({ looks, onDone }: PanelProps) {
  const toast = useToast();
  const tour = useApi<TourState>((signal) => api.get("/api/flair/modes/tour", { signal }), []);
  const [pick, setPick] = useState<string[]>([]); const [rolling, setRolling] = useState(false);
  const { busy, result, play } = usePlay();
  if (tour.loading || !tour.data) return <Skeleton className="h-48" />;
  const t = tour.data; const pending = t.pending != null ? t.board[t.pending] : null;
  async function roll() { setRolling(true); try { tour.setData(await api.post<TourState>("/api/flair/modes/tour/roll")); } catch (e) { toast.fromError(e); } finally { setRolling(false); } }
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3"><Badge tone="thread">{tr("flair.modes.pontos", { points: t.points })}</Badge><Badge>{tr("flair.modes.volta", { lap: t.lap })}</Badge>{t.lastRoll && <span className="mode-dice" aria-label={tr("flair.modes.dado", { lastRoll: t.lastRoll })}>{"⚀⚁⚂⚃⚄⚅"[t.lastRoll - 1]}</span>}<span className="type-caption text-muted">{tr("flair.modes.rolagens_hoje", { rollsLeft: t.rollsLeft })}</span></div>
      <div className="mode-board" role="list" aria-label={tr("flair.modes.tabuleiro_paris_sao_paulo")}>{t.cities.map((city) => (
        <div key={city} className="mode-city" role="listitem"><p className="mode-city-name">{city}</p>
          <div className="mode-squares">{t.board.filter((s) => s.city === city).map((s) => <div key={s.index} className={cn("mode-square", `mode-square-${s.type.toLowerCase()}`, s.index === t.position && "mode-square-here")} title={`${s.title} — ${s.rule}`}><span aria-hidden>{s.emoji}</span><small>{s.title}</small>{s.index === t.position && <b className="mode-pawn" aria-label={tr("flair.modes.voce_esta_aqui")}>●</b>}</div>)}</div></div>))}</div>
      {pending ? <div className="surface p-3"><p className="type-body">{trRich("flair.modes.alvo_vale", { emoji: pending.emoji, title: pending.title, rule: pending.rule, target: pending.target, reward: pending.reward }, { 0: ($c) => <b>{$c}</b> })}</p><LookPicker looks={looks} value={pick} onChange={setPick} /><div className="mt-2"><PlayButton busy={busy} disabled={!pick[0]} onClick={() => play(async () => { const r = await api.post<ModeResult & { tour: TourState }>("/api/flair/modes/tour/resolve", { schemeId: pick[0] }); tour.setData(r.tour); onDone(); return r; })}>{tr("flair.modes.cumprir_o_desafio")}</PlayButton></div></div>
        : <div><Button variant="primary" loading={rolling} disabled={t.rollsLeft === 0} onClick={roll}>{tr("flair.modes.rolar_o_dado")}</Button></div>}
      <ResultView result={result} labelB={tr("flair.modes.nota_alvo")} />
      <ul className="fai-list type-caption">{t.log.slice(0, 8).map((l, i) => <li key={i}>{l.text}</li>)}</ul>
      <p className="type-caption text-muted">{t.rule}</p>
    </div>
  );
}

// ------------------------------------------------------------------ 5/7. Conquest e Monopoly
interface TerritoryView { territory: Territory; theme: Theme; owner?: UserCard | null; mine: boolean; defenders: { title: string; rating: number }[]; defenses: number; }
function TerritoryPanel({ map, looks, onDone }: PanelProps & { map: string }) {
  const { t } = useI18n();
  const data = useApi<{ territories: TerritoryView[]; rule: string; mine: number }>((signal) => api.get(`/api/flair/modes/territories?map=${map}`, { signal }), [map]);
  const [target, setTarget] = useState<string | null>(null); const [pick, setPick] = useState<string[]>([]);
  const { busy, result, play } = usePlay();
  const need = map === "CONQUEST" ? 3 : 1;
  if (data.loading || !data.data) return <Skeleton className="h-48" />;
  return (
    <div className="grid gap-3">
      <p className="type-caption text-muted">{t("flair.modes.voce_domina", { rule: data.data.rule, mine: data.data.mine })}</p>
      <div className="mode-territories">{data.data.territories.map((t) => (
        <button key={t.territory.code} type="button" className={cn("mode-territory", t.mine && "mode-territory-mine", target === t.territory.code && "mode-territory-on")} onClick={() => setTarget(t.territory.code)} disabled={t.mine}>
          <span className="text-2xl" aria-hidden>{t.territory.emoji}</span><b>{t.territory.name}</b>
          <small>{t.owner ? `@${t.owner.username}` : tr("flair.modes.livre_casa_defende")}{t.mine ? tr("flair.modes.seu") : ""}</small>
          <small className="text-muted">{t.theme.emoji} {t.theme.label} · {t.territory.bonus}</small>
          {t.defenders.length > 0 && <small>{tr("flair.modes.defensores")}{" "}{t.defenders.map((d) => d.title).join(", ")}</small>}
        </button>))}</div>
      {target && <><LookPicker looks={looks} value={pick} onChange={setPick} max={need} label={map === "CONQUEST" ? t("flair.modes.n3_looks_de_ataque") : t("flair.modes.look_de_ataque")} />
        <div><PlayButton busy={busy} disabled={pick.length !== need} onClick={() => play(() => api.post(`/api/flair/modes/territories/${map}/${target}/attack`, { schemeIds: pick })).then(() => { data.reload(); onDone(); })}>{map === "CONQUEST" ? t("flair.modes.conquistar_regiao") : t("flair.modes.tomar_o_distrito")}</PlayButton></div></>}
      {result && (result as ModeResult & { captured?: boolean }).captured && <p className="mode-banner">🎉 {map === "CONQUEST" ? t("flair.modes.seu_lookbook_conquistou_a_regiao") : t("flair.modes.o_distrito_agora_e_seu")}</p>}
      <ResultView result={result} labelB={t("flair.modes.defensor")} />
    </div>
  );
}

// ------------------------------------------------------------------ 6. Deck Battle
function DeckPanel({ onDone }: PanelProps) {
  const { rich, t } = useI18n();
  const toast = useToast();
  const deck = useApi<{ cards: FlairCard[]; valid: boolean; suggestion: string[] }>((signal) => api.get("/api/flair/modes/deck", { signal }), []);
  const all = useApi<{ cards: FlairCard[] }>((signal) => api.get("/api/flair/cards", { signal }), []);
  const [sel, setSel] = useState<string[]>([]); const [game, setGame] = useState<{ id: string; challenge: Theme; hand: FlairCard[]; hint: string[] } | null>(null); const [hand, setHand] = useState<string[]>([]);
  const { busy, result, setResult, play } = usePlay();
  useEffect(() => { if (deck.data) setSel(deck.data.cards.map((c) => c.id)); }, [deck.data]);
  const byCat = (cat: string) => (all.data?.cards ?? []).filter((c) => sel.includes(c.id) && (c.category === cat || (cat === "upper_piece" && c.category === "full_body_piece"))).length;
  async function save(ids: string[]) { try { deck.setData(await api.put("/api/flair/modes/deck", { pieceIds: ids })); toast.success(t("flair.modes.deck_salvo")); } catch (e) { toast.fromError(e); } }
  return (
    <div className="grid gap-3">
      <p className="type-body-sm">{rich("flair.modes.deck_12_superiores_4_inferiores", { selCount: sel.length, byCat: byCat("upper_piece"), byCat2: byCat("lower_piece"), byCat3: byCat("shoes_piece"), byCat4: byCat("accessory_piece") }, { 0: ($c) => <b>{$c}</b> })}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">{(all.data?.cards ?? []).map((c) => <FlairCardView key={c.id} card={c} size="sm" selected={sel.includes(c.id)} onClick={() => setSel(sel.includes(c.id) ? sel.filter((x) => x !== c.id) : sel.length >= 12 ? sel : [...sel, c.id])} />)}</div>
      <div className="flex flex-wrap gap-2"><Button onClick={() => deck.data && setSel(deck.data.suggestion)}>{t("flair.modes.usar_sugestao")}</Button><Button onClick={() => save(sel)} disabled={sel.length !== 12}>{t("flair.modes.salvar_deck")}</Button>
        <PlayButton busy={busy} disabled={!deck.data?.valid} onClick={async () => { setResult(null); const g = await play(() => api.post<{ id: string; challenge: Theme; hand: FlairCard[]; hint: string[] }>("/api/flair/modes/deck/battle"), false); if (g) { setGame(g); setHand([]); } }}>{t("flair.modes.nova_partida")}</PlayButton></div>
      {game && !result && <div className="surface p-3">
        <p className="type-body">{t("flair.modes.desafio")}{" "}<ThemeBadge theme={game.challenge} />{" "}{t("flair.modes.monte_o_melhor_look_com")}</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{game.hand.map((c) => <FlairCardView key={c.id} card={c} size="sm" selected={hand.includes(c.id)} onClick={() => setHand(hand.includes(c.id) ? hand.filter((x) => x !== c.id) : hand.length >= 5 ? hand : [...hand, c.id])} />)}</div>
        <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => setHand(game.hint)}>{t("flair.modes.dica_da_ia")}</Button><PlayButton busy={busy} disabled={hand.length < 2} onClick={() => play(() => api.post(`/api/flair/modes/deck/battle/${game.id}/play`, { pieceIds: hand })).then(onDone)}>{t("flair.modes.jogar_look")}</PlayButton></div>
      </div>}
      <ResultView result={result} labelB={t("flair.modes.a_casa")} />
    </div>
  );
}

// ------------------------------------------------------------------ Wardrobe Wars
function WardrobePanel({ onDone }: PanelProps) {
  const { t } = useI18n();
  const [opp, setOpp] = useState(""); const { busy, result, play } = usePlay();
  return (
    <div className="grid gap-3">
      <OpponentField value={opp} onChange={setOpp} allowHouse={false} label={t("flair.modes.guarda_roupa_adversario")} />
      <div><PlayButton busy={busy} disabled={!opp.trim()} onClick={() => play(() => api.post("/api/flair/modes/wardrobe-wars", { opponent: opp })).then(onDone)}>{t("flair.modes.guarda_roupa_guarda_roupa")}</PlayButton></div>
      <p className="type-caption text-muted">{t("flair.modes.do_oponente_contam_so_pecas")}</p>
      <ResultView result={result} />
    </div>
  );
}

// ------------------------------------------------------------------ Runway
interface RunwayStage { stage: string; results: { title?: string; owner?: string; score?: number; you?: boolean; advanced?: boolean; a?: string; b?: string; scoreA?: number; scoreB?: number; winner?: string }[]; }
function RunwayPanel({ looks, onDone }: PanelProps) {
  const { rich, t } = useI18n();
  const info = useApi<{ theme: Theme; week: string; season: string; rule: string; entry?: { place: string; card?: string; stages: RunwayStage[] } | null }>((signal) => api.get("/api/flair/modes/runway", { signal }), []);
  const [pick, setPick] = useState<string[]>([]); const { busy, result, play } = usePlay();
  if (info.loading || !info.data) return <Skeleton className="h-40" />;
  const r = result as (ModeResult & { stages?: RunwayStage[]; place?: string; card?: string }) | null;
  const stages = r?.stages ?? info.data.entry?.stages ?? []; const card = r?.card ?? info.data.entry?.card; const place = r?.place ?? info.data.entry?.place;
  return (
    <div className="grid gap-3">
      <p className="type-body">{t("flair.modes.tema_da_semana")}{" "}<ThemeBadge theme={info.data.theme} />{" "}{t("flair.modes.season", { season: info.data.season })}</p>
      <p className="type-caption text-muted">{info.data.rule}</p>
      {!info.data.entry && !r && <><LookPicker looks={looks} value={pick} onChange={setPick} /><div><PlayButton busy={busy} disabled={!pick[0]} onClick={() => play(() => api.post("/api/flair/modes/runway", { schemeId: pick[0] })).then(() => { info.reload(); onDone(); })}>{t("flair.modes.desfilar")}</PlayButton></div></>}
      {place && <p className="mode-banner">{rich("flair.modes.colocacao", { place }, { 0: ($c) => <b>{$c}</b> })}</p>}
      {card && card !== "null" && <div className="mode-trophy-card"><span aria-hidden>🏆</span><b>{card}</b><small>{t("flair.modes.aparece_no_seu_perfil")}</small></div>}
      {stages.map((s) => <div key={s.stage}><p className="label">{s.stage}</p><ul className="fai-list">{s.results.map((x, i) => <li key={i} className={cn("type-body-sm", x.you && "font-semibold")}>{x.title ? `${x.advanced ? "✔" : "·"} ${x.title} (@${x.owner}) — ${x.score}` : `${x.a} ${x.scoreA} × ${x.scoreB} ${x.b} → ${x.winner === "A" ? "◀" : "▶"}`}</li>)}</ul></div>)}
    </div>
  );
}

// ------------------------------------------------------------------ Draft
interface DraftState { id: string; status: string; pool: FlairCard[]; mine: FlairCard[]; theirs: FlairCard[]; pick: number; turn: string; order: string; themes: Theme[]; }
function DraftPanel({ onDone }: PanelProps) {
  const { t } = useI18n();
  const toast = useToast(); const [d, setD] = useState<DraftState | null>(null); const [assign, setAssign] = useState<Record<string, number>>({});
  const { busy, result, setResult, play } = usePlay();
  async function pick(id: string) { if (!d) return; try { setD(await api.post<DraftState>(`/api/flair/modes/draft/${d.id}/pick`, { pieceId: id })); } catch (e) { toast.fromError(e); } }
  const looksOf = (n: number) => Object.entries(assign).filter(([, v]) => v === n).map(([k]) => k);
  return (
    <div className="grid gap-3">
      <div><PlayButton busy={busy} onClick={async () => { setResult(null); setAssign({}); const r = await play(() => api.post<DraftState>("/api/flair/modes/draft"), false); if (r) setD(r); }}>{t("flair.modes.novo_draft")}</PlayButton></div>
      {d && !result && <>
        <p className="type-caption">{t("flair.modes.ordem_escolha_20_temas", { order: d.order, Math: Math.min(d.pick + 1, 20), value: d.turn === "COMPOSE" ? t("flair.modes.monte_seus_3_looks") : d.turn === "A" ? t("flair.modes.sua_vez") : t("flair.modes.vez_da_ia") })}{" "}{d.themes.map((t) => `${t.emoji} ${t.label}`).join(" · ")}</p>
        {d.turn === "A" && <div className="flex flex-wrap gap-2">{d.pool.map((c) => <FlairCardView key={c.id} card={c} size="sm" onClick={() => pick(c.id)} />)}</div>}
        <div className="grid gap-2 md:grid-cols-2"><div><p className="label">{t("flair.modes.suas_escolhas", { mineCount: d.mine.length })}</p><div className="flex flex-wrap gap-1">{d.mine.map((c) => <button key={c.id} type="button" className="chip" aria-pressed={!!assign[c.id]} onClick={() => setAssign({ ...assign, [c.id]: ((assign[c.id] ?? 0) + 1) % 4 })}>{c.name}{assign[c.id] ? t("flair.modes.look", { assign: assign[c.id] }) : ""}</button>)}</div></div>
          <div><p className="label">{t("flair.modes.escolhas_da_ia", { theirsCount: d.theirs.length })}</p><p className="type-caption text-muted">{d.theirs.map((c) => c.name).join(", ")}</p></div></div>
        {d.turn === "COMPOSE" && <><p className="type-caption text-muted">{t("flair.modes.toque_numa_escolha_para_manda")}</p>
          <PlayButton busy={busy} disabled={[1, 2, 3].some((n) => looksOf(n).length < 2)} onClick={() => play(() => api.post(`/api/flair/modes/draft/${d.id}/looks`, { looks: [looksOf(1), looksOf(2), looksOf(3)] })).then(onDone)}>{t("flair.modes.enfrentar_a_ia")}</PlayButton></>}
      </>}
      <ResultView result={result} labelB={t("flair.modes.ia_do_draft")} />
    </div>
  );
}

// ------------------------------------------------------------------ Tag Team
function TagPanel({ looks, onDone }: PanelProps) {
  const { rich, t } = useI18n();
  const [pick, setPick] = useState<string[]>([]); const [partner, setPartner] = useState(""); const [o1, setO1] = useState(""); const [o2, setO2] = useState("");
  const { busy, result, play } = usePlay();
  const r = result as (ModeResult & { teamA?: { harmony: number }; teamB?: { harmony: number } }) | null;
  return (
    <div className="grid gap-3">
      <LookPicker looks={looks} value={pick} onChange={setPick} />
      <div className="grid gap-2 sm:grid-cols-3"><Field label={t("flair.modes.sua_dupla_usuario")} id="tt-p"><Input id="tt-p" value={partner} onChange={(e) => setPartner(e.target.value)} /></Field><Field label={t("flair.modes.adversario_1_opcional")} id="tt-1"><Input id="tt-1" value={o1} onChange={(e) => setO1(e.target.value)} /></Field><Field label={t("flair.modes.adversario_2_opcional")} id="tt-2"><Input id="tt-2" value={o2} onChange={(e) => setO2(e.target.value)} /></Field></div>
      <div><PlayButton busy={busy} disabled={!pick[0] || !partner.trim()} onClick={() => play(() => api.post("/api/flair/modes/tag-team", { schemeId: pick[0], partner, opponents: o1 && o2 ? [o1, o2] : [] })).then(onDone)}>{t("flair.modes.jogar_em_dupla")}</PlayButton></div>
      {r?.teamA && <p className="type-body-sm">{rich("flair.modes.team_harmony", { harmony: r.teamA.harmony, harmony2: r.teamB?.harmony }, { 0: ($c) => <b>{$c}</b> })}</p>}
      <ResultView result={result} labelA={t("flair.modes.sua_dupla")} labelB={t("flair.modes.dupla_adversaria")} />
    </div>
  );
}

// ------------------------------------------------------------------ Boss
function BossPanel({ looks, catalog, onDone }: PanelProps) {
  const { t } = useI18n();
  const [boss, setBoss] = useState<string | null>(null); const [pick, setPick] = useState<string[]>([]); const { busy, result, play } = usePlay();
  const b = catalog.bosses.find((x) => x.code === boss);
  return (
    <div className="grid gap-3">
      <div className="mode-grid">{catalog.bosses.map((x) => <button key={x.code} type="button" className={cn("mode-card text-left", boss === x.code && "mode-card-on")} onClick={() => setBoss(x.code)}><span className="mode-card-emoji">{x.emoji}</span><p className="type-h3">{x.name}</p><p className="type-caption">{Object.entries(x.stats).map(([k, v]) => `${STAT_LABEL[k]} ${v}`).join(" · ")}</p></button>)}</div>
      {b && <><p className="mode-banner">💡 {b.lesson}</p><LookPicker looks={looks} value={pick} onChange={setPick} max={3} label={t("flair.modes.n1_a_3_looks_contra")} />
        <div><PlayButton busy={busy} disabled={pick.length === 0} onClick={() => play(() => api.post(`/api/flair/modes/bosses/${b.code}`, { schemeIds: pick })).then(onDone)}>{t("flair.modes.enfrentar", { name: b.name })}</PlayButton></div></>}
      <ResultView result={result} labelB={b?.name} />
    </div>
  );
}

// ------------------------------------------------------------------ Combo Battle
function ComboPanel({ looks, onDone }: PanelProps) {
  const { t } = useI18n();
  const [pick, setPick] = useState<string[]>([]); const [opp, setOpp] = useState("CASA"); const { busy, result, play } = usePlay();
  const book = (result as (ModeResult & { comboBook?: string[] }) | null)?.comboBook;
  return (
    <div className="grid gap-3">
      <LookPicker looks={looks} value={pick} onChange={setPick} />
      <OpponentField value={opp} onChange={setOpp} />
      <div><PlayButton busy={busy} disabled={!pick[0]} onClick={() => play(() => api.post("/api/flair/modes/combo", { schemeId: pick[0], opponent: opp || "CASA" })).then(onDone)}>{t("flair.modes.combo_battle")}</PlayButton></div>
      <ResultView result={result} />
      <ul className="fai-list type-caption">{(book ?? [t("flair.modes.streetwear_combo_tenis_cargo_jeans"), t("flair.modes.classic_formal_blazer_camisa_sapato"), t("flair.modes.monochrome_3_pecas_da_mesma"), t("flair.modes.brand_loyalty_3_da_mesma"), t("flair.modes.mix_match_3_marcas_diferentes"), t("flair.modes.vintage_revival_2_pecas_vintage")]).map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
  );
}

// ------------------------------------------------------------------ Chess
const SLOT_LABEL: Record<string, string> = { get ACCESSORY_L() { return tr("common.acessorio"); }, get TOP() { return tr("flair.modes.top"); }, get ACCESSORY_R() { return tr("common.acessorio"); }, get BOTTOM() { return tr("flair.modes.bottom"); }, get HERO() { return tr("flair.modes.hero_1_25"); }, get OUTERWEAR() { return tr("flair.modes.outerwear"); }, get SHOES_L() { return tr("common.calcado"); }, get SUPPORT() { return tr("flair.modes.support"); }, get SHOES_R() { return tr("common.calcado"); } };
function ChessPanel({ onDone }: PanelProps) {
  const { t } = useI18n();
  const info = useApi<{ slots: string[]; cards: FlairCard[]; suggestion: Record<string, string>; rules: string[] }>((signal) => api.get("/api/flair/modes/chess", { signal }), []);
  const [board, setBoard] = useState<Record<string, string>>({}); const [hand, setHand] = useState<string | null>(null); const { busy, result, play } = usePlay();
  const cards = useMemo(() => Object.fromEntries((info.data?.cards ?? []).map((c) => [c.id, c])), [info.data]);
  if (info.loading || !info.data) return <Skeleton className="h-48" />;
  const r = result as (ModeResult & { me?: { bonuses: string[] }; opponent?: { label: string; board: { bonuses: string[] }; cards: Record<string, string> } }) | null;
  return (
    <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
      <div className="mode-chess" role="grid" aria-label={t("flair.modes.tabuleiro_3_3")}>{info.data.slots.map((s) => (
        <button key={s} type="button" className={cn("mode-cell", s === "HERO" && "mode-cell-hero", s === "SUPPORT" && "mode-cell-support")} onClick={() => { if (hand) { setBoard({ ...Object.fromEntries(Object.entries(board).filter(([, v]) => v !== hand)), [s]: hand }); setHand(null); } else if (board[s]) { const n = { ...board }; delete n[s]; setBoard(n); } }}>
          <small>{SLOT_LABEL[s]}</small>{board[s] && cards[board[s]] ? <><img src={mediaUrl(cards[board[s]].imageUrl)} alt="" /><em>{cards[board[s]].name}</em></> : <span className="text-faint">{t("flair.modes.vazio")}</span>}
        </button>))}</div>
      <div className="grid gap-2">
        <p className="type-caption">{t("flair.modes.toque_numa_carta_e_depois")}</p>
        <div className="flex gap-2 overflow-x-auto pb-1">{info.data.cards.map((c) => <FlairCardView key={c.id} card={c} size="sm" selected={hand === c.id} dim={Object.values(board).includes(c.id)} onClick={() => setHand(c.id)} />)}</div>
        <div className="flex flex-wrap gap-2"><Button onClick={() => setBoard(info.data!.suggestion)}>{t("flair.modes.sugestao")}</Button><PlayButton busy={busy} disabled={Object.keys(board).length < 3} onClick={() => play(() => api.post("/api/flair/modes/chess", { board })).then(onDone)}>{t("flair.modes.jogar_contra_a_ia")}</PlayButton></div>
        <ul className="fai-list type-caption text-muted">{info.data.rules.map((x) => <li key={x}>{x}</li>)}</ul>
        <ResultView result={result} labelB={t("flair.modes.ia_estrategista")} />
        {r?.me && <div className="grid gap-2 md:grid-cols-2"><div><p className="label">{t("flair.modes.seus_bonus")}</p><ul className="fai-list type-caption">{r.me.bonuses.map((x, i) => <li key={i}>{x}</li>)}</ul></div><div><p className="label">{t("flair.modes.bonus_da_ia")}</p><ul className="fai-list type-caption">{r.opponent?.board.bonuses.map((x, i) => <li key={i}>{x}</li>)}</ul></div></div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Ultimate Team
const ROLE_LABEL: Record<string, string> = { ICON: "ICON", TREND: "TREND", SOCIAL: "SOCIAL", CREATIVE: "CREATIVE", CLASSIC: "CLASSIC", get WILD_CARD() { return tr("flair.modes.wild_card"); }, SPECIAL: "SPECIAL" };
function UltimatePanel({ looks, onDone }: PanelProps) {
  const { t } = useI18n();
  const toast = useToast();
  const ut = useApi<{ roles: string[]; roster: Record<string, { look: ModeLook; value: number } | null>; team: Record<string, number>; suggestion: Record<string, string | null>; roleHelp: Record<string, string> }>((signal) => api.get("/api/flair/modes/ultimate", { signal }), []);
  const [roles, setRoles] = useState<Record<string, string>>({}); const [opp, setOpp] = useState("CASA"); const { busy, result, play } = usePlay();
  useEffect(() => { if (ut.data) setRoles(Object.fromEntries(Object.entries(ut.data.roster).filter(([, v]) => v).map(([k, v]) => [k, v!.look.schemeId ?? ""]))); }, [ut.data]);
  if (ut.loading || !ut.data) return <Skeleton className="h-48" />;
  const d = ut.data;
  async function save(r: Record<string, string>) { try { ut.setData(await api.put("/api/flair/modes/ultimate", { roles: r })); toast.success(t("flair.modes.flair_team_salvo")); } catch (e) { toast.fromError(e); } }
  return (
    <div className="grid gap-3">
      <div className="mode-team-rating">{Object.entries(d.team).map(([k, v]) => <div key={k}><small>{k === "rating" ? t("flair.modes.team_rating") : k.charAt(0).toUpperCase() + k.slice(1)}</small><b className="tabular">{v}</b></div>)}</div>
      <div className="grid gap-2 md:grid-cols-2">{d.roles.map((role) => (
        <Field key={role} label={`${ROLE_LABEL[role]} — ${d.roleHelp[role]}`} id={`ut-${role}`}>
          <Select id={`ut-${role}`} value={roles[role] ?? ""} onChange={(e) => setRoles({ ...roles, [role]: e.target.value })}><option value="">—</option>{looks.map((l) => <option key={l.schemeId ?? l.title} value={l.schemeId ?? ""} disabled={Object.entries(roles).some(([k, v]) => k !== role && v === l.schemeId)}>{l.title} · {l.rating}</option>)}</Select>
        </Field>))}</div>
      <div className="flex flex-wrap gap-2"><Button onClick={() => { const s = Object.fromEntries(Object.entries(d.suggestion).filter(([, v]) => v)) as Record<string, string>; setRoles(s); }}>{t("flair.modes.sugestao_por_funcao")}</Button><Button onClick={() => save(roles)}>{t("flair.modes.salvar_flair_team")}</Button></div>
      <OpponentField value={opp} onChange={setOpp} />
      <div><PlayButton busy={busy} onClick={() => play(() => api.post("/api/flair/modes/ultimate/play", { opponent: opp || "CASA" })).then(onDone)}>{t("flair.modes.jogar_funcao_funcao")}</PlayButton></div>
      <ResultView result={result} />
    </div>
  );
}

