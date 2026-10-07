"use client";
import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { label as taxLabel } from "@/lib/api/taxonomy";
import { countdown, statusAt, unitOf } from "@/lib/moments/time";
import { momentIcon, momentStyle, momentTone } from "@/lib/moments/theme";
import type { MomentCard as MomentCardData, MomentTheme, MomentTimeView, Participation } from "@/lib/moments/types";
import { Badge, cn } from "@/components/ui";

/** Relógio compartilhado: re-renderiza a cada 30 s para as contagens continuarem andando sem nova requisição. */
export function useMomentClock(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(h); }, [intervalMs]);
  return now;
}

/** Texto informativo da contagem (§9): "Termina em 6 dias", "Começa em 18 h" — nunca FOMO. */
export function useCountdownLabel(time: MomentTimeView | undefined, receivedAt: number): string {
  const { t } = useI18n(); const now = useMomentClock();
  if (!time) return "";
  const c = countdown(time, receivedAt, now);
  if (c.kind === "ended") return t("moments.time.ended");
  if (c.kind === "inactive") return "";
  const unit = unitOf(c); const n = unit === "days" ? c.days : unit === "hours" ? c.hours : Math.max(1, c.minutes);
  return t(`moments.time.${c.kind}_${unit}`, { n });
}

export function MomentCountdown({ time, receivedAt, className }: { time: MomentTimeView; receivedAt: number; className?: string }) {
  const label = useCountdownLabel(time, receivedAt);
  if (!label) return null;
  return <span className={cn("moment-countdown tabular", className)}>{label}</span>;
}

/** Camada de tema (§51): só variáveis CSS; a identidade FashionAI continua dominante. */
export function MomentThemed({ theme, className, children, style, as: Tag = "div", ...rest }: { theme?: MomentTheme | null; className?: string; children: ReactNode; style?: CSSProperties; as?: "div" | "section" | "article" | "li" | "header" } & Record<string, unknown>) {
  return <Tag className={cn("moment-themed", className)} data-tone={momentTone(theme)} style={{ ...momentStyle(theme), ...style }} {...rest}>{children}</Tag>;
}

export function MomentIcon({ theme, size = 28 }: { theme?: MomentTheme | null; size?: number }) {
  return <span className="moment-icon" aria-hidden style={{ fontSize: size * 0.7, width: size, height: size }}>{momentIcon(theme)}</span>;
}

export function MomentTypeBadge({ m }: { m: Pick<MomentCardData, "type" | "nature" | "sponsored" | "sponsorName" | "official" | "visibility"> }) {
  const { t } = useI18n();
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge>{t(`moments.type.${m.type}`)}</Badge>
      {m.nature === "RELIGIOUS" && <Badge tone="chalk">{t("moments.nature.RELIGIOUS")}</Badge>}
      {m.sponsored && <Badge tone="mark" className="moment-sponsored">{t("moments.sponsored")}{m.sponsorName ? ` · ${m.sponsorName}` : ""}</Badge>}
      {m.visibility !== "PUBLIC" && <Badge>{t(`moments.visibility.${m.visibility}`)}</Badge>}
    </span>
  );
}

export function pointsBonusLabel(t: (k: string, v?: Record<string, string | number>) => string, m: Pick<MomentCardData, "pointsEnabled" | "pointsMultiplier">): string | null {
  if (!m.pointsEnabled) return null;
  const pct = Math.round((m.pointsMultiplier - 1) * 100);
  return pct > 0 ? t("moments.points_bonus_pct", { pct }) : t("moments.points_enabled");
}

export function participationLabel(t: (k: string, v?: Record<string, string | number>) => string, p?: Participation | null): string | null {
  if (!p) return null;
  if (p.status === "COMPLETED") return p.outcome === "WINNER" ? t("moments.outcome.WINNER") : p.outcome === "TOP_10" ? t("moments.outcome.TOP_10") : t("moments.outcome.COMPLETED");
  if (p.status === "SUBMITTED" || p.status === "JOINED") return t("moments.me.participating");
  if (p.status === "INTERESTED") return p.remind ? t("moments.me.reminder_on") : t("moments.me.saved");
  return null;
}

/** Período local ("20 out – 31 out"): datas locais do Momento, no fuso dele. */
export function useLocalRange() {
  const { fmtDate } = useI18n();
  return (time: MomentTimeView) => `${fmtDate(time.localStart + "T12:00:00Z", { day: "2-digit", month: "short", timeZone: "UTC" })} – ${fmtDate(time.localEnd + "T12:00:00Z", { day: "2-digit", month: "short", timeZone: "UTC" })}`;
}

/** Card de lista (home, próximos, calendário, meus). Momentos privados não mostram contagem de participantes (§28). */
export function MomentCard({ m, receivedAt, compact }: { m: MomentCardData; receivedAt: number; compact?: boolean }) {
  const { t, fmtNumber } = useI18n(); const range = useLocalRange(); const now = useMomentClock();
  const status = statusAt(m.time, receivedAt, now); const me = participationLabel(t, m.me); const bonus = pointsBonusLabel(t, m);
  return (
    <MomentThemed as="article" theme={m.theme} className={cn("moment-card", compact && "is-compact", status === "ENDED" && "is-ended")} aria-labelledby={`mc-${m.id}`}>
      <div className="moment-card-head">
        <MomentIcon theme={m.theme} />
        <div className="min-w-0 flex-1">
          <h3 id={`mc-${m.id}`} className="type-h3 truncate"><Link href={`/moments/${m.slug}`} className="moment-link">{m.name}</Link></h3>
          <p className="type-caption text-muted">{range(m.time)}{m.regional && m.country ? ` · ${m.country}` : ""}</p>
        </div>
        <span className={cn("moment-status", `is-${status.toLowerCase()}`)}>{t(`moments.status.${status}`)}</span>
      </div>
      {!compact && m.description && <p className="type-body-sm text-muted mt-1 line-clamp-2">{m.description}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 type-caption">
        <MomentCountdown time={m.time} receivedAt={receivedAt} />
        {bonus && status !== "ENDED" && <span className="moment-bonus">{bonus}</span>}
        {m.participantCount != null && m.participantCount > 0 && <span>{t("moments.participants_count", { n: fmtNumber(m.participantCount) })}</span>}
        {me && <span className="moment-me">{me}</span>}
      </div>
      {!compact && <div className="mt-2"><MomentTypeBadge m={m} /></div>}
      {!compact && m.styleTags.length > 0 && <ul className="moment-tags" aria-label={t("moments.tags_label")}>{m.styleTags.slice(0, 4).map((s) => <li key={s} className="moment-tag">{taxLabel(s)}</li>)}</ul>}
    </MomentThemed>
  );
}
