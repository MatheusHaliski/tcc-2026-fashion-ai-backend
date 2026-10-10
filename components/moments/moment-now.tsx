"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { label as taxLabel } from "@/lib/api/taxonomy";
import { elapsedAt } from "@/lib/moments/time";
import type { MomentCard as MomentCardData, Interpretation } from "@/lib/moments/types";
import { Button } from "@/components/ui";
import { MomentCountdown, MomentIcon, MomentThemed, MomentTypeBadge, pointsBonusLabel, useLocalRange, useMomentClock } from "./moment-shared";

/**
 * ACONTECENDO AGORA (§8): o Momento ativo em destaque com contagem, multiplicador, interpretações e os quatro caminhos
 * (criar look, usar o guarda-roupa, pedir ao Copilot, ver a comunidade). Tema como camada; texto sempre com contraste.
 */
export function MomentNowHero({ m, receivedAt, interpretations, onJoin, joined }: { m: MomentCardData; receivedAt: number; interpretations?: Interpretation[]; onJoin?: () => void; joined?: boolean }) {
  const { t, fmtNumber } = useI18n(); const range = useLocalRange(); const now = useMomentClock();
  const bonus = pointsBonusLabel(t, m); const elapsed = elapsedAt(m.time, receivedAt, now);
  const chips = (interpretations?.length ? interpretations.map((i) => i.label ?? i.key) : m.styleTags.map(taxLabel)).slice(0, 8);
  const ask = encodeURIComponent(t("moments.copilot_prompt", { name: m.name }));
  return (
    <MomentThemed as="section" theme={m.theme} className="moment-hero" aria-labelledby={`now-${m.id}`}>
      <div className="moment-hero-art" aria-hidden />
      <div className="moment-hero-body">
        <p className="moment-hero-kicker">{t("moments.now_kicker")}</p>
        <div className="flex items-start gap-3">
          <MomentIcon theme={m.theme} size={44} />
          <div className="min-w-0">
            <h2 id={`now-${m.id}`} className="type-display moment-hero-title">{m.name}</h2>
            <p className="type-body-sm moment-hero-sub">{range(m.time)} · <MomentCountdown time={m.time} receivedAt={receivedAt} /></p>
          </div>
        </div>
        <div className="moment-hero-facts">
          {bonus && <span className="moment-fact"><b>{bonus}</b></span>}
          {m.participantCount != null && m.participantCount > 0 && <span className="moment-fact">{t("moments.participants_count", { n: fmtNumber(m.participantCount) })}</span>}
          <span className="moment-fact"><MomentTypeBadge m={m} /></span>
        </div>
        <div className="moment-timebar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(elapsed * 100)} aria-label={t("moments.time.elapsed_label")}><i style={{ width: `${Math.round(elapsed * 100)}%` }} /></div>
        {chips.length > 0 && <div className="mt-3"><p className="label">{t("moments.interpretations_label")}</p><ul className="moment-tags">{chips.map((c) => <li key={c} className="moment-tag">{c}</li>)}</ul><p className="type-caption moment-hero-sub mt-1">{t("moments.interpretations_hint")}</p></div>}
        <div className="moment-hero-cta">
          {onJoin && !joined ? <Button variant="primary" onClick={onJoin}>{t("moments.cta.join")}</Button> : <Link href={`/moments/${m.slug}`} className="btn btn-primary">{t("moments.cta.open")}</Link>}
          <Link href={`/schemes/new?moment=${encodeURIComponent(m.slug)}`} className="btn">{t("moments.cta.create_look")}</Link>
          <Link href="/closet" className="btn">{t("moments.cta.use_wardrobe")}</Link>
          <Link href={`/copilot?ask=${ask}`} className="btn">{t("moments.cta.ask_copilot")}</Link>
          <Link href={`/moments/${m.slug}?tab=community`} className="btn btn-ghost">{t("moments.cta.see_community")}</Link>
        </div>
      </div>
    </MomentThemed>
  );
}
