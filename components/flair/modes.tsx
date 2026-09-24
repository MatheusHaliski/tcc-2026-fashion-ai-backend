"use client";
import { useEffect, useMemo, useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import type { UserCard } from "@/lib/api/types";
import { Avatar, Badge, Button, Card, cn, ErrorState, Field, Input, Select, Skeleton, useToast } from "@/components/ui";
import { FlairCardView, type FlairCard } from "@/components/flair/flair-card";
import { LookPicker, LookTile, OpponentField, PlayButton, ResultView, STAT_LABEL, ThemeBadge, type ModeLook, type ModeResult, type Theme } from "@/components/flair/modes-shared";

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
      <div className="mode-arch" aria-label="Arquitetura do FLAIR">{c.architecture.map((x, i) => <span key={x}>{i > 0 && <em aria-hidden>→</em>}<b>{x}</b></span>)}</div>
      {(trophies.data?.length ?? 0) > 0 && <div className="flex flex-wrap gap-1.5" aria-label="Troféus FLAIR">{trophies.data!.slice(0, 8).map((t) => <span key={t.id} className="mode-trophy">🏆 {t.title}</span>)}</div>}
      {!current && <>
        <section><h2 className="type-h3 mb-2">Núcleo do FLAIR</h2><div className="mode-grid">{c.modes.filter((m) => m.group === "NUCLEO").map((m) => <ModeCard key={m.code} m={m} onOpen={() => setMode(m.code)} />)}</div></section>
        <section><h2 className="type-h3 mb-2">Eventos e modos especiais</h2><div className="mode-grid">{c.modes.filter((m) => m.group === "ESPECIAL").map((m) => <ModeCard key={m.code} m={m} onOpen={() => setMode(m.code)} />)}</div></section>
        <p className="type-caption text-muted">{c.ethics} O HypeScore é a força-base; tema, ocasião, sinergias, cor, diversidade e as condições da rodada mudam o resultado.</p>
      </>}
      {current && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center gap-2"><Button size="sm" onClick={() => setMode(null)}>← Modos</Button><h2 className="type-h2">{current.emoji} {current.name}</h2><Badge tone={current.group === "NUCLEO" ? "thread" : "chalk"}>{current.group === "NUCLEO" ? "Núcleo" : "Especial"}</Badge></div>
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
  const [pick, setPick] = useState<string[]>([]); const [opp, setOpp] = useState("CASA"); const [theme, setTheme] = useState("");
  const { busy, result, play } = usePlay();
  const r = result as (ModeResult & { me?: ModeLook; opponent?: { label: string; look: ModeLook } }) | null;
  return (
    <div className="grid gap-3">
      <LookPicker looks={looks} value={pick} onChange={setPick} />
      <OpponentField value={opp} onChange={setOpp} />
      <Field label="Tema" id="b-theme"><Select id="b-theme" value={theme} onChange={(e) => setTheme(e.target.value)}><option value="">🎲 Sortear tema</option>{catalog.themes.map((t) => <option key={t.code} value={t.code}>{t.emoji} {t.label}</option>)}</Select></Field>
      <div><PlayButton busy={busy} disabled={!pick[0]} onClick={() => play(() => api.post("/api/flair/modes/battle", { schemeId: pick[0], opponent: opp || "CASA", theme: theme || null })).then(onDone)}>⚔️ Batalhar</PlayButton></div>
      {r && <div className="grid gap-3 md:grid-cols-2">{r.me && <LookTile look={r.me} />}{r.opponent?.look && <LookTile look={r.opponent.look} />}</div>}
      <ResultView result={result} />
    </div>
  );
}

// ------------------------------------------------------------------ 2. Squad 5×5
function SquadPanel({ looks, onDone }: PanelProps) {
  const [pick, setPick] = useState<string[]>([]); const [opp, setOpp] = useState("CASA");
  const { busy, result, play } = usePlay();
  return (
    <div className="grid gap-3">
      <LookPicker looks={looks} value={pick} onChange={setPick} max={5} label="Seu Fashion Squad (vazio = o sistema escala os 5 mais diversos)" />
      <OpponentField value={opp} onChange={setOpp} />
      <div><PlayButton busy={busy} onClick={() => play(() => api.post("/api/flair/modes/squad", { schemeIds: pick, opponent: opp || "CASA" })).then(onDone)}>👥 Jogar 5 × 5</PlayButton></div>
      <p className="type-caption text-muted">Rodadas: 🌙 Date Night · 💼 Business Meeting · 🎪 Music Festival · 🏖️ Beach Club · 🎬 Red Carpet. Cada look joga uma única rodada — o sistema escolhe a melhor escalação.</p>
      <ResultView result={result} />
    </div>
  );
}

// ------------------------------------------------------------------ 3. Fashion League
interface LeagueRow { position: number; user: UserCard; played: number; wins: number; draws: number; losses: number; points: number; hype: number; division: { label: string }; you: boolean; }
function LeaguePanel({ looks, onDone }: PanelProps) {
  const toast = useToast();
  const league = useApi<{ season: string; table: LeagueRow[]; roster: { starters?: string[]; reserves?: string[]; specials?: string[] }; division: { label: string }; rule: string }>((signal) => api.get("/api/flair/modes/league", { signal }), []);
  const cards = useApi<{ cards: FlairCard[] }>((signal) => api.get("/api/flair/cards", { signal }), []);
  const [starters, setStarters] = useState<string[]>([]); const [reserves, setReserves] = useState<string[]>([]); const [specials, setSpecials] = useState<string[]>([]);
  const { busy, result, play } = usePlay();
  useEffect(() => { const r = league.data?.roster; if (r) { setStarters(r.starters ?? []); setReserves(r.reserves ?? []); setSpecials(r.specials ?? []); } }, [league.data]);
  if (league.loading || !league.data) return <Skeleton className="h-48" />;
  const d = league.data;
  async function save() { try { league.setData(await api.put("/api/flair/modes/league/roster", { starters, reserves, specials })); toast.success("Elenco salvo."); } catch (e) { toast.fromError(e); } }
  return (
    <div className="grid gap-4">
      <p className="type-body-sm">Temporada <b>{d.season}</b> · sua divisão: <Badge tone="thread">{d.division.label}</Badge></p>
      <p className="type-caption text-muted">{d.rule}</p>
      <div className="overflow-x-auto"><table className="mode-table"><thead><tr><th>#</th><th>Jogador</th><th>J</th><th>V</th><th>E</th><th>D</th><th>Pts</th><th>Hype</th><th>Divisão</th></tr></thead>
        <tbody>{d.table.map((r) => <tr key={r.user.id} className={r.you ? "font-semibold" : ""}><td>{r.position}</td><td><span className="flex items-center gap-1"><Avatar src={r.user.avatarUrl} name={r.user.displayName} size={20} />@{r.user.username}</span></td><td>{r.played}</td><td>{r.wins}</td><td>{r.draws}</td><td>{r.losses}</td><td><b>{r.points}</b></td><td>{r.hype.toLocaleString("pt-BR")}</td><td>{r.division.label}</td></tr>)}
          {d.table.length === 0 && <tr><td colSpan={9} className="text-muted">Ninguém escalou o elenco nesta temporada ainda.</td></tr>}</tbody></table></div>
      <LookPicker looks={looks} value={starters} onChange={(v) => { setStarters(v); setReserves(reserves.filter((x) => !v.includes(x))); }} max={5} label="Titulares" />
      <LookPicker looks={looks.filter((l) => !starters.includes(l.schemeId ?? ""))} value={reserves} onChange={setReserves} max={3} label="Reservas" />
      <div><p className="label">Peças especiais ({specials.length}/5) — +3 na rodada do estilo/ocasião delas</p>
        <div className="flex gap-2 overflow-x-auto pb-1">{(cards.data?.cards ?? []).map((c) => <FlairCardView key={c.id} card={c} size="sm" selected={specials.includes(c.id)} onClick={() => setSpecials(specials.includes(c.id) ? specials.filter((x) => x !== c.id) : specials.length >= 5 ? specials : [...specials, c.id])} />)}</div></div>
      <div className="flex flex-wrap gap-2"><Button onClick={save} disabled={starters.length === 0}>Salvar elenco</Button><PlayButton busy={busy} disabled={!d.roster.starters?.length} onClick={() => play(() => api.post("/api/flair/modes/league/play")).then(() => { league.reload(); onDone(); })}>🏆 Jogar rodada</PlayButton></div>
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
      <div className="flex flex-wrap items-center gap-3"><Badge tone="thread">{t.points} pontos</Badge><Badge>volta {t.lap}</Badge>{t.lastRoll && <span className="mode-dice" aria-label={`dado ${t.lastRoll}`}>{"⚀⚁⚂⚃⚄⚅"[t.lastRoll - 1]}</span>}<span className="type-caption text-muted">{t.rollsLeft} rolagens hoje</span></div>
      <div className="mode-board" role="list" aria-label="Tabuleiro Paris → São Paulo">{t.cities.map((city) => (
        <div key={city} className="mode-city" role="listitem"><p className="mode-city-name">{city}</p>
          <div className="mode-squares">{t.board.filter((s) => s.city === city).map((s) => <div key={s.index} className={cn("mode-square", `mode-square-${s.type.toLowerCase()}`, s.index === t.position && "mode-square-here")} title={`${s.title} — ${s.rule}`}><span aria-hidden>{s.emoji}</span><small>{s.title}</small>{s.index === t.position && <b className="mode-pawn" aria-label="você está aqui">●</b>}</div>)}</div></div>))}</div>
      {pending ? <div className="surface p-3"><p className="type-body"><b>{pending.emoji} {pending.title}</b> — {pending.rule} (alvo {pending.target}, vale {pending.reward})</p><LookPicker looks={looks} value={pick} onChange={setPick} /><div className="mt-2"><PlayButton busy={busy} disabled={!pick[0]} onClick={() => play(async () => { const r = await api.post<ModeResult & { tour: TourState }>("/api/flair/modes/tour/resolve", { schemeId: pick[0] }); tour.setData(r.tour); onDone(); return r; })}>Cumprir o desafio</PlayButton></div></div>
        : <div><Button variant="primary" loading={rolling} disabled={t.rollsLeft === 0} onClick={roll}>🎲 Rolar o dado</Button></div>}
      <ResultView result={result} labelB="Nota-alvo" />
      <ul className="type-caption grid gap-0.5">{t.log.slice(0, 8).map((l, i) => <li key={i}>{l.text}</li>)}</ul>
      <p className="type-caption text-muted">{t.rule}</p>
    </div>
  );
}

// ------------------------------------------------------------------ 5/7. Conquest e Monopoly
interface TerritoryView { territory: Territory; theme: Theme; owner?: UserCard | null; mine: boolean; defenders: { title: string; rating: number }[]; defenses: number; }
function TerritoryPanel({ map, looks, onDone }: PanelProps & { map: string }) {
  const data = useApi<{ territories: TerritoryView[]; rule: string; mine: number }>((signal) => api.get(`/api/flair/modes/territories?map=${map}`, { signal }), [map]);
  const [target, setTarget] = useState<string | null>(null); const [pick, setPick] = useState<string[]>([]);
  const { busy, result, play } = usePlay();
  const need = map === "CONQUEST" ? 3 : 1;
  if (data.loading || !data.data) return <Skeleton className="h-48" />;
  return (
    <div className="grid gap-3">
      <p className="type-caption text-muted">{data.data.rule} Você domina {data.data.mine}.</p>
      <div className="mode-territories">{data.data.territories.map((t) => (
        <button key={t.territory.code} type="button" className={cn("mode-territory", t.mine && "mode-territory-mine", target === t.territory.code && "mode-territory-on")} onClick={() => setTarget(t.territory.code)} disabled={t.mine}>
          <span className="text-2xl" aria-hidden>{t.territory.emoji}</span><b>{t.territory.name}</b>
          <small>{t.owner ? `@${t.owner.username}` : "livre (Casa defende)"}{t.mine ? " · seu" : ""}</small>
          <small className="text-muted">{t.theme.emoji} {t.theme.label} · {t.territory.bonus}</small>
          {t.defenders.length > 0 && <small>defensores: {t.defenders.map((d) => d.title).join(", ")}</small>}
        </button>))}</div>
      {target && <><LookPicker looks={looks} value={pick} onChange={setPick} max={need} label={map === "CONQUEST" ? "3 looks de ataque" : "Look de ataque"} />
        <div><PlayButton busy={busy} disabled={pick.length !== need} onClick={() => play(() => api.post(`/api/flair/modes/territories/${map}/${target}/attack`, { schemeIds: pick })).then(() => { data.reload(); onDone(); })}>{map === "CONQUEST" ? "🗺️ Conquistar região" : "🏙️ Tomar o distrito"}</PlayButton></div></>}
      {result && (result as ModeResult & { captured?: boolean }).captured && <p className="mode-banner">🎉 {map === "CONQUEST" ? "Seu Lookbook conquistou a região!" : "O distrito agora é seu!"}</p>}
      <ResultView result={result} labelB="Defensor" />
    </div>
  );
}

// ------------------------------------------------------------------ 6. Deck Battle
function DeckPanel({ onDone }: PanelProps) {
  const toast = useToast();
  const deck = useApi<{ cards: FlairCard[]; valid: boolean; suggestion: string[] }>((signal) => api.get("/api/flair/modes/deck", { signal }), []);
  const all = useApi<{ cards: FlairCard[] }>((signal) => api.get("/api/flair/cards", { signal }), []);
  const [sel, setSel] = useState<string[]>([]); const [game, setGame] = useState<{ id: string; challenge: Theme; hand: FlairCard[]; hint: string[] } | null>(null); const [hand, setHand] = useState<string[]>([]);
  const { busy, result, setResult, play } = usePlay();
  useEffect(() => { if (deck.data) setSel(deck.data.cards.map((c) => c.id)); }, [deck.data]);
  const byCat = (cat: string) => (all.data?.cards ?? []).filter((c) => sel.includes(c.id) && (c.category === cat || (cat === "upper_piece" && c.category === "full_body_piece"))).length;
  async function save(ids: string[]) { try { deck.setData(await api.put("/api/flair/modes/deck", { pieceIds: ids })); toast.success("Deck salvo."); } catch (e) { toast.fromError(e); } }
  return (
    <div className="grid gap-3">
      <p className="type-body-sm">Deck: <b>{sel.length}/12</b> · superiores {byCat("upper_piece")}/4 · inferiores {byCat("lower_piece")}/3 · calçados {byCat("shoes_piece")}/2 · acessórios {byCat("accessory_piece")}/2 · +1 curinga</p>
      <div className="flex gap-2 overflow-x-auto pb-1">{(all.data?.cards ?? []).map((c) => <FlairCardView key={c.id} card={c} size="sm" selected={sel.includes(c.id)} onClick={() => setSel(sel.includes(c.id) ? sel.filter((x) => x !== c.id) : sel.length >= 12 ? sel : [...sel, c.id])} />)}</div>
      <div className="flex flex-wrap gap-2"><Button onClick={() => deck.data && setSel(deck.data.suggestion)}>Usar sugestão</Button><Button onClick={() => save(sel)} disabled={sel.length !== 12}>Salvar deck</Button>
        <PlayButton busy={busy} disabled={!deck.data?.valid} onClick={async () => { setResult(null); const g = await play(() => api.post<{ id: string; challenge: Theme; hand: FlairCard[]; hint: string[] }>("/api/flair/modes/deck/battle"), false); if (g) { setGame(g); setHand([]); } }}>🃏 Nova partida</PlayButton></div>
      {game && !result && <div className="surface p-3">
        <p className="type-body">Desafio: <ThemeBadge theme={game.challenge} /> — monte o melhor look com 2 a 5 cartas da mão.</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{game.hand.map((c) => <FlairCardView key={c.id} card={c} size="sm" selected={hand.includes(c.id)} onClick={() => setHand(hand.includes(c.id) ? hand.filter((x) => x !== c.id) : hand.length >= 5 ? hand : [...hand, c.id])} />)}</div>
        <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => setHand(game.hint)}>Dica da IA</Button><PlayButton busy={busy} disabled={hand.length < 2} onClick={() => play(() => api.post(`/api/flair/modes/deck/battle/${game.id}/play`, { pieceIds: hand })).then(onDone)}>Jogar look</PlayButton></div>
      </div>}
      <ResultView result={result} labelB="A Casa" />
    </div>
  );
}

// ------------------------------------------------------------------ Wardrobe Wars
function WardrobePanel({ onDone }: PanelProps) {
  const [opp, setOpp] = useState(""); const { busy, result, play } = usePlay();
  return (
    <div className="grid gap-3">
      <OpponentField value={opp} onChange={setOpp} allowHouse={false} label="Guarda-roupa adversário" />
      <div><PlayButton busy={busy} disabled={!opp.trim()} onClick={() => play(() => api.post("/api/flair/modes/wardrobe-wars", { opponent: opp })).then(onDone)}>🧥 Guarda-roupa × guarda-roupa</PlayButton></div>
      <p className="type-caption text-muted">Do oponente contam só peças e looks públicos.</p>
      <ResultView result={result} />
    </div>
  );
}

// ------------------------------------------------------------------ Runway
interface RunwayStage { stage: string; results: { title?: string; owner?: string; score?: number; you?: boolean; advanced?: boolean; a?: string; b?: string; scoreA?: number; scoreB?: number; winner?: string }[]; }
function RunwayPanel({ looks, onDone }: PanelProps) {
  const info = useApi<{ theme: Theme; week: string; season: string; rule: string; entry?: { place: string; card?: string; stages: RunwayStage[] } | null }>((signal) => api.get("/api/flair/modes/runway", { signal }), []);
  const [pick, setPick] = useState<string[]>([]); const { busy, result, play } = usePlay();
  if (info.loading || !info.data) return <Skeleton className="h-40" />;
  const r = result as (ModeResult & { stages?: RunwayStage[]; place?: string; card?: string }) | null;
  const stages = r?.stages ?? info.data.entry?.stages ?? []; const card = r?.card ?? info.data.entry?.card; const place = r?.place ?? info.data.entry?.place;
  return (
    <div className="grid gap-3">
      <p className="type-body">Tema da semana: <ThemeBadge theme={info.data.theme} /> · Season {info.data.season}</p>
      <p className="type-caption text-muted">{info.data.rule}</p>
      {!info.data.entry && !r && <><LookPicker looks={looks} value={pick} onChange={setPick} /><div><PlayButton busy={busy} disabled={!pick[0]} onClick={() => play(() => api.post("/api/flair/modes/runway", { schemeId: pick[0] })).then(() => { info.reload(); onDone(); })}>✨ Desfilar</PlayButton></div></>}
      {place && <p className="mode-banner">Colocação: <b>{place}</b></p>}
      {card && card !== "null" && <div className="mode-trophy-card"><span aria-hidden>🏆</span><b>{card}</b><small>aparece no seu perfil</small></div>}
      {stages.map((s) => <div key={s.stage}><p className="label">{s.stage}</p><ul className="grid gap-1">{s.results.map((x, i) => <li key={i} className={cn("type-body-sm", x.you && "font-semibold")}>{x.title ? `${x.advanced ? "✔" : "·"} ${x.title} (@${x.owner}) — ${x.score}` : `${x.a} ${x.scoreA} × ${x.scoreB} ${x.b} → ${x.winner === "A" ? "◀" : "▶"}`}</li>)}</ul></div>)}
    </div>
  );
}

// ------------------------------------------------------------------ Draft
interface DraftState { id: string; status: string; pool: FlairCard[]; mine: FlairCard[]; theirs: FlairCard[]; pick: number; turn: string; order: string; themes: Theme[]; }
function DraftPanel({ onDone }: PanelProps) {
  const toast = useToast(); const [d, setD] = useState<DraftState | null>(null); const [assign, setAssign] = useState<Record<string, number>>({});
  const { busy, result, setResult, play } = usePlay();
  async function pick(id: string) { if (!d) return; try { setD(await api.post<DraftState>(`/api/flair/modes/draft/${d.id}/pick`, { pieceId: id })); } catch (e) { toast.fromError(e); } }
  const looksOf = (n: number) => Object.entries(assign).filter(([, v]) => v === n).map(([k]) => k);
  return (
    <div className="grid gap-3">
      <div><PlayButton busy={busy} onClick={async () => { setResult(null); setAssign({}); const r = await play(() => api.post<DraftState>("/api/flair/modes/draft"), false); if (r) setD(r); }}>🧩 Novo draft</PlayButton></div>
      {d && !result && <>
        <p className="type-caption">Ordem: {d.order} · escolha {Math.min(d.pick + 1, 20)}/20 · {d.turn === "COMPOSE" ? "monte seus 3 looks" : d.turn === "A" ? "sua vez" : "vez da IA"} · temas: {d.themes.map((t) => `${t.emoji} ${t.label}`).join(" · ")}</p>
        {d.turn === "A" && <div className="flex flex-wrap gap-2">{d.pool.map((c) => <FlairCardView key={c.id} card={c} size="sm" onClick={() => pick(c.id)} />)}</div>}
        <div className="grid gap-2 md:grid-cols-2"><div><p className="label">Suas escolhas ({d.mine.length})</p><div className="flex flex-wrap gap-1">{d.mine.map((c) => <button key={c.id} type="button" className="chip" aria-pressed={!!assign[c.id]} onClick={() => setAssign({ ...assign, [c.id]: ((assign[c.id] ?? 0) + 1) % 4 })}>{c.name}{assign[c.id] ? ` → look ${assign[c.id]}` : ""}</button>)}</div></div>
          <div><p className="label">Escolhas da IA ({d.theirs.length})</p><p className="type-caption text-muted">{d.theirs.map((c) => c.name).join(", ")}</p></div></div>
        {d.turn === "COMPOSE" && <><p className="type-caption text-muted">Toque numa escolha para mandá-la ao look 1, 2 ou 3 (cada look com 2+ peças).</p>
          <PlayButton busy={busy} disabled={[1, 2, 3].some((n) => looksOf(n).length < 2)} onClick={() => play(() => api.post(`/api/flair/modes/draft/${d.id}/looks`, { looks: [looksOf(1), looksOf(2), looksOf(3)] })).then(onDone)}>Enfrentar a IA</PlayButton></>}
      </>}
      <ResultView result={result} labelB="IA do Draft" />
    </div>
  );
}

// ------------------------------------------------------------------ Tag Team
function TagPanel({ looks, onDone }: PanelProps) {
  const [pick, setPick] = useState<string[]>([]); const [partner, setPartner] = useState(""); const [o1, setO1] = useState(""); const [o2, setO2] = useState("");
  const { busy, result, play } = usePlay();
  const r = result as (ModeResult & { teamA?: { harmony: number }; teamB?: { harmony: number } }) | null;
  return (
    <div className="grid gap-3">
      <LookPicker looks={looks} value={pick} onChange={setPick} />
      <div className="grid gap-2 sm:grid-cols-3"><Field label="Sua dupla (@usuário)" id="tt-p"><Input id="tt-p" value={partner} onChange={(e) => setPartner(e.target.value)} /></Field><Field label="Adversário 1 (opcional)" id="tt-1"><Input id="tt-1" value={o1} onChange={(e) => setO1(e.target.value)} /></Field><Field label="Adversário 2 (opcional)" id="tt-2"><Input id="tt-2" value={o2} onChange={(e) => setO2(e.target.value)} /></Field></div>
      <div><PlayButton busy={busy} disabled={!pick[0] || !partner.trim()} onClick={() => play(() => api.post("/api/flair/modes/tag-team", { schemeId: pick[0], partner, opponents: o1 && o2 ? [o1, o2] : [] })).then(onDone)}>🤝 Jogar em dupla</PlayButton></div>
      {r?.teamA && <p className="type-body-sm">Team Harmony: <b>{r.teamA.harmony}</b> × {r.teamB?.harmony}</p>}
      <ResultView result={result} labelA="Sua dupla" labelB="Dupla adversária" />
    </div>
  );
}

// ------------------------------------------------------------------ Boss
function BossPanel({ looks, catalog, onDone }: PanelProps) {
  const [boss, setBoss] = useState<string | null>(null); const [pick, setPick] = useState<string[]>([]); const { busy, result, play } = usePlay();
  const b = catalog.bosses.find((x) => x.code === boss);
  return (
    <div className="grid gap-3">
      <div className="mode-grid">{catalog.bosses.map((x) => <button key={x.code} type="button" className={cn("mode-card text-left", boss === x.code && "mode-card-on")} onClick={() => setBoss(x.code)}><span className="mode-card-emoji">{x.emoji}</span><p className="type-h3">{x.name}</p><p className="type-caption">{Object.entries(x.stats).map(([k, v]) => `${STAT_LABEL[k]} ${v}`).join(" · ")}</p></button>)}</div>
      {b && <><p className="mode-banner">💡 {b.lesson}</p><LookPicker looks={looks} value={pick} onChange={setPick} max={3} label="1 a 3 looks contra o boss" />
        <div><PlayButton busy={busy} disabled={pick.length === 0} onClick={() => play(() => api.post(`/api/flair/modes/bosses/${b.code}`, { schemeIds: pick })).then(onDone)}>Enfrentar {b.name}</PlayButton></div></>}
      <ResultView result={result} labelB={b?.name} />
    </div>
  );
}

// ------------------------------------------------------------------ Combo Battle
function ComboPanel({ looks, onDone }: PanelProps) {
  const [pick, setPick] = useState<string[]>([]); const [opp, setOpp] = useState("CASA"); const { busy, result, play } = usePlay();
  const book = (result as (ModeResult & { comboBook?: string[] }) | null)?.comboBook;
  return (
    <div className="grid gap-3">
      <LookPicker looks={looks} value={pick} onChange={setPick} />
      <OpponentField value={opp} onChange={setOpp} />
      <div><PlayButton busy={busy} disabled={!pick[0]} onClick={() => play(() => api.post("/api/flair/modes/combo", { schemeId: pick[0], opponent: opp || "CASA" })).then(onDone)}>⚡ Combo Battle</PlayButton></div>
      <ResultView result={result} />
      <ul className="type-caption grid gap-0.5">{(book ?? ["⚡ Streetwear Combo: tênis + cargo/jeans + camiseta/moletom → +15 Style", "👔 Classic Formal: blazer + camisa + sapato de couro → +18 Style", "🖤 Monochrome: 3 peças da mesma família de cor → +12 Style", "🏷️ Brand Loyalty: 3 da mesma marca → +10 Brand Power", "🎨 Mix & Match: 3 marcas diferentes → +10 Originality", "📻 Vintage Revival: 2 peças vintage → +15 Trend em eventos retrô"]).map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
  );
}

// ------------------------------------------------------------------ Chess
const SLOT_LABEL: Record<string, string> = { ACCESSORY_L: "Acessório", TOP: "Top", ACCESSORY_R: "Acessório", BOTTOM: "Bottom", HERO: "HERO ×1,25", OUTERWEAR: "Outerwear", SHOES_L: "Calçado", SUPPORT: "Support", SHOES_R: "Calçado" };
function ChessPanel({ onDone }: PanelProps) {
  const info = useApi<{ slots: string[]; cards: FlairCard[]; suggestion: Record<string, string>; rules: string[] }>((signal) => api.get("/api/flair/modes/chess", { signal }), []);
  const [board, setBoard] = useState<Record<string, string>>({}); const [hand, setHand] = useState<string | null>(null); const { busy, result, play } = usePlay();
  const cards = useMemo(() => Object.fromEntries((info.data?.cards ?? []).map((c) => [c.id, c])), [info.data]);
  if (info.loading || !info.data) return <Skeleton className="h-48" />;
  const r = result as (ModeResult & { me?: { bonuses: string[] }; opponent?: { label: string; board: { bonuses: string[] }; cards: Record<string, string> } }) | null;
  return (
    <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
      <div className="mode-chess" role="grid" aria-label="Tabuleiro 3×3">{info.data.slots.map((s) => (
        <button key={s} type="button" className={cn("mode-cell", s === "HERO" && "mode-cell-hero", s === "SUPPORT" && "mode-cell-support")} onClick={() => { if (hand) { setBoard({ ...Object.fromEntries(Object.entries(board).filter(([, v]) => v !== hand)), [s]: hand }); setHand(null); } else if (board[s]) { const n = { ...board }; delete n[s]; setBoard(n); } }}>
          <small>{SLOT_LABEL[s]}</small>{board[s] && cards[board[s]] ? <><img src={mediaUrl(cards[board[s]].imageUrl)} alt="" /><em>{cards[board[s]].name}</em></> : <span className="text-faint">vazio</span>}
        </button>))}</div>
      <div className="grid gap-2">
        <p className="type-caption">Toque numa carta e depois numa casa. Tocar numa casa ocupada a esvazia.</p>
        <div className="flex gap-2 overflow-x-auto pb-1">{info.data.cards.map((c) => <FlairCardView key={c.id} card={c} size="sm" selected={hand === c.id} dim={Object.values(board).includes(c.id)} onClick={() => setHand(c.id)} />)}</div>
        <div className="flex flex-wrap gap-2"><Button onClick={() => setBoard(info.data!.suggestion)}>Sugestão</Button><PlayButton busy={busy} disabled={Object.keys(board).length < 3} onClick={() => play(() => api.post("/api/flair/modes/chess", { board })).then(onDone)}>♟️ Jogar contra a IA</PlayButton></div>
        <ul className="type-caption grid gap-0.5 text-muted">{info.data.rules.map((x) => <li key={x}>{x}</li>)}</ul>
        <ResultView result={result} labelB="IA estrategista" />
        {r?.me && <div className="grid gap-2 md:grid-cols-2"><div><p className="label">Seus bônus</p><ul className="type-caption">{r.me.bonuses.map((x, i) => <li key={i}>{x}</li>)}</ul></div><div><p className="label">Bônus da IA</p><ul className="type-caption">{r.opponent?.board.bonuses.map((x, i) => <li key={i}>{x}</li>)}</ul></div></div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Ultimate Team
const ROLE_LABEL: Record<string, string> = { ICON: "ICON", TREND: "TREND", SOCIAL: "SOCIAL", CREATIVE: "CREATIVE", CLASSIC: "CLASSIC", WILD_CARD: "WILD CARD", SPECIAL: "SPECIAL" };
function UltimatePanel({ looks, onDone }: PanelProps) {
  const toast = useToast();
  const ut = useApi<{ roles: string[]; roster: Record<string, { look: ModeLook; value: number } | null>; team: Record<string, number>; suggestion: Record<string, string | null>; roleHelp: Record<string, string> }>((signal) => api.get("/api/flair/modes/ultimate", { signal }), []);
  const [roles, setRoles] = useState<Record<string, string>>({}); const [opp, setOpp] = useState("CASA"); const { busy, result, play } = usePlay();
  useEffect(() => { if (ut.data) setRoles(Object.fromEntries(Object.entries(ut.data.roster).filter(([, v]) => v).map(([k, v]) => [k, v!.look.schemeId ?? ""]))); }, [ut.data]);
  if (ut.loading || !ut.data) return <Skeleton className="h-48" />;
  const d = ut.data;
  async function save(r: Record<string, string>) { try { ut.setData(await api.put("/api/flair/modes/ultimate", { roles: r })); toast.success("FLAIR Team salvo."); } catch (e) { toast.fromError(e); } }
  return (
    <div className="grid gap-3">
      <div className="mode-team-rating">{Object.entries(d.team).map(([k, v]) => <div key={k}><small>{k === "rating" ? "Team Rating" : k.charAt(0).toUpperCase() + k.slice(1)}</small><b className="tabular">{v}</b></div>)}</div>
      <div className="grid gap-2 md:grid-cols-2">{d.roles.map((role) => (
        <Field key={role} label={`${ROLE_LABEL[role]} — ${d.roleHelp[role]}`} id={`ut-${role}`}>
          <Select id={`ut-${role}`} value={roles[role] ?? ""} onChange={(e) => setRoles({ ...roles, [role]: e.target.value })}><option value="">—</option>{looks.map((l) => <option key={l.schemeId ?? l.title} value={l.schemeId ?? ""} disabled={Object.entries(roles).some(([k, v]) => k !== role && v === l.schemeId)}>{l.title} · {l.rating}</option>)}</Select>
        </Field>))}</div>
      <div className="flex flex-wrap gap-2"><Button onClick={() => { const s = Object.fromEntries(Object.entries(d.suggestion).filter(([, v]) => v)) as Record<string, string>; setRoles(s); }}>Sugestão por função</Button><Button onClick={() => save(roles)}>Salvar FLAIR Team</Button></div>
      <OpponentField value={opp} onChange={setOpp} />
      <div><PlayButton busy={busy} onClick={() => play(() => api.post("/api/flair/modes/ultimate/play", { opponent: opp || "CASA" })).then(onDone)}>🌟 Jogar função × função</PlayButton></div>
      <ResultView result={result} />
    </div>
  );
}

