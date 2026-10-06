"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { label as taxLabel } from "@/lib/api/taxonomy";
import { statusAt } from "@/lib/moments/time";
import type { MomentDetail } from "@/lib/moments/types";
import { Badge, Button, Card, ErrorState, Skeleton, Tabs, cn, useToast } from "@/components/ui";
import { JoinDialog, SubmitDialog } from "./moment-actions";
import { MomentFeed, MomentLeaderboard, MomentMemoryView, MomentTrending } from "./moment-community";
import { MomentMatchBreakdown, MomentScoreGrid } from "./moment-scores";
import { MomentCountdown, MomentIcon, MomentThemed, MomentTypeBadge, participationLabel, pointsBonusLabel, useLocalRange, useMomentClock } from "./moment-shared";

type Tab = "overview" | "challenges" | "community" | "ranking" | "memory";

/**
 * MomentPage genérica (§52): recebe tema, regras e conteúdo como DADOS. Não existe HalloweenPage — Halloween, Carnaval
 * ou um Momento privado do grupo usam esta mesma tela. Estrutura: cabeçalho temático → visão geral (interpretações,
 * regras, bônus, meu status) → desafios → comunidade (feed + votação) → ranking/meta → memória (quando terminou).
 */
export function MomentPage({ idOrSlug }: { idOrSlug: string }) {
  const { t } = useI18n(); const { user } = useAuth(); const toast = useToast(); const sp = useSearchParams(); const range = useLocalRange(); const now = useMomentClock();
  const { data, loading, error, reload } = useApi<MomentDetail>((signal) => api.get(`/api/moments/${encodeURIComponent(idOrSlug)}`, { signal, anonymous: !user }), [idOrSlug, !!user]);
  const [at, setAt] = useState(Date.now()); useEffect(() => { if (data) setAt(Date.now()); }, [data]);
  const initial = sp.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(initial && ["overview", "challenges", "community", "ranking", "memory"].includes(initial) ? initial : "overview");
  const [join, setJoin] = useState(false); const [submit, setSubmit] = useState(false);
  if (error) return <ErrorState error={error} onRetry={reload} page />;
  if (loading || !data) return <Skeleton className="h-96" />;
  const m = data; const status = statusAt(m.time, at, now);
  const joined = !!m.me && m.me.status !== "INTERESTED" && m.me.status !== "LEFT"; const saved = m.me?.status === "INTERESTED";
  const bonus = pointsBonusLabel(t, m); const me = participationLabel(t, m.me);
  async function save(remind: boolean) { try { await api.put(`/api/moments/${encodeURIComponent(m.slug)}/save`, { remind }); toast.success(t("moments.saved")); reload(); } catch (e) { toast.fromError(e); } }
  async function unsave() { try { await api.delete(`/api/moments/${encodeURIComponent(m.slug)}/save`); reload(); } catch (e) { toast.fromError(e); } }
  async function leave() { try { await api.post(`/api/moments/${encodeURIComponent(m.slug)}/leave`); toast.success(t("moments.left")); reload(); } catch (e) { toast.fromError(e); } }
  const tabs = [{ id: "overview" as Tab, label: t("moments.tab.overview") }, ...(m.challenges.length ? [{ id: "challenges" as Tab, label: t("moments.tab.challenges"), count: m.challenges.length }] : []),
    { id: "community" as Tab, label: t("moments.tab.community"), count: m.stats.looks ?? undefined }, { id: "ranking" as Tab, label: m.cooperative ? t("moments.tab.goal") : t("moments.tab.ranking") },
    ...(status === "ENDED" ? [{ id: "memory" as Tab, label: t("moments.tab.memory") }] : [])];
  const ask = encodeURIComponent(t("moments.copilot_prompt", { name: m.name }));
  return (
    <>
      <p className="type-label text-muted"><Link href="/moments" className="underline">{t("nav.moments")}</Link>{m.group ? <> · <Link href="/moments?tab=flair" className="underline">{m.group.name}</Link></> : null}</p>
      <MomentThemed as="header" theme={m.theme} className="moment-hero moment-page-head" aria-labelledby="mp-title">
        <div className="moment-hero-art" aria-hidden />
        <div className="moment-hero-body">
          <div className="flex items-start gap-3">
            <MomentIcon theme={m.theme} size={48} />
            <div className="min-w-0 flex-1">
              <h1 id="mp-title" className="type-display moment-hero-title">{m.name}</h1>
              <p className="type-body-sm moment-hero-sub">{range(m.time)} · <span className={cn("moment-status", `is-${status.toLowerCase()}`)}>{t(`moments.status.${status}`)}</span> · <MomentCountdown time={m.time} receivedAt={at} /></p>
              <div className="mt-2"><MomentTypeBadge m={m} /></div>
            </div>
          </div>
          {m.description && <p className="type-body mt-3 moment-hero-sub max-w-2xl">{m.description}</p>}
          <div className="moment-hero-facts mt-3">
            {bonus && status !== "ENDED" && <span className="moment-fact"><b>{bonus}</b></span>}
            {m.stats.participants != null && <span className="moment-fact">{t("moments.participants_count", { n: m.stats.participants })}</span>}
            {m.stats.looks != null && <span className="moment-fact">{t("moments.looks_count", { n: m.stats.looks })}</span>}
            {me && <span className="moment-fact moment-me">{me}</span>}
          </div>
          <div className="moment-hero-cta">
            {user && status === "ACTIVE" && !joined && <Button variant="primary" onClick={() => setJoin(true)}>{t("moments.cta.join")}</Button>}
            {user && status === "ACTIVE" && joined && <Button variant="primary" onClick={() => setSubmit(true)}>{t("moments.cta.send_look")}</Button>}
            {user && status === "SCHEDULED" && !saved && !joined && <Button variant="primary" onClick={() => save(true)}>{t("moments.cta.remind_me")}</Button>}
            {user && status === "SCHEDULED" && (saved || joined) && <Button onClick={unsave}>{t("moments.cta.remove_reminder")}</Button>}
            {user && status === "SCHEDULED" && !joined && <Button onClick={() => setJoin(true)}>{t("moments.cta.prepare")}</Button>}
            {!user && <Link href={`/login?next=/moments/${m.slug}`} className="btn btn-primary">{t("nav.login")}</Link>}
            {status !== "ENDED" && <Link href={`/schemes/new?moment=${encodeURIComponent(m.slug)}`} className="btn">{t("moments.cta.create_look")}</Link>}
            {status !== "ENDED" && <Link href={`/copilot?ask=${ask}`} className="btn">{t("moments.cta.ask_copilot")}</Link>}
            {user && joined && status === "ACTIVE" && m.me?.status !== "COMPLETED" && <Button variant="ghost" onClick={leave}>{t("moments.cta.leave")}</Button>}
          </div>
        </div>
      </MomentThemed>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "overview" && <Overview m={m} />}
      {tab === "challenges" && <Challenges m={m} onPick={() => setSubmit(true)} canSubmit={!!user && joined && status === "ACTIVE"} />}
      {tab === "community" && <><MomentTrending trending={m.trending} /><div className="mt-4"><MomentFeed moment={m} /></div></>}
      {tab === "ranking" && <MomentLeaderboard moment={m} />}
      {tab === "memory" && <MomentMemoryView memory={m.memory} moment={m} />}
      {user && <JoinDialog moment={m} open={join} onClose={() => setJoin(false)} onJoined={reload} />}
      {user && <SubmitDialog moment={m} open={submit} onClose={() => setSubmit(false)} onSubmitted={reload} />}
    </>
  );
}

function Overview({ m }: { m: MomentDetail }) {
  const { t } = useI18n();
  const rulesText = typeof m.rules?.text === "string" ? m.rules.text : null; const theme = typeof m.rules?.theme === "string" ? m.rules.theme : null;
  const bonus = Object.entries(m.bonusRules ?? {});
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-4">
        {m.interpretations.length > 0 && <Card><p className="label">{t("moments.interpretations_label")}</p><p className="type-body-sm text-muted mb-2">{t("moments.interpretations_hint")}</p>
          <ul className="moment-interps">{m.interpretations.map((i) => <li key={i.key} className="moment-interp"><b>{i.label ?? i.key}</b>{(i.styleTags.length > 0 || i.colorTags.length > 0) && <span className="type-caption text-muted block">{[...i.styleTags, ...i.colorTags].map(taxLabel).join(" · ")}</span>}</li>)}</ul></Card>}
        {(m.styleTags.length > 0 || m.colorTags.length > 0 || m.occasionTags.length > 0) && <Card><p className="label">{t("moments.tags_label")}</p>
          <div className="grid gap-1 type-body-sm">{m.styleTags.length > 0 && <p><span className="text-muted">{t("moments.tags.styles")}:</span> {m.styleTags.map(taxLabel).join(", ")}</p>}{m.colorTags.length > 0 && <p><span className="text-muted">{t("moments.tags.colors")}:</span> {m.colorTags.map(taxLabel).join(", ")}</p>}{m.occasionTags.length > 0 && <p><span className="text-muted">{t("moments.tags.occasions")}:</span> {m.occasionTags.map(taxLabel).join(", ")}</p>}</div></Card>}
        {(rulesText || theme || m.requiredItems.length > 0 || m.suggestedItems.length > 0) && <Card><p className="label">{t("moments.rules_label")}</p>{theme && <p className="type-body"><b>{t("moments.theme_label")}:</b> {theme}</p>}{rulesText && <p className="type-body whitespace-pre-wrap">{rulesText}</p>}{m.requiredItems.length > 0 && <p className="type-body-sm mt-1"><span className="text-muted">{t("moments.required_items")}:</span> {m.requiredItems.map(taxLabel).join(", ")}</p>}{m.suggestedItems.length > 0 && <p className="type-body-sm"><span className="text-muted">{t("moments.suggested_items")}:</span> {m.suggestedItems.map(taxLabel).join(", ")}</p>}</Card>}
        {m.sensitive && <Card><p className="type-body-sm">{t("moments.sensitive_note")}</p></Card>}
        {(m.sourceUrl || m.sourceNote) && <Card><p className="label">{t("moments.source_label")}</p>{m.sourceNote && <p className="type-body-sm">{m.sourceNote}</p>}{m.sourceUrl && <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline type-body-sm break-all">{m.sourceUrl}</a>}</Card>}
        {m.mySubmissions && m.mySubmissions.length > 0 && <Card><p className="label">{t("moments.my_entries")}</p><ul className="fai-list">{m.mySubmissions.map((s) => <li key={s.id} className="py-2"><p className="type-body-sm font-semibold"><Link href={`/schemes/${s.schemeId}`} className="underline">{s.scheme?.title ?? t("moments.community.look")}</Link> · {t("common.votos", { value: s.votes })}</p><MomentMatchBreakdown match={s.matchDetail} /><MomentScoreGrid scores={{ moment: s.match, hype: s.scheme?.hypeScore, contextualHype: s.contextualHype }} /></li>)}</ul></Card>}
      </div>
      <div className="grid gap-4 content-start">
        {m.pointsEnabled && <Card><p className="label">{t("moments.points_label")}</p>
          <ul className="fai-list type-body-sm">
            <li className="flex justify-between py-1"><span>{t("moments.points_line.look")}</span><b className="tabular">+{Math.round(m.basePoints * m.pointsMultiplier)}</b></li>
            {bonus.map(([k, v]) => <li key={k} className="flex justify-between py-1"><span>{t(`moments.points_line.${k}`)}</span><b className="tabular">+{v}</b></li>)}
            {m.challenges.map((c) => <li key={c.id} className="flex justify-between py-1"><span>{c.name}</span><b className="tabular">+{c.points}</b></li>)}
          </ul>
          <p className="type-caption text-muted mt-2">{t("moments.points_note")}</p></Card>}
        {m.me && <Card><p className="label">{t("moments.me.title")}</p><p className="type-body">{participationLabel(t, m.me)}</p>{m.me.approach && <p className="type-caption text-muted">{t(`moments.join.${m.me.approach === "MY_STYLE" ? "my_style" : m.me.approach === "DISCOVERY" ? "discovery" : "experimental"}`)}</p>}{m.me.pointsEarned > 0 && <p className="type-caption tabular">{t("moments.submit.points_total", { n: m.me.pointsEarned })}</p>}{m.me.bestMatch != null && <p className="type-caption tabular">{t("moments.scores.moment")} {m.me.bestMatch}</p>}{m.me.badgeCode && <Badge tone="chalk" className="mt-1">{t("moments.timeline.badge")}</Badge>}</Card>}
        {m.group && <Card><p className="label">{t("moments.group_label")}</p><p className="type-body">{m.group.name}</p>{m.participants && <ul className="fai-list mt-1">{m.participants.map((p) => <li key={p.user.id} className="py-1 type-body-sm">@{p.user.username} <span className="type-caption text-muted">· {t(`moments.participation.${p.status}`)}</span></li>)}</ul>}</Card>}
      </div>
    </div>
  );
}

function Challenges({ m, onPick, canSubmit }: { m: MomentDetail; onPick: () => void; canSubmit: boolean }) {
  const { t } = useI18n();
  return (
    <div className="grid-looks">
      {m.challenges.map((c) => (
        <MomentThemed as="article" key={c.id} theme={m.theme} className="moment-card">
          <div className="flex items-start justify-between gap-2"><h3 className="type-h3">{c.name}</h3><b className="tabular">+{c.points}</b></div>
          <p className="type-caption text-muted">{t(`moments.kind.${c.kind}`)}</p>
          {c.description && <p className="type-body-sm mt-1">{c.description}</p>}
          {(c.styleTags.length > 0 || c.colorTags.length > 0) && <ul className="moment-tags mt-1">{[...c.styleTags, ...c.colorTags].map((x) => <li key={x} className="moment-tag">{taxLabel(x)}</li>)}</ul>}
          {typeof c.params?.looksRequired === "number" && <p className="type-caption mt-1">{t("moments.kind_param.looks_required", { n: c.params.looksRequired as number })}</p>}
          {typeof c.params?.idleDays === "number" && <p className="type-caption mt-1">{t("moments.kind_param.idle_days", { n: c.params.idleDays as number })}</p>}
          {canSubmit && <Button size="sm" className="mt-2" onClick={onPick}>{t("moments.cta.send_look")}</Button>}
        </MomentThemed>
      ))}
    </div>
  );
}
