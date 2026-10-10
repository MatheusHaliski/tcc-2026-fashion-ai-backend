"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import { label as taxLabel } from "@/lib/api/taxonomy";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { hasMessage } from "@/lib/i18n/core";
import { isOwnWindow, OWN_READING, storyVars, type CbcCheck, type CbcDetail, type CbcGroup, type CbcList as CbcListData, type CbcPointsLine, type CbcRequirement, type CbcRequirementResult, type CbcSlot, type CbcStoryLine, type CbcSubmission, type CbcSubmitResult, type CbcSummary } from "@/lib/flair/cbc";
import { Badge, Button, Card, Chip, cn, Dialog, EmptyState, ErrorState, PageHeader, Skeleton, SkeletonGrid, UiIcon, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { FlairGameCard, type FlairCollectionCard } from "@/components/flair/flair-game-card";
import { CbcScene, CbcSceneArt } from "@/components/flair/cbc-scene";
import { FlairHubIcon } from "@/components/flair/hub-icons";
import { HowItWorks } from "@/components/guide/guide";
import type { FlairCollection } from "@/components/flair/flair-collection";

/**
 * Desafios de Montagem (Card Building Challenges, FLAIR-UT §7 e §14) sobre /api/flair/challenges.
 * A analogia é a dos desafios de elenco dos jogos de futebol: em vez de um campo, a pessoa completa um mini mapa
 * ilustrado do objetivo (Ipanema, a gala, o desfile…), vaga a vaga, com as próprias cartas FLAIR. A sintonia é a
 * "química"; os requisitos, a sintonia, a história e os pontos vêm sempre do servidor (/check), que é a fonte da
 * verdade; a entrega (/submit) é atômica e bloqueia as cartas como memória. Conferir nunca gasta nada.
 */

// ================================================================== rótulos compartilhados
function useCbcLabels() {
  const { t, locale } = useI18n();
  const tOr = useCallback((key: string, fallback: string, vars?: Record<string, unknown>) => (hasMessage(locale, key) ? t(key, vars) : fallback), [t, locale]);
  const slotLabel = useCallback((scenario: string, s: Pick<CbcSlot, "key" | "label">) => s.label ?? tOr(`cbc.scenario.${scenario}.${s.key}.label`, s.key.replace(/_/g, " ")), [tOr]);
  const tierName = useCallback((tier: string) => tOr(`flairCard.tier.${tier}`, tier), [tOr]);
  const requirement = useCallback((r: CbcRequirement | CbcRequirementResult): string => {
    const a = ("args" in r ? r.args : r) as Record<string, unknown>;
    const n = (k: string, d = 1) => Number(a[k] ?? d);
    switch (r.type) {
      case "tier":
        if (a.only) return t("cbc.req.tier_only", { tier: tierName(String(a.only)) });
        if (a.max) return t("cbc.req.tier_max", { tier: tierName(String(a.max)) });
        return t("cbc.req.tier_min", { tier: tierName(String(a.min ?? "OURO")), count: n("count") });
      case "ovrAvg": return t("cbc.req.ovrAvg", { min: n("min") });
      case "ovrMin": return t("cbc.req.ovrMin", { min: n("min") });
      case "sintonia": return t("cbc.req.sintonia", { min: n("min") });
      case "sameBrand": return t("cbc.req.sameBrand", { count: n("count", 2) });
      case "distinctBrands": return t("cbc.req.distinctBrands", { count: n("count", 2) });
      case "tag": return t("cbc.req.tag", { count: n("count"), field: tOr(`cbc.field.${String(a.field)}`, String(a.field)), values: (Array.isArray(a.anyOf) ? a.anyOf : []).map((x) => taxLabel(String(x))).join(", ") });
      case "theme": return t("cbc.req.theme", { count: n("count") });
      case "hype": return t("cbc.req.hype", { dim: tOr(`flairCard.hype.${String(a.dim)}`, String(a.dim)), min: n("min"), count: n("count") });
      case "origin": return t("cbc.req.origin", { only: tOr(`cbc.origin.${String(a.only)}`, String(a.only)) });
      case "noBuy": return t("cbc.req.noBuy");
      case "rediscovery": return t("cbc.req.rediscovery", { count: n("count"), days: n("idleDays", 60) });
      case "strictPosition": return t("cbc.req.strictPosition");
      default: return r.type;
    }
  }, [t, tOr, tierName]);
  const storyText = useCallback((line: CbcStoryLine): string => {
    if (line.text) return line.text[locale] ?? line.text["pt-BR"] ?? Object.values(line.text)[0] ?? "";
    if (!line.key) return "";
    const vars = storyVars(line.vars ?? {}, (c) => taxLabel(c));
    return hasMessage(locale, line.key) ? t(line.key, vars) : t("cbc.story.generic", vars);
  }, [t, locale]);
  return { tOr, slotLabel, tierName, requirement, storyText };
}

function windowOf(c: CbcSummary, t: (k: string, v?: Record<string, unknown>) => string): { tone: "thread" | "chalk" | "mark"; text: string } {
  const w = c.time;
  if (c.status === "ENDED") return { tone: "chalk", text: t("cbc.window.ended") };
  if (isOwnWindow(w) && w.always) return { tone: "thread", text: t("cbc.window.always") };
  if (c.status === "UPCOMING") { const d = Math.max(1, Math.ceil(w.startsInSeconds / 86400)); return { tone: "chalk", text: t("cbc.window.opens_in", { n: d }) }; }
  const days = w.daysLeft ?? Math.max(1, Math.ceil(w.endsInSeconds / 86400));
  return { tone: "thread", text: t("cbc.window.ends_in", { n: days }) };
}

// ================================================================== lista
export function CbcList() {
  const { t } = useI18n();
  const data = useApi<CbcListData>((signal) => api.get("/api/flair/challenges", { signal }), []);
  return (
    <>
      <div className="flair-section-head">
        <Link href="/flair?mode=cbc" className="btn btn-sm"><UiIcon name="chevronLeft" size={18} />{t("flair.hub.back")}</Link>
        <PageHeader title={t("flair.hub.mode.cbc.title")} kicker={t("flair.hub.mode.cbc.kicker")}
          actions={<div className="flex flex-wrap items-center gap-2"><HowItWorks id="flair.cbc" />{data.data && <Badge tone="thread">{t("cbc.season", { season: data.data.season })}</Badge>}</div>} />
      </div>
      {data.error ? <ErrorState error={data.error} onRetry={data.reload} /> : data.loading || !data.data ? <SkeletonGrid /> : <CbcSections list={data.data} />}
    </>
  );
}

function CbcSections({ list }: { list: CbcListData }) {
  const { t } = useI18n();
  const empty = list.now.length + list.always.length + list.upcoming.length + list.groups.length + list.memories.length === 0;
  if (empty) return <EmptyState title={t("cbc.empty.title")} hint={t("cbc.empty.hint")} />;
  return (
    <div className="grid gap-6">
      <Section id="now" title={t("cbc.section.now")} items={list.now} />
      <Section id="always" title={t("cbc.section.always")} items={list.always} />
      <Section id="upcoming" title={t("cbc.section.upcoming")} items={list.upcoming} />
      {list.groups.length > 0 && <section aria-labelledby="cbc-groups"><h2 id="cbc-groups" className="type-h2 mb-3">{t("cbc.section.groups")}</h2><div className="grid gap-3 md:grid-cols-2">{list.groups.map((g) => <GroupCard key={g.code} g={g} />)}</div></section>}
      <Section id="memories" title={t("cbc.section.memories")} items={list.memories} />
    </div>
  );
}

function Section({ id, title, items }: { id: string; title: string; items: CbcSummary[] }) {
  if (items.length === 0) return null;
  return <section aria-labelledby={`cbc-${id}`}><h2 id={`cbc-${id}`} className="type-h2 mb-3">{title}</h2><div className="cbc-grid">{items.map((c) => <CbcCard key={c.id} c={c} />)}</div></section>;
}

export function CbcCard({ c }: { c: CbcSummary }) {
  const { t } = useI18n(); const { requirement } = useCbcLabels();
  const w = windowOf(c, t);
  const done = !!c.mine?.done;
  return (
    <article className={cn("cbc-card", c.status === "ENDED" && "is-ended")} aria-labelledby={`cbc-card-${c.id}`}>
      <Link href={`/flair/desafios/${encodeURIComponent(c.slug)}`} className="cbc-card-art" aria-hidden tabIndex={-1}><CbcSceneArt scenario={c.scenario} /><span className={cn("cbc-diff", `is-${c.difficulty.toLowerCase()}`)}>{t(`cbc.difficulty.${c.difficulty}`)}</span></Link>
      <div className="cbc-card-body">
        <div className="flex flex-wrap items-center gap-2"><Badge tone={w.tone}>{w.text}</Badge>{c.moment && <Badge>{c.moment.name}</Badge>}{done && <Badge tone="thread">{t("cbc.done")}</Badge>}</div>
        <h3 id={`cbc-card-${c.id}`} className="type-h3 mt-1">{c.name}</h3>
        {c.description && <p className="type-body-sm text-muted">{c.description}</p>}
        <ul className="cbc-reqs-mini">
          <li>{t("cbc.slots_n", { n: c.slotsCount })}</li>
          {c.requirements.map((r, i) => <li key={i}>{requirement(r)}</li>)}
          {c.levelOpen && c.requirements.length === 0 && <li>{t("cbc.any_level")}</li>}
        </ul>
        <div className="cbc-card-foot">
          <span className="cbc-points"><FaiIcon id="ACT-40" size={20} decorative /><b className="tabular">+{c.pointsPreview}</b>{c.multiplier !== 1 && <small className="tabular">×{c.multiplier}</small>}</span>
          <Link href={`/flair/desafios/${encodeURIComponent(c.slug)}`} className={cn("btn btn-sm", c.status !== "ENDED" && !done && "btn-primary")}>
            {c.status === "ENDED" ? t("cbc.see_memory") : done ? t("cbc.see_delivery") : c.status === "UPCOMING" ? t("cbc.prepare") : t("cbc.build")}
          </Link>
        </div>
      </div>
    </article>
  );
}

function GroupCard({ g }: { g: CbcGroup }) {
  const { t } = useI18n();
  return (
    <Card>
      <div className="flex items-start justify-between gap-2"><div><p className="type-label text-muted">{t("cbc.group")}</p><h3 className="type-h3">{g.name}</h3>{g.description && <p className="type-body-sm text-muted">{g.description}</p>}</div><span className="cbc-points"><FaiIcon id="ACT-40" size={20} decorative /><b className="tabular">+{g.points}</b></span></div>
      <div className="hype-bar mt-2"><i style={{ width: `${g.total ? (g.done / g.total) * 100 : 0}%`, background: "var(--thread)" }} /></div>
      <p className="type-caption tabular mt-1">{t("cbc.group_progress", { done: g.done, total: g.total })}{g.completed ? ` · ${t("cbc.done")}` : ""}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">{g.challenges.map((c) => <li key={c.id}><Link href={`/flair/desafios/${encodeURIComponent(c.slug)}`} className={cn("chip", c.done && "is-active")}>{c.done ? "✓ " : ""}{c.name}</Link></li>)}</ul>
    </Card>
  );
}

// ================================================================== montagem
export function CbcPlay({ slug }: { slug: string }) {
  const { t } = useI18n(); const toast = useToast(); const { slotLabel, requirement, storyText } = useCbcLabels();
  const detail = useApi<CbcDetail>((signal) => api.get(`/api/flair/challenges/${slug}`, { signal }), [slug]);
  const bank = useApi<FlairCollection>((signal) => api.get("/api/me/flair/cards", { signal }), []);
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [reading, setReading] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [check, setCheck] = useState<CbcCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CbcSubmitResult | null>(null);
  const [rewardOpen, setRewardOpen] = useState(false);
  const d = detail.data;
  const cards = useMemo(() => Object.fromEntries((bank.data?.cards ?? []).map((c) => [c.id, c])), [bank.data]);
  const available = useMemo(() => (bank.data?.cards ?? []).filter((c) => c.state === "AVAILABLE"), [bank.data]);
  const interpretation = reading ?? d?.suggestedInterpretation ?? OWN_READING;
  const filled = Object.keys(placed).length;
  const readOnly = !!d && (d.status === "ENDED" || !!d.mine?.done);

  // conferência automática no servidor a cada mudança (sem gravar nada); a resposta mais recente vence
  const seq = useRef(0);
  useEffect(() => {
    if (!d || readOnly) return;
    if (filled === 0) { setCheck(null); return; }
    const my = ++seq.current; setChecking(true);
    const h = setTimeout(async () => {
      try { const r = await api.post<CbcCheck>(`/api/flair/challenges/${slug}/check`, { slots: placed, interpretation }); if (my === seq.current) setCheck(r); }
      catch (e) { if (my === seq.current) toast.fromError(e); }
      finally { if (my === seq.current) setChecking(false); }
    }, 450);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, interpretation, slug, readOnly, !!d]);

  if (detail.error) return <ErrorState error={detail.error} onRetry={detail.reload} />;
  if (detail.loading || !d) return <Skeleton className="h-96" />;
  const ev = check?.evaluation; const w = windowOf(d, t);
  const placedCards: Record<string, FlairCollectionCard | undefined> = Object.fromEntries(Object.entries(placed).map(([k, v]) => [k, cards[v]]));
  const delivered = d.mySubmissions[0];
  const canSubmit = !readOnly && d.status === "OPEN" && !!ev?.ok && ev.complete && (check?.canSubmit ?? true) && !submitting;

  const place = (slot: string, cardId: string) => {
    setPlaced((p) => { const n = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== cardId)); n[slot] = cardId; return n; });
    setPicking(null);
  };
  const remove = (slot: string) => { setPlaced((p) => { const n = { ...p }; delete n[slot]; return n; }); setPicking(null); };
  async function submit() {
    setSubmitting(true);
    try {
      const r = await api.post<CbcSubmitResult>(`/api/flair/challenges/${slug}/submit`, { slots: placed, interpretation });
      setResult(r); setRewardOpen(true); detail.reload(); bank.reload();
    } catch (e) { toast.fromError(e); } finally { setSubmitting(false); }
  }

  return (
    <>
      <div className="flair-section-head">
        <Link href="/flair/desafios" className="btn btn-sm"><UiIcon name="chevronLeft" size={18} />{t("cbc.back_to_list")}</Link>
        <PageHeader title={d.name} kicker={`${t("flair.hub.mode.cbc.title")} · ${t(`cbc.difficulty.${d.difficulty}`)}`}
          actions={<div className="flex flex-wrap items-center gap-2"><HowItWorks id="flair.cbc" /><Badge tone={w.tone}>{w.text}</Badge>{d.moment && <Badge>{d.moment.name}</Badge>}</div>} />
      </div>
      {d.description && <p className="type-body-lg mb-4 max-w-prose">{d.description}</p>}
      {d.status === "UPCOMING" && <p className="cbc-note" role="note">{t("cbc.note.upcoming")}</p>}
      {d.status === "ENDED" && <p className="cbc-note" role="note">{t("cbc.note.ended")}</p>}
      {delivered && d.status !== "ENDED" && <p className="cbc-note" role="note">{t("cbc.note.delivered", { attempt: delivered.attempt, sintonia: delivered.sintonia, max: delivered.sintoniaMax })}</p>}

      {readOnly && delivered ? <SubmissionView s={delivered} scenario={d.scenario} slots={d.slots} /> : (
        <div className="cbc-play">
          <div className="cbc-play-stage">
            <CbcScene scenario={d.scenario} slots={d.slots} placed={placedCards} results={ev?.slots} labelOf={(s) => slotLabel(d.scenario, s)} onPick={(s) => setPicking(s)} />
            {available.length === 0 && !bank.loading && <EmptyState title={t("cbc.no_cards.title")} hint={t("cbc.no_cards.hint")} action={<Link href="/pieces/new" className="btn btn-sm btn-primary">{t("common.cadastrar_peca")}</Link>} />}
            {check && check.story.length > 0 && <Story lines={check.story} text={storyText} />}
          </div>
          <aside className="cbc-play-side" aria-label={t("cbc.side_label")}>
            {d.interpretations.length > 0 && (
              <div className="cbc-block">
                <p className="label">{t("cbc.reading")}</p>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("cbc.reading")}>
                  {d.interpretations.map((i) => <Chip key={i.key} role="radio" aria-checked={interpretation === i.key} active={interpretation === i.key} onClick={() => setReading(i.key)}>{i.label ?? i.key}</Chip>)}
                  <Chip role="radio" aria-checked={interpretation === OWN_READING} active={interpretation === OWN_READING} onClick={() => setReading(OWN_READING)}>{t("cbc.reading_own")}</Chip>
                </div>
              </div>
            )}
            <div className="cbc-block">
              <div className="flex items-center justify-between gap-2"><p className="label">{t("cbc.requirements")}</p>{checking && <span className="type-caption text-muted" aria-live="polite">{t("cbc.checking")}</span>}</div>
              <ul className="cbc-reqs">
                <li className={cn(ev && ev.complete && "is-ok")}><span className="cbc-req-mark" aria-hidden>{ev?.complete ? "✓" : "○"}</span><span>{t("cbc.req.fill_all", { n: d.slots.length })}</span><b className="tabular">{filled}/{d.slots.length}</b></li>
                {(ev?.requirements ?? d.requirements.map((r) => ({ ...r, ok: false, have: 0, need: 0, args: r }) as CbcRequirementResult)).map((r, i) => (
                  <li key={i} className={cn(r.ok && "is-ok")}><span className="cbc-req-mark" aria-hidden>{r.ok ? "✓" : "○"}</span><span>{requirement(r)}</span>{ev && <b className="tabular">{r.have}/{r.need}</b>}<span className="sr-only">{r.ok ? t("flair.cumprido") : t("flair.faltando")}</span></li>
                ))}
                {d.requirements.length === 0 && <li className="is-ok"><span className="cbc-req-mark" aria-hidden>✓</span><span>{t("cbc.any_level")}</span></li>}
              </ul>
            </div>
            <div className="cbc-block">
              <p className="label">{t("cbc.sintonia")}</p>
              <div className="cbc-sync"><div className="hype-bar"><i style={{ width: `${ev && ev.sintoniaMax ? (ev.sintonia / ev.sintoniaMax) * 100 : 0}%`, background: "var(--thread)" }} /></div><b className="tabular">{ev ? `${ev.sintonia}/${ev.sintoniaMax}` : `0/${d.slots.length * 3}`}</b></div>
              <p className="type-caption text-muted">{t("cbc.sintonia_hint")}</p>
            </div>
            <div className="cbc-block">
              <p className="label">{t("cbc.points_preview")}</p>
              <ul className="cbc-lines">
                {(check?.points.lines ?? [{ action: "FLAIR_CBC", points: d.pointsPreview, ref: d.id, label: t("cbc.line.FLAIR_CBC") }]).map((l, i) => <PointsLine key={i} l={l} />)}
              </ul>
              <p className="cbc-total"><FaiIcon id="ACT-40" size={24} decorative /><b className="tabular">+{check?.points.total ?? d.pointsPreview}</b><span className="type-caption text-muted">{t("cbc.points_after_confirm")}</span></p>
              {d.locksCards && <p className="type-caption text-muted">{t("cbc.locks_note")}</p>}
              {d.mine && d.repeatLimit > 1 && <p className="type-caption text-muted tabular">{t("cbc.attempts_left", { n: d.mine.attemptsLeft })}</p>}
            </div>
            <div className="cbc-actions">
              <Button variant="primary" size="lg" disabled={!canSubmit} loading={submitting} onClick={submit}>{d.status === "UPCOMING" ? t("cbc.submit_when_open") : t("cbc.submit")}</Button>
              <Button size="lg" disabled={filled === 0} onClick={() => setPlaced({})}>{t("cbc.clear")}</Button>
            </div>
          </aside>
        </div>
      )}

      {(d.communityOpen && d.community.length > 0) && (
        <section className="mt-6" aria-labelledby="cbc-community"><h2 id="cbc-community" className="type-h2 mb-3">{t("cbc.community")}</h2>
          <div className="grid gap-3 md:grid-cols-2">{d.community.map((s) => <SubmissionView key={s.id} s={s} scenario={d.scenario} slots={d.slots} compact />)}</div></section>
      )}
      <section className="mt-6" aria-labelledby="cbc-memory">
        <h2 id="cbc-memory" className="type-h2 mb-2">{t("cbc.memory")}</h2>
        <p className="type-body">{t("cbc.memory_numbers", { builds: d.memory.builds, people: d.memory.people, avg: d.memory.averageSintonia ?? 0 })}</p>
        {d.memory.readings && d.memory.readings.length > 0 && <ul className="mt-2 flex flex-wrap gap-1.5">{d.memory.readings.map((r) => <li key={r.key} className={cn("chip", r.rare && "is-rare")}>{r.key === OWN_READING ? t("cbc.reading_own") : r.label ?? r.key} · {r.pct}%{r.rare ? ` · ${t("cbc.reading_rare")}` : ""}</li>)}</ul>}
      </section>

      <Dialog open={!!picking} onClose={() => setPicking(null)} size="lg" title={picking ? t("cbc.pick_title", { slot: slotLabel(d.scenario, d.slots.find((s) => s.key === picking) ?? { key: picking }) }) : ""}
        footer={picking && placed[picking] ? <Button onClick={() => remove(picking)}>{t("cbc.remove_card")}</Button> : undefined}>
        {picking && <Picker slot={d.slots.find((s) => s.key === picking)!} cards={available} placed={placed} onPick={(id) => place(picking, id)} />}
      </Dialog>

      <CbcRewardDialog open={rewardOpen} result={result} challenge={d} onClose={() => setRewardOpen(false)} text={storyText} />
    </>
  );
}

function Picker({ slot, cards, placed, onPick }: { slot: CbcSlot; cards: FlairCollectionCard[]; placed: Record<string, string>; onPick: (id: string) => void }) {
  const { t } = useI18n();
  const used = new Set(Object.values(placed));
  const fits = (c: FlairCollectionCard) => slot.position === "ANY" || c.position === slot.position;
  const sorted = [...cards].sort((a, b) => Number(fits(b)) - Number(fits(a)) || b.ovr - a.ovr);
  if (sorted.length === 0) return <EmptyState title={t("cbc.no_cards.title")} hint={t("cbc.no_cards.hint")} />;
  return (
    <div>
      <p className="type-body-sm text-muted mb-2">{slot.position === "ANY" ? t("cbc.pick_any") : t("cbc.pick_position", { position: t(`cbc.position.${slot.position}`) })}</p>
      <ul className="cbc-picker" aria-label={t("cbc.bank")}>
        {sorted.map((c) => {
          const here = placed[slot.key] === c.id; const elsewhere = !here && used.has(c.id);
          return (
            <li key={c.id}>
              <button type="button" className={cn("cbc-pick", here && "is-here", elsewhere && "is-elsewhere", !fits(c) && "is-off")} onClick={() => onPick(c.id)} aria-pressed={here}
                aria-label={`${c.name} · ${c.position} · ${c.ovr}${here ? ` · ${t("cbc.pick_here")}` : elsewhere ? ` · ${t("cbc.pick_move")}` : ""}`}>
                <FlairGameCard card={c} size="sm" flip={false} />
                <span className="cbc-pick-tag">{here ? t("cbc.pick_here") : elsewhere ? t("cbc.pick_move") : fits(c) ? t(`cbc.position.${c.position}`) : t("cbc.pick_off", { position: t(`cbc.position.${c.position}`) })}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Story({ lines, text }: { lines: CbcStoryLine[]; text: (l: CbcStoryLine) => string }) {
  const { t } = useI18n();
  return (
    <div className="cbc-story" aria-live="polite">
      <p className="label">{t("cbc.story")}</p>
      <ol>{lines.map((l, i) => { const s = text(l); return s ? <li key={i} className={cn(l.slot && "is-slot")}>{s}{l.sintonia != null && l.slot && <span className="cbc-story-sync" aria-label={t("cbc.slot.sintonia", { n: l.sintonia })}>{"●".repeat(l.sintonia)}{"○".repeat(Math.max(0, 3 - l.sintonia))}</span>}</li> : null; })}</ol>
    </div>
  );
}

function PointsLine({ l }: { l: CbcPointsLine }) {
  const { t } = useI18n();
  const state = l.granted ? "credited" : l.capReached ? "cap" : "preview";
  return <li className={cn("cbc-line", `is-${state}`)}><span>{l.label || t(`cbc.line.${l.action}`)}</span><span className="cbc-line-state">{t(`cbc.state.${state}`)}</span><b className="tabular">+{l.points}</b></li>;
}

function SubmissionView({ s, scenario, slots, compact }: { s: CbcSubmission; scenario: string; slots: CbcSlot[]; compact?: boolean }) {
  const { t, fmtDate } = useI18n(); const { slotLabel, storyText } = useCbcLabels();
  const bySlot = new Map(s.cards.map((c) => [c.slot, c]));
  return (
    <article className={cn("cbc-submission", compact && "is-compact")}>
      <div className="flex flex-wrap items-center gap-2">
        {s.user ? <b>@{s.user.username}</b> : <b>{t("cbc.you")}</b>}
        <span className="type-caption text-muted">{fmtDate(s.createdAt)} · {t("cbc.attempt", { n: s.attempt })}</span>
        <Badge tone="thread">{t("cbc.sintonia")} {s.sintonia}/{s.sintoniaMax}</Badge>
        {s.points != null && <Badge tone="chalk"><FaiIcon id="ACT-40" size={20} decorative /> +{s.points}</Badge>}
      </div>
      <ul className="cbc-snap">{slots.map((sl) => { const c = bySlot.get(sl.key); return (
        <li key={sl.key}><span className="type-caption text-muted">{slotLabel(scenario, sl)}</span>
          {c ? c.hidden ? <span className="cbc-snap-hidden">{t("cbc.hidden_card", { tier: t(`flairCard.tier.${c.tier}`) })}</span> : <span className={cn("cbc-snap-card", `tier-${c.tier.toLowerCase()}`)}>{c.imageUrl && <img src={mediaUrl(c.imageUrl)} alt="" loading="lazy" />}<b className="tabular">{c.ovr}</b><em>{c.name}</em></span> : <span className="text-faint">—</span>}
        </li>); })}</ul>
      {!compact && s.story.length > 0 && <Story lines={s.story} text={storyText} />}
    </article>
  );
}

/**
 * Modal de recompensa: abre uma vez por entrega, com a resposta do servidor. Cada linha mostra o estado real: creditada
 * (o servidor confirmou), teto diário (validada, mas sem crédito) ou prevista. Nada é anunciado como recebido antes
 * da confirmação. Ícone oficial de FAI Points; foco inicial no botão principal; Esc fecha.
 */
export function CbcRewardDialog({ open, result, challenge, onClose, text }: { open: boolean; result: CbcSubmitResult | null; challenge: CbcDetail; onClose: () => void; text: (l: CbcStoryLine) => string }) {
  const { t } = useI18n();
  if (!result) return null;
  const credited = result.points.lines.filter((l) => l.granted).reduce((a, l) => a + l.points, 0);
  const pending = result.points.lines.filter((l) => !l.granted && !l.capReached).reduce((a, l) => a + l.points, 0);
  return (
    <Dialog open={open} onClose={onClose} size="lg" title={t("cbc.reward.title")}
      footer={<><Link href="/flair/desafios" className="btn">{t("cbc.back_to_list")}</Link><Button variant="primary" onClick={onClose} data-autofocus>{t("cbc.reward.close")}</Button></>}>
      <div className="cbc-reward">
        <div className="cbc-reward-head">
          <FlairHubIcon id="cbc" size={28} state="selected" />
          <div><p className="type-label text-muted">{challenge.name}</p><p className="type-h2">{t("cbc.reward.sintonia", { n: result.evaluation.sintonia, max: result.evaluation.sintoniaMax })}</p></div>
        </div>
        <ul className="cbc-lines">{result.points.lines.map((l, i) => <PointsLine key={i} l={l} />)}</ul>
        <p className="cbc-total is-big"><FaiIcon id="ACT-40" size={32} decorative /><b className="tabular">+{credited}</b><span className="type-body-sm">{t("cbc.reward.credited")}</span>{pending > 0 && <span className="type-caption text-muted">{t("cbc.reward.pending", { n: pending })}</span>}</p>
        {result.group && <p className="type-body"><b>{result.group.name}</b> · {t("cbc.group_progress", { done: result.group.done, total: result.group.total })}{result.group.completed ? ` · ${t("cbc.done")}` : ""}</p>}
        {result.locked && <p className="type-caption text-muted">{t("cbc.reward.locked")}</p>}
        {result.story.length > 0 && <Story lines={result.story} text={text} />}
        <p className="type-caption text-muted">{t("cbc.reward.where")}</p>
      </div>
    </Dialog>
  );
}
