"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { levelTone } from "@/lib/hype/model";
import type { HypeEntity } from "@/lib/hype/types";
import { internalHref, unlocksPath, type AuraUnlockItem, type AuraUnlockKind, type AuraUnlocks } from "@/lib/aura/unlocks";
import { Button, cn } from "@/components/ui";

const ICONS: Record<AuraUnlockKind, React.ReactNode> = {
  COUPON: <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Zm10-2v12" />,
  SEAL_CAMPAIGN: <><circle cx="12" cy="9" r="6" /><path d="m8 14-1 7 5-3 5 3-1-7m-7-5 2 2 4-4" /></>,
  FLAIR_BAND: <><rect x="4" y="5" width="10" height="14" rx="2" /><path d="M14 8l5 1.5-3 10.5-4-1" /></>,
  MILESTONE_POINTS: <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.2 6-5.5-3-5.5 3 1.2-6L3.2 9.4l6.1-.8Z" />,
  AURA_REWARD: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" />,
};

/** Ícone do tipo de item (decorativo: o tipo também vai escrito para leitores de tela). */
export function AuraUnlockIcon({ kind }: { kind: AuraUnlockKind }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ICONS[kind]}</svg>;
}

function UnlockRow({ item, onSeeSeals }: { item: AuraUnlockItem; onSeeSeals?: () => void }) {
  const { t } = useI18n();
  const href = internalHref(item.href);
  return (
    <li className={cn("aura-unlock", item.met ? "is-met" : "is-next")} data-kind={item.kind} data-family={item.family}>
      <span className="aura-unlock-icon"><AuraUnlockIcon kind={item.kind} /></span>
      <span className="min-w-0">
        <span className="aura-unlock-title"><span className="sr-only">{t(`auraUnlocks.kind.${item.kind}`)}: </span>{item.title}</span>
        {item.detail && <span className="type-caption text-muted">{item.detail}</span>}
        <span className="aura-unlock-tags">
          {item.family !== "HYPE" && <span className="hype-level-chip">{t(`auraUnlocks.family.${item.family}`)}</span>}
          {!item.met && item.requiredLevel && <span className={cn("hype-level-chip", levelTone(item.requiredLevel))}>{t("auraUnlocks.from_level", { level: t(`hype.level.${item.requiredLevel}`) })}</span>}
        </span>
      </span>
      {item.kind === "SEAL_CAMPAIGN" && onSeeSeals ? <button type="button" className="btn btn-ghost btn-sm" onClick={onSeeSeals}>{t("auraUnlocks.action.SEAL_CAMPAIGN")}</button>
        : href ? <Link className="btn btn-ghost btn-sm" href={href}>{t(`auraUnlocks.action.${item.kind}`)}</Link> : null}
    </li>
  );
}

/**
 * Circuito Aura — "O que este card destrava": o que a faixa de Hype do card já libera (cupom, campanha de selo, faixa
 * no FLAIR, pontos de marco, arte de Aura) e o que vem na próxima faixa. Só leitura: nada aqui dá Hype ao card.
 * Carregando, erro com nova tentativa e vazio têm estado próprio; Hype sem nota nunca aparece como zero.
 */
export function AuraUnlocksPanel({ type, id, enabled, focus, onSeeSeals }: { type: HypeEntity; id: string; enabled: boolean; focus?: boolean; onSeeSeals?: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const result = useApi<AuraUnlocks>((signal) => api.get(unlocksPath(type, id), { signal, anonymous: !user }), [type, id, !!user], { enabled });
  const ref = useRef<HTMLElement>(null);
  const d = result.data?.entityId === id ? result.data : null;
  useEffect(() => { if (focus && d) ref.current?.scrollIntoView?.({ block: "start" }); }, [focus, d]);
  return (
    <section ref={ref} className="aura-unlocks" aria-label={t("auraUnlocks.title")} data-focus={focus ? "true" : undefined}>
      <div>
        <h3 className="type-h3">{t("auraUnlocks.title")}</h3>
        <p className="type-caption text-muted">{t("auraUnlocks.hint")}</p>
      </div>
      {result.loading ? <div className="skeleton h-24" role="status" aria-label={t("auraUnlocks.loading")} />
        : result.error ? <div className="aura-unlocks-error"><p role="alert" className="type-body-sm text-muted">{t("auraUnlocks.error")}</p><Button size="sm" onClick={result.reload}>{t("auraUnlocks.retry")}</Button></div>
          : d && <>
            {d.level && d.score != null ? (
              <p className="aura-unlocks-state">
                <span className={cn("hype-level-chip", levelTone(d.level))}>{t(`hype.level.${d.level}`)}</span>
                {d.nextLevel ? <span>{t("auraUnlocks.missing", { points: d.nextLevel.missingPoints, level: t(`hype.level.${d.nextLevel.level}`) })}</span> : <span>{t("auraUnlocks.top_level")}</span>}
              </p>
            ) : <p className="type-body-sm text-muted" role="note">{t(d.status === "INSUFFICIENT_DATA" ? "auraUnlocks.insufficient" : "auraUnlocks.not_calculated")}</p>}
            {d.level && !d.counts && <p className="type-body-sm text-muted" role="note">{t(d.stale ? "auraUnlocks.stale" : "auraUnlocks.personal")}</p>}
            {d.unlocked.length + d.next.length === 0 ? <p className="type-body-sm text-muted">{t("auraUnlocks.empty")}</p> : <>
              {d.unlocked.length > 0 && <div><h4 className="aura-unlocks-sub">{t("auraUnlocks.unlocked")}</h4><ul className="aura-unlock-list">{d.unlocked.map((item, i) => <UnlockRow key={`u${i}`} item={item} onSeeSeals={onSeeSeals} />)}</ul></div>}
              {d.next.length > 0 && <div><h4 className="aura-unlocks-sub">{t("auraUnlocks.next")}</h4><ul className="aura-unlock-list">{d.next.map((item, i) => <UnlockRow key={`n${i}`} item={item} onSeeSeals={onSeeSeals} />)}</ul></div>}
            </>}
          </>}
    </section>
  );
}
