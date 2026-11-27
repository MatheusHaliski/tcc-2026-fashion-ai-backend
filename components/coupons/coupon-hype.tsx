"use client";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { levelTone } from "@/lib/hype/model";
import type { HypeLevel } from "@/lib/hype/types";
import { AuraUnlockIcon } from "@/components/hype/aura-unlocks-panel";
import { Button, Field, Select, cn } from "@/components/ui";

/**
 * Circuito Aura (fase 1) — cupom por Hype. A oferta (promoção de selo ou combinação FLAIR) pode exigir uma faixa
 * mínima de Hype do card; o cupom emitido guarda a faixa da emissão e a carteira mostra o que só falta Hype para
 * destravar. O Hype vem só da comunidade: nada aqui dá Hype ao card.
 */
export const HYPE_LEVELS: HypeLevel[] = ["LOW_SIGNAL", "NICHE", "RELEVANT", "HOT", "TRENDING", "VIRAL"];

/** Valor do formulário → corpo da API: vazio = oferta sem exigência de Hype. */
export const hypeMinimumBody = (level: string) => ({ minHypeLevel: level || null });

export interface CouponHypeSnapshot { /** faixa do card na emissão; nula em oferta sem exigência ou cupom antigo */ hypeLevelSnapshot?: HypeLevel | null; }

/** Linha do cupom emitido: a faixa registrada na emissão (nunca a atual). Vazio quando não há registro. */
export function couponHypeText(c: CouponHypeSnapshot): string {
  return c.hypeLevelSnapshot ? tr("coupons.hype.na_emissao", { level: tr(`hype.level.${c.hypeLevelSnapshot}`) }) : "";
}

/** Campo "Hype mínimo do card" dos formulários de oferta. */
export function CouponHypeField({ id, value, onChange }: { id: string; value: string; onChange: (level: string) => void }) {
  const { t } = useI18n();
  return (
    <Field label={t("coupons.hype.label")} id={id} hint={t("coupons.hype.hint")}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t("coupons.hype.sem_exigencia")}</option>
        {HYPE_LEVELS.map((l) => <option key={l} value={l}>{t(`hype.level.${l}`)}</option>)}
      </Select>
    </Field>
  );
}

export interface HypeLockedCoupon {
  source: "SELO" | "FLAIR"; id: string; title: string; ownerName: string;
  minHypeLevel: HypeLevel; /** faixa que conta hoje (pública e atualizada); nula = nenhuma */ hypeCurrentLevel: HypeLevel | null; reason: string;
}

/** Carteira — cupons que só não saem porque o card ainda não chegou à faixa de Hype da oferta. */
export function HypeLockedCoupons() {
  const { t } = useI18n();
  const { data, error, reload } = useApi<{ items: HypeLockedCoupon[] }>((signal) => api.get("/api/me/coupons/hype-locked", { signal }), []);
  if (error) {
    return <p className="aura-unlocks-error type-caption text-muted" role="status">{t("coupons.hype.erro")}<Button size="sm" variant="ghost" onClick={reload}>{t("auraUnlocks.retry")}</Button></p>;
  }
  const items = data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <section aria-label={t("coupons.hype.travados")}>
      <h2 className="type-h3 mb-1">{t("coupons.hype.travados")}</h2>
      <p className="type-caption text-muted mb-2">{t("coupons.hype.travados_hint")}</p>
      <ul className="aura-unlock-list">{items.map((c) => (
        <li key={`${c.source}-${c.id}`} className="coupon-hype-lock" data-source={c.source}>
          <span className="aura-unlock-icon"><AuraUnlockIcon kind="COUPON" /></span>
          <span className="min-w-0">
            <span className="aura-unlock-title">{c.title}</span>
            <span className="type-caption text-muted">{c.ownerName} · {c.source === "SELO" ? t("coupons.hype.origem_selo") : t("common.jogo_flair")}</span>
            <span className="aura-unlock-tags">
              <span className={cn("hype-level-chip", levelTone(c.minHypeLevel))}>{t("coupons.hype.falta", { level: t(`hype.level.${c.minHypeLevel}`) })}</span>
              <span className={cn("hype-level-chip", c.hypeCurrentLevel ? levelTone(c.hypeCurrentLevel) : undefined)}>{c.hypeCurrentLevel ? t("coupons.hype.card_em", { level: t(`hype.level.${c.hypeCurrentLevel}`) }) : t("coupons.hype.sem_hype")}</span>
            </span>
          </span>
          <Link className="btn btn-ghost btn-sm" href={c.source === "FLAIR" ? "/flair/lojas" : "/history?tab=hype"}>{t("coupons.hype.ver")}</Link>
        </li>))}</ul>
    </section>
  );
}
