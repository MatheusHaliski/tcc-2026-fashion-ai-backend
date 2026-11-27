"use client";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import type { UserCard } from "@/lib/api/types";
import { Badge, Button, cn, Skeleton, useToast } from "@/components/ui";
import { LookPicker, PlayButton, STAT_LABEL, type ModeResult, type Theme } from "@/components/flair/modes-shared";
import { tr, trRich, useI18n } from "@/lib/i18n/i18n";
import { DeckHand } from "@/components/flair/arena/deck-hand";
import { ModeOutcome } from "@/components/flair/arena/mode-outcome";
import { TacticsCard } from "@/components/flair/arena/tactics-card";
import { usePlay } from "@/components/flair/modes/use-play";
import { handOf, lookOf, themeOf, type PanelProps, type Square, type Territory } from "@/components/flair/modes/types";

/** Campanhas de mapa e chefe: Fashion World Tour (tabuleiro), Conquest e Monopoly (territórios) e Fashion Boss. */

interface TourState { board: Square[]; cities: string[]; position: number; lap: number; points: number; pending?: number | null; lastRoll?: number; log: { text: string }[]; rollsLeft: number; rule: string; }
export function TourPanel({ looks, catalog, onDone }: PanelProps) {
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
      {pending ? <div className="surface p-3 grid gap-2"><p className="type-body">{trRich("flair.modes.alvo_vale", { emoji: pending.emoji, title: pending.title, rule: pending.rule, target: pending.target, reward: pending.reward }, { 0: ($c) => <b>{$c}</b> })}</p>
        <TacticsCard looks={looks} theme={themeOf(catalog, pending.theme)} onPick={setPick} />
        <LookPicker looks={looks} value={pick} onChange={setPick} /><DeckHand cards={handOf(looks, pick)} />
        <div><PlayButton busy={busy} disabled={!pick[0]} onClick={() => play(async () => { const r = await api.post<ModeResult & { tour: TourState }>("/api/flair/modes/tour/resolve", { schemeId: pick[0] }); tour.setData(r.tour); onDone(); return r; })}>{tr("flair.modes.cumprir_o_desafio")}</PlayButton></div></div>
        : <div><Button variant="primary" loading={rolling} disabled={t.rollsLeft === 0} onClick={roll}>{tr("flair.modes.rolar_o_dado")}</Button></div>}
      <ModeOutcome result={result} myLook={lookOf(looks, pick[0])} labelB={tr("flair.modes.nota_alvo")} />
      <ul className="fai-list type-caption">{t.log.slice(0, 8).map((l, i) => <li key={i}>{l.text}</li>)}</ul>
      <p className="type-caption text-muted">{t.rule}</p>
    </div>
  );
}

interface TerritoryView { territory: Territory; theme: Theme; owner?: UserCard | null; mine: boolean; defenders: { title: string; rating: number }[]; defenses: number; }
export function TerritoryPanel({ map, looks, onDone }: PanelProps & { map: string }) {
  const { t } = useI18n();
  const data = useApi<{ territories: TerritoryView[]; rule: string; mine: number }>((signal) => api.get(`/api/flair/modes/territories?map=${map}`, { signal }), [map]);
  const [target, setTarget] = useState<string | null>(null); const [pick, setPick] = useState<string[]>([]);
  const { busy, result, play } = usePlay();
  const need = map === "CONQUEST" ? 3 : 1;
  if (data.loading || !data.data) return <Skeleton className="h-48" />;
  const chosen = data.data.territories.find((x) => x.territory.code === target);
  return (
    <div className="grid gap-3">
      <p className="type-caption text-muted">{t("flair.modes.voce_domina", { rule: data.data.rule, mine: data.data.mine })}</p>
      <div className="mode-territories">{data.data.territories.map((x) => (
        <button key={x.territory.code} type="button" className={cn("mode-territory", x.mine && "mode-territory-mine", target === x.territory.code && "mode-territory-on")} onClick={() => setTarget(x.territory.code)} disabled={x.mine}>
          <span className="text-2xl" aria-hidden>{x.territory.emoji}</span><b>{x.territory.name}</b>
          <small>{x.owner ? `@${x.owner.username}` : tr("flair.modes.livre_casa_defende")}{x.mine ? tr("flair.modes.seu") : ""}</small>
          <small className="text-muted">{x.theme.emoji} {x.theme.label} · {x.territory.bonus}</small>
          {x.defenders.length > 0 && <small>{tr("flair.modes.defensores")}{" "}{x.defenders.map((d) => d.title).join(", ")}</small>}
        </button>))}</div>
      {target && <><TacticsCard looks={looks} theme={chosen?.theme} slots={need} onPick={setPick} />
        <LookPicker looks={looks} value={pick} onChange={setPick} max={need} label={map === "CONQUEST" ? t("flair.modes.n3_looks_de_ataque") : t("flair.modes.look_de_ataque")} />
        <DeckHand cards={handOf(looks, pick)} />
        <div><PlayButton busy={busy} disabled={pick.length !== need} onClick={() => play(() => api.post(`/api/flair/modes/territories/${map}/${target}/attack`, { schemeIds: pick })).then(() => { data.reload(); onDone(); })}>{map === "CONQUEST" ? t("flair.modes.conquistar_regiao") : t("flair.modes.tomar_o_distrito")}</PlayButton></div></>}
      {result && (result as ModeResult & { captured?: boolean }).captured && <p className="mode-banner">🎉 {map === "CONQUEST" ? t("flair.modes.seu_lookbook_conquistou_a_regiao") : t("flair.modes.o_distrito_agora_e_seu")}</p>}
      <ModeOutcome result={result} myLook={lookOf(looks, pick[0])} labelB={t("flair.modes.defensor")} />
    </div>
  );
}

export function BossPanel({ looks, catalog, onDone }: PanelProps) {
  const { t } = useI18n();
  const [boss, setBoss] = useState<string | null>(null); const [pick, setPick] = useState<string[]>([]); const { busy, result, play } = usePlay();
  const b = catalog.bosses.find((x) => x.code === boss);
  return (
    <div className="grid gap-3">
      <div className="mode-grid">{catalog.bosses.map((x) => <button key={x.code} type="button" className={cn("fm-card", boss === x.code && "fm-card-on")} aria-pressed={boss === x.code} onClick={() => setBoss(x.code)}><span className="fm-card-emoji" aria-hidden>{x.emoji}</span><p className="type-h3">{x.name}</p><p className="type-caption">{Object.entries(x.stats).map(([k, v]) => `${STAT_LABEL[k]} ${v}`).join(" · ")}</p></button>)}</div>
      {b && <><p className="mode-banner">💡 {b.lesson}</p>
        <TacticsCard looks={looks} theme={themeOf(catalog, b.theme)} slots={3} boss={b.stats} onPick={setPick} />
        <LookPicker looks={looks} value={pick} onChange={setPick} max={3} label={t("flair.modes.n1_a_3_looks_contra")} />
        <DeckHand cards={handOf(looks, pick)} />
        <div><PlayButton busy={busy} disabled={pick.length === 0} onClick={() => play(() => api.post(`/api/flair/modes/bosses/${b.code}`, { schemeIds: pick })).then(onDone)}>{t("flair.modes.enfrentar", { name: b.name })}</PlayButton></div></>}
      <ModeOutcome result={result} myLook={lookOf(looks, pick[0])} labelB={b?.name} />
    </div>
  );
}
