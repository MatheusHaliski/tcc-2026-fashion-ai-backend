"use client";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { label as taxLabel } from "@/lib/api/taxonomy";
import type { Leaderboard, MemoryLook, MomentDetail, MomentMemory, Submission, Trending, VoteDimension } from "@/lib/moments/types";
import { VOTE_DIMENSIONS } from "@/lib/moments/types";
import { Avatar, Badge, Card, EmptyState, ErrorState, Skeleton, cn, useToast } from "@/components/ui";
import { SchemeCard } from "@/components/scheme-card";

/** Feed do Momento (§8 "ver comunidade") com votação por dimensão (§32) — nunca só "like". */
export function MomentFeed({ moment }: { moment: MomentDetail }) {
  const { t } = useI18n(); const { user } = useAuth(); const toast = useToast();
  const feed = useApi<{ items: Submission[]; dimensions: VoteDimension[] }>((signal) => api.get(`/api/moments/${encodeURIComponent(moment.slug)}/feed`, { signal, anonymous: !user }), [moment.slug, !!user]);
  async function vote(s: Submission, dim: VoteDimension) {
    try { await api.post(`/api/moments/${encodeURIComponent(moment.slug)}/votes`, { submissionId: s.id, dimension: dim }); feed.reload(); } catch (e) { toast.fromError(e); }
  }
  if (feed.error) return <ErrorState error={feed.error} onRetry={feed.reload} />;
  if (feed.loading || !feed.data) return <Skeleton className="h-48" />;
  const items = feed.data.items; const canVote = !!user && moment.competitive && moment.time.status === "ACTIVE";
  if (items.length === 0) return <EmptyState title={t("moments.community.empty")} hint={t("moments.community.empty_hint")} />;
  return (
    <div className="grid-looks">
      {items.map((s) => (
        <div key={s.id} className={cn("moment-entry", s.mine && "is-mine")}>
          {s.scheme ? <SchemeCard scheme={s.scheme} /> : <div className="surface p-3"><p className="type-body-sm">{t("moments.community.look_unavailable")}</p></div>}
          <div className="moment-entry-meta">
            <span className="type-caption tabular" title={t("moments.scores.moment_hint")}>{t("moments.scores.moment")} {s.match ?? "—"}</span>
            {s.contextualHype != null && <span className="type-caption tabular" title={t("moments.scores.contextual_hype_hint")}>{t("moments.scores.contextual_hype")} {s.contextualHype}</span>}
            {s.wardrobeOnly && <Badge tone="thread">{t("moments.community.wardrobe_only")}</Badge>}
            {s.rediscovered > 0 && <Badge tone="chalk">{t("moments.community.rediscovered", { n: s.rediscovered })}</Badge>}
          </div>
          {moment.competitive && <div className="moment-vote-row" role="group" aria-label={t("moments.community.vote_label")}>
            {VOTE_DIMENSIONS.map((d) => <button key={d} type="button" className={cn("chip", s.votedByMe && "is-voted")} disabled={!canVote || s.mine} aria-pressed={undefined} onClick={() => vote(s, d)} title={s.mine ? t("moments.community.own_look") : t(`moments.vote.${d}_hint`)}>{t(`moments.vote.${d}`)}</button>)}
            <span className="type-caption tabular text-muted">{t("common.votos", { value: s.votes })}</span>
          </div>}
        </div>
      ))}
    </div>
  );
}

/** Ranking (§36) — só Momentos competitivos; no cooperativo mostra a meta do grupo (§31). */
export function MomentLeaderboard({ moment }: { moment: MomentDetail }) {
  const { t } = useI18n(); const { user } = useAuth();
  const lb = useApi<Leaderboard>((signal) => api.get(`/api/moments/${encodeURIComponent(moment.slug)}/leaderboard`, { signal, anonymous: !user }), [moment.slug, !!user]);
  if (lb.error) return <ErrorState error={lb.error} onRetry={lb.reload} />;
  if (lb.loading || !lb.data) return <Skeleton className="h-32" />;
  if (!lb.data.competitive) {
    if (lb.data.cooperative) { const c = lb.data.cooperative; const f = Math.min(1, c.looks / Math.max(1, c.goal)); return <Card><p className="label">{t("moments.coop.title")}</p><p className="type-body">{t("moments.coop.progress", { looks: c.looks, goal: c.goal })}</p><div className="hype-bar mt-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(f * 100)} aria-label={t("moments.coop.title")}><i style={{ width: `${f * 100}%`, background: "var(--moment-accent, var(--thread))" }} /></div><p className="type-caption text-muted mt-1">{t("moments.coop.hint")}</p></Card>; }
    return <p className="type-body-sm text-muted">{moment.sensitive ? t("moments.sensitive_note") : t("moments.leaderboard.off")}</p>;
  }
  if (lb.data.items.length === 0) return <EmptyState title={t("moments.leaderboard.empty")} />;
  return (
    <ol className="moment-leaderboard" aria-label={t("moments.leaderboard.title")}>
      {lb.data.items.map((r) => (
        <li key={r.submissionId} className={cn("moment-rank", r.you && "is-you")}>
          <span className="moment-rank-pos tabular" aria-label={t("moments.leaderboard.position", { n: r.position })}>{r.position}</span>
          <span className="moment-look-thumb">{r.coverImageUrl ? <img src={mediaUrl(r.coverImageUrl)} alt="" /> : null}</span>
          <span className="min-w-0 flex-1"><Link href={`/schemes/${r.schemeId}`} className="type-body-sm font-semibold truncate block">{r.title ?? t("moments.community.look")}</Link>
            <span className="type-caption text-muted">{r.user ? <><Avatar src={mediaUrl(r.user.avatarUrl)} name={r.user.username} size={16} /> @{r.user.username}</> : t("moments.leaderboard.anonymous")}{r.you ? ` · ${t("moments.leaderboard.you")}` : ""}</span></span>
          <span className="type-data tabular">{t("common.votos", { value: r.votes })}</span>
          <span className="type-caption tabular text-muted" title={t("moments.scores.moment_hint")}>{r.match ?? "—"}</span>
        </li>
      ))}
    </ol>
  );
}

/** "Em alta neste Momento" (§36): estilos, cores, interpretações e looks com maior Hype contextual. */
export function MomentTrending({ trending }: { trending?: Trending | null }) {
  const { t } = useI18n();
  if (!trending || trending.basis === 0) return null;
  return (
    <Card>
      <p className="label">{t("moments.trending.title")}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <TrendList title={t("moments.trending.styles")} items={trending.styles.map((x) => ({ k: taxLabel(x.key), n: x.count }))} />
        <TrendList title={t("moments.trending.colors")} items={trending.colors.map((x) => ({ k: taxLabel(x.key), n: x.count }))} />
        <TrendList title={t("moments.trending.interpretations")} items={trending.interpretations.map((x) => ({ k: x.key, n: x.count }))} />
      </div>
      {trending.looks.length > 0 && <ul className="moment-trend-looks mt-2">{trending.looks.slice(0, 6).map((l) => <li key={l.schemeId}><Link href={`/schemes/${l.schemeId}`} className="moment-trend-look"><span className="moment-look-thumb">{l.coverImageUrl ? <img src={mediaUrl(l.coverImageUrl)} alt="" /> : null}</span><span className="type-caption truncate">{l.title}</span><span className="type-caption tabular text-muted">{l.contextualHype != null ? t("moments.context.hype_short", { n: l.contextualHype }) : ""}</span></Link></li>)}</ul>}
      <p className="type-caption text-muted mt-1">{t("moments.trending.basis", { n: trending.basis })}</p>
    </Card>
  );
}

function TrendList({ title, items }: { title: string; items: { k: string; n: number }[] }) {
  if (items.length === 0) return null;
  return <div><p className="type-label text-muted">{title}</p><ol className="moment-trend-list">{items.map((i) => <li key={i.k}><span>{i.k}</span><span className="tabular text-muted">{i.n}</span></li>)}</ol></div>;
}

/** MEMÓRIA (§34, §45): o que o Momento foi — nunca some. */
export function MomentMemoryView({ memory, moment }: { memory?: MomentMemory | null; moment: MomentDetail }) {
  const { t, fmtNumber } = useI18n();
  if (!memory) return null;
  const highlights: [string, MemoryLook | null | undefined][] = [["winner", memory.winner], ["mostCreative", memory.mostCreative], ["mostElegant", memory.mostElegant], ["mostTrend", memory.mostTrend], ["mostOriginal", memory.mostOriginal], ["mostTheme", memory.mostTheme]];
  return (
    <Card className="moment-memory">
      <p className="label">{t("moments.memory.title")}</p>
      <h3 className="type-h2">{moment.name}</h3>
      <dl className="moment-memory-stats">
        <div><dt>{t("moments.memory.participants")}</dt><dd className="tabular">{fmtNumber(memory.participants ?? 0)}</dd></div>
        <div><dt>{t("moments.memory.looks")}</dt><dd className="tabular">{fmtNumber(memory.looks ?? 0)}</dd></div>
        <div><dt>{t("moments.memory.votes")}</dt><dd className="tabular">{fmtNumber(memory.votes ?? 0)}</dd></div>
        {moment.cooperative && <div><dt>{t("moments.coop.title")}</dt><dd>{memory.goalReached ? t("moments.coop.reached") : t("moments.coop.not_reached")}</dd></div>}
      </dl>
      <ul className="moment-memory-looks">
        {highlights.filter(([, l]) => !!l).map(([k, l]) => <li key={k}><Link href={`/schemes/${l!.schemeId}`} className="moment-trend-look"><span className="moment-look-thumb">{l!.coverImageUrl ? <img src={mediaUrl(l!.coverImageUrl)} alt="" /> : null}</span><span className="min-w-0"><span className="type-label block text-muted">{t(`moments.memory.${k}`)}</span><span className="type-body-sm truncate block">{l!.title ?? t("moments.community.look")}</span>{l!.user && <span className="type-caption text-muted">@{l!.user.username}</span>}</span></Link></li>)}
      </ul>
      {memory.interpretations && memory.interpretations.length > 0 && <p className="type-caption text-muted mt-2">{t("moments.memory.readings", { list: memory.interpretations.map((i) => `${i.key} (${i.count})`).join(", ") })}</p>}
    </Card>
  );
}
