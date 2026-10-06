"use client";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { momentIcon, momentStyle } from "@/lib/moments/theme";
import type { MomentsTimeline, Replay, TimelineEntry } from "@/lib/moments/types";
import { Badge, Card, EmptyState, ErrorState, Skeleton, Switch, cn, useToast } from "@/components/ui";

/** Perfil → MOMENTOS (§41): trajetória por ano; a pessoa controla o que aparece em público. */
export function MomentsTimelineSection({ userId, self }: { userId: string; self: boolean }) {
  const { t } = useI18n(); const { user } = useAuth(); const toast = useToast();
  const tl = useApi<MomentsTimeline>((signal) => api.get(`/api/users/${encodeURIComponent(userId)}/moments`, { signal, anonymous: !user }), [userId, !!user]);
  async function toggle(e: TimelineEntry, v: boolean) { try { await api.put(`/api/moments/${encodeURIComponent(e.slug)}/profile-visibility`, { publicOnProfile: v }); tl.reload(); } catch (err) { toast.fromError(err); } }
  if (tl.error) return <ErrorState error={tl.error} onRetry={tl.reload} />;
  if (tl.loading || !tl.data) return <Skeleton className="h-40" />;
  if (!tl.data.visible) return <EmptyState title={t("moments.timeline.private")} />;
  if (tl.data.years.length === 0) return <EmptyState title={self ? t("moments.timeline.empty_self") : t("moments.timeline.empty")} action={self ? <Link href="/moments" className="btn btn-primary">{t("moments.timeline.discover")}</Link> : undefined} />;
  return (
    <div className="grid gap-4">
      {self && <MomentsReplay />}
      {tl.data.years.map((y) => (
        <section key={y.year} aria-labelledby={`ty-${y.year}`}>
          <h3 id={`ty-${y.year}`} className="type-h3 mb-2 tabular">{y.year}</h3>
          <ol className="moment-timeline">
            {y.items.map((e) => (
              <li key={e.momentId} className={cn("moment-tl-item", !e.publicOnProfile && "is-hidden")} style={momentStyle(e.theme)}>
                <span className="moment-icon" aria-hidden>{momentIcon(e.theme)}</span>
                <span className="min-w-0 flex-1">
                  <Link href={`/moments/${e.slug}`} className="type-body font-semibold moment-link">{e.name}</Link>
                  <span className="type-caption text-muted block">{e.localStart.slice(5).replace("-", "/")} – {e.localEnd.slice(5).replace("-", "/")} · {t(`moments.outcome.${e.outcome}`)}{e.percentile != null && e.outcome === "TOP_10" ? ` · ${t("moments.timeline.top", { n: e.percentile })}` : ""}{self && e.pointsEarned ? ` · +${e.pointsEarned} FAI` : ""}</span>
                </span>
                {e.badgeCode && <Badge tone="chalk" className="moment-badge">{t("moments.timeline.badge")}</Badge>}
                {self && <Switch checked={e.publicOnProfile} onChange={(v) => toggle(e, v)} label={t("moments.timeline.public_toggle")} />}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** FashionAI Replay (§42): "em {ano} você…". */
export function MomentsReplay() {
  const { t, fmtDate } = useI18n();
  const year = new Date().getFullYear();
  const r = useApi<Replay>((signal) => api.get(`/api/me/moments/replay?year=${year}`, { signal }), [year]);
  if (r.error || r.loading || !r.data || r.data.moments === 0) return null;
  const d = r.data;
  const month = d.bestMonth ? fmtDate(`${year}-${String(d.bestMonth).padStart(2, "0")}-15T12:00:00Z`, { month: "long", timeZone: "UTC" }) : null;
  return (
    <Card className="moment-replay">
      <p className="label">{t("moments.replay.kicker", { year })}</p>
      <ul className="moment-replay-list">
        <li>{t("moments.replay.moments", { n: d.moments })}</li>
        <li>{t("moments.replay.looks", { n: d.looks })}</li>
        <li>{t("moments.replay.styles", { n: d.stylesTried })}</li>
        <li>{t("moments.replay.rediscovered", { n: d.rediscoveredPieces })}</li>
        {month && <li>{t("moments.replay.best_month", { month })}</li>}
        {d.favoriteMoment && <li>{t("moments.replay.favorite", { name: d.favoriteMoment })}</li>}
        {d.peakHype && <li>{t("moments.replay.peak_hype", { n: d.peakHype.hype, name: d.peakHype.moment ?? "" })}</li>}
      </ul>
    </Card>
  );
}
