"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import type { UserCard } from "@/lib/api/types";
import { Avatar, Badge, Button, cn, Field, Select, Skeleton, useToast } from "@/components/ui";
import { FlairCardView, type FlairCard } from "@/components/flair/flair-card";
import { LookPicker, OpponentField, PlayButton, ThemeBadge, type ModeLook, type ModeResult, type Theme } from "@/components/flair/modes-shared";
import { tr, useI18n } from "@/lib/i18n/i18n";
import { currentIntl } from "@/lib/i18n/state";
import { DeckHand } from "@/components/flair/arena/deck-hand";
import { MatchArena } from "@/components/flair/arena/match-arena";
import { ModeOutcome } from "@/components/flair/arena/mode-outcome";
import { TacticsCard } from "@/components/flair/arena/tactics-card";
import { useInvite } from "@/components/flair/arena/invite-banner";
import { fromModeResult } from "@/lib/flair/match-stage";
import { usePlay } from "@/components/flair/modes/use-play";
import { handOf, lookOf, type PanelProps } from "@/components/flair/modes/types";

/** Modos de temporada e elenco: Fashion League, FLAIR Runway (desfile semanal) e Ultimate Team (funções). */

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

export function LeaguePanel({ looks, onDone }: PanelProps) {
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
      <TacticsCard looks={looks} slots={5} onPick={(v) => { setStarters(v); setReserves(reserves.filter((x) => !v.includes(x))); }} />
      <LookPicker looks={looks} value={starters} onChange={(v) => { setStarters(v); setReserves(reserves.filter((x) => !v.includes(x))); }} max={5} label={t("flair.modes.titulares")} />
      <LookPicker looks={looks.filter((l) => !starters.includes(l.schemeId ?? ""))} value={reserves} onChange={setReserves} max={3} label={t("flair.modes.reservas")} />
      <DeckHand cards={handOf(looks, starters)} />
      <div><p className="label">{t("flair.modes.pecas_especiais_5_3_na", { specialsCount: specials.length })}</p>
        <div className="flex gap-2 overflow-x-auto pb-1">{(cards.data?.cards ?? []).map((c) => <FlairCardView key={c.id} card={c} size="sm" selected={specials.includes(c.id)} onClick={() => setSpecials(specials.includes(c.id) ? specials.filter((x) => x !== c.id) : specials.length >= 5 ? specials : [...specials, c.id])} />)}</div></div>
      <div className="flex flex-wrap gap-2"><Button onClick={save} disabled={starters.length === 0}>{t("flair.modes.salvar_elenco")}</Button><PlayButton busy={busy} disabled={!d.roster.starters?.length} onClick={() => play(() => api.post("/api/flair/modes/league/play")).then(() => { league.reload(); onDone(); })}>{t("flair.modes.jogar_rodada")}</PlayButton></div>
      <ModeOutcome result={result} myLook={lookOf(looks, starters[0])} />
    </div>
  );
}

interface RunwayStage { stage: string; results: { title?: string; owner?: string; score?: number; you?: boolean; advanced?: boolean; a?: string; b?: string; scoreA?: number; scoreB?: number; winner?: string }[]; }
export function RunwayPanel({ looks, onDone }: PanelProps) {
  const { rich, t } = useI18n();
  const info = useApi<{ theme: Theme; week: string; season: string; rule: string; entry?: { place: string; card?: string; stages: RunwayStage[] } | null }>((signal) => api.get("/api/flair/modes/runway", { signal }), []);
  const [pick, setPick] = useState<string[]>([]); const { busy, result, play } = usePlay();
  const r = result as (ModeResult & { stages?: RunwayStage[]; place?: string; card?: string }) | null;
  const stage = useMemo(() => (r?.stages ? fromModeResult({ ...r, mode: "RUNWAY" }, lookOf(looks, pick[0])) : null), [r, looks, pick]);
  if (info.loading || !info.data) return <Skeleton className="h-40" />;
  const stages = r?.stages ?? info.data.entry?.stages ?? []; const card = r?.card ?? info.data.entry?.card; const place = r?.place ?? info.data.entry?.place;
  return (
    <div className="grid gap-3">
      <p className="type-body">{t("flair.modes.tema_da_semana")}{" "}<ThemeBadge theme={info.data.theme} />{" "}{t("flair.modes.season", { season: info.data.season })}</p>
      <p className="type-caption text-muted">{info.data.rule}</p>
      {!info.data.entry && !r && <><TacticsCard looks={looks} theme={info.data.theme} onPick={setPick} /><LookPicker looks={looks} value={pick} onChange={setPick} /><DeckHand cards={handOf(looks, pick)} /><div><PlayButton busy={busy} disabled={!pick[0]} onClick={() => play(() => api.post("/api/flair/modes/runway", { schemeId: pick[0] })).then(() => { info.reload(); onDone(); })}>{t("flair.modes.desfilar")}</PlayButton></div></>}
      {place && <p className="mode-banner">{rich("flair.modes.colocacao", { place }, { 0: ($c) => <b>{$c}</b> })}</p>}
      {card && card !== "null" && <div className="mode-trophy-card"><span aria-hidden>🏆</span><b>{card}</b><small>{t("flair.modes.aparece_no_seu_perfil")}</small></div>}
      <MatchArena data={stage} labelA={t("flair.voce")} labelB={t("flair.arena.passarela")} />
      {stages.map((s) => <div key={s.stage}><p className="label">{s.stage}</p><ul className="fai-list">{s.results.map((x, i) => <li key={i} className={cn("type-body-sm", x.you && "font-semibold")}>{x.title ? `${x.advanced ? "✔" : "·"} ${x.title} (@${x.owner}) — ${x.score}` : `${x.a} ${x.scoreA} × ${x.scoreB} ${x.b} → ${x.winner === "A" ? "◀" : "▶"}`}</li>)}</ul></div>)}
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = { ICON: "ICON", TREND: "TREND", SOCIAL: "SOCIAL", CREATIVE: "CREATIVE", CLASSIC: "CLASSIC", get WILD_CARD() { return tr("flair.modes.wild_card"); }, SPECIAL: "SPECIAL" };
export function UltimatePanel({ looks, onDone }: PanelProps) {
  const { t } = useI18n();
  const toast = useToast(); const { rival } = useInvite();
  const ut = useApi<{ roles: string[]; roster: Record<string, { look: ModeLook; value: number } | null>; team: Record<string, number>; suggestion: Record<string, string | null>; roleHelp: Record<string, string> }>((signal) => api.get("/api/flair/modes/ultimate", { signal }), []);
  const [roles, setRoles] = useState<Record<string, string>>({}); const [opp, setOpp] = useState(rival ?? "CASA"); const { busy, result, play } = usePlay();
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
      <DeckHand cards={handOf(looks, Object.values(roles).filter(Boolean))} />
      <div className="flex flex-wrap gap-2"><Button onClick={() => { const s = Object.fromEntries(Object.entries(d.suggestion).filter(([, v]) => v)) as Record<string, string>; setRoles(s); }}>{t("flair.modes.sugestao_por_funcao")}</Button><Button onClick={() => save(roles)}>{t("flair.modes.salvar_flair_team")}</Button></div>
      <OpponentField value={opp} onChange={setOpp} />
      <div><PlayButton busy={busy} disabled={!opp} onClick={() => play(() => api.post("/api/flair/modes/ultimate/play", { opponent: opp || "CASA" })).then(onDone)}>{t("flair.modes.jogar_funcao_funcao")}</PlayButton></div>
      <ModeOutcome result={result} />
    </div>
  );
}
