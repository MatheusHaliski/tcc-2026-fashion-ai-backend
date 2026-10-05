"use client";
import { useId } from "react";
import { tr, useI18n } from "@/lib/i18n/i18n";
import { SealMedallion, type SealDesign } from "@/components/seal-medallion";
import type { SealBadge } from "@/components/scheme-card";
import { cn } from "@/components/ui";
import { displayScore, levelTone } from "@/lib/hype/model";
import { HYPE_SEAL_DESIGN, HYPE_SEAL_ORDER, cardHypeSeals, isHypeSealCode } from "@/lib/hype/seals";
import type { HypeLevel, HypeSealCode, HypeSealProgress, HypeSummary } from "@/lib/hype/types";

/**
 * RF53 — Selos × HypeScore na interface: os Selos de Hype FashionAI (medalhão Padrão FashionAI por código) nos cards,
 * o progresso de cada selo na análise completa, o Hype de cada sugestão de selo nos criadores e o "Hype do selo" no
 * perfil do emissor. O Hype alimenta os selos; selo nunca alimenta o Hype.
 */

/** Quantos medalhões o SealSlot do card mostra (mesmo corte do componente). */
const SLOT_MAX = 3;

/** Desenho do medalhão de um Selo de Hype (tipo Padrão FashionAI, modelo fixo por código). */
export const hypeSealDesign = (code: HypeSealCode): SealDesign => ({ kind: "FASHIONAI", mode: "TEMPLATE", template: HYPE_SEAL_DESIGN[code].template });
/** Rótulo curto ("Viral") e nome completo, usado no title e no nome acessível ("Selo de Hype: Viral"). */
export const hypeSealLabel = (code: HypeSealCode) => tr(HYPE_SEAL_DESIGN[code].labelKey);
export const hypeSealName = (code: HypeSealCode) => tr("sealHype.nome", { name: hypeSealLabel(code) });

/** Selos de Hype do resumo já carregado pelo card (useHypeSummary): só com o Hype disponível. */
export const hypeSealCodes = (summary?: HypeSummary | null): HypeSealCode[] => (summary?.status === "AVAILABLE" ? cardHypeSeals(summary.seals) : []);

/** Selos de Hype no formato do SealSlot/SealStuds (no máximo 2, na ordem de prioridade). */
export function hypeSealBadges(codes?: readonly unknown[] | null): SealBadge[] {
  return cardHypeSeals(codes).map((code) => ({ label: hypeSealLabel(code), name: hypeSealName(code), design: hypeSealDesign(code), kind: "HYPE" }));
}

/**
 * Junta os selos de marca/celebridade e os Selos de Hype no mesmo espaço do card. Os de marca vêm primeiro; quando o
 * slot lota, o Hype garante uma vaga (duas se houver só um selo de marca) — o resto dos selos de marca continua na lista
 * (contagem dos SealStuds), só fora do corte do SealSlot. Sem Selo de Hype, devolve a lista original intacta.
 */
export function withHypeSeals(seals: SealBadge[] | undefined, codes?: readonly unknown[] | null): SealBadge[] | undefined {
  const hype = hypeSealBadges(codes);
  if (!hype.length) return seals;
  const own = seals ?? [];
  const shown = hype.slice(0, own.length >= SLOT_MAX - 1 ? 1 : hype.length);
  const keep = SLOT_MAX - shown.length;
  return [...own.slice(0, keep), ...shown, ...own.slice(keep)];
}

/** Hype de uma sugestão de selo (`hype: { score, level } | null` do preview): número + faixa em texto. */
export function SealSuggestionHype({ hype, className }: { hype?: { score?: number | null; level?: HypeLevel | null } | null; className?: string }) {
  const { t } = useI18n();
  if (!hype || hype.score == null || !hype.level) return null;
  return (
    <span className={cn("hype-seal-sugg", levelTone(hype.level), className)}>
      <span aria-hidden>🔥 </span>{t("sealHype.sugestao", { score: displayScore(hype.score), level: t(`hype.level.${hype.level}`) })}
    </span>
  );
}

/** "Hype do selo" (perfil do emissor): média do HypeScore atual dos itens com vínculo aprovado; some quando não há média. */
export interface SealHypeAggregate { avgScore: number | null; level: HypeLevel | null; bonded: number }
export function SealHypeStat({ hype, tier }: { hype?: SealHypeAggregate | null; tier?: string }) {
  const { t } = useI18n();
  if (!hype || hype.avgScore == null) return null;
  return (
    <p className="seal-hype-stat">
      <span className="seal-hype-stat-label">{t("sealHype.selo.titulo")}</span>
      <b className="tabular">{displayScore(hype.avgScore)}</b>
      {hype.level && <span className={cn("hype-level-chip", levelTone(hype.level))}>{t(`hype.level.${hype.level}`)}</span>}
      <span className="text-muted">{t("sealHype.selo.vinculados", { n: hype.bonded ?? 0, tier: tier === "PECA" ? "PECA" : "LOOK" })}</span>
    </p>
  );
}

/** Análise completa: Selos de Hype conquistados (✓) e as próximas metas com o critério de cada uma. */
export function HypeSealProgressList({ progress }: { progress?: HypeSealProgress[] | null }) {
  const { t } = useI18n();
  const hid = useId();
  const known = (progress ?? []).filter((p) => isHypeSealCode(p.code)).sort((a, b) => HYPE_SEAL_ORDER.indexOf(a.code) - HYPE_SEAL_ORDER.indexOf(b.code));
  if (!known.length) return null;
  const earned = known.filter((p) => p.earned);
  const goals = known.filter((p) => !p.earned);
  const item = (p: HypeSealProgress) => (
    <li key={p.code} className={cn("hype-seal-item", p.earned ? "is-earned" : "is-goal")}>
      <SealMedallion design={hypeSealDesign(p.code)} size={36} title={hypeSealName(p.code)} className="is-hype" />
      <span className="min-w-0">
        <span className="hype-seal-item-name"><b>{hypeSealLabel(p.code)}</b>{p.earned && <span className="hype-seal-check"><span aria-hidden>✓ </span>{t("sealHype.drawer.conquistado")}</span>}</span>
        {p.criteria && <span className="type-caption text-muted block">{p.earned ? p.criteria : t("sealHype.drawer.falta", { criteria: p.criteria })}</span>}
      </span>
    </li>
  );
  return (
    <section aria-labelledby={hid} className="hype-seal-progress">
      <h3 id={hid} className="type-h3 mb-1">{t("sealHype.drawer.titulo")}</h3>
      <p className="type-caption text-muted mb-2">{t("sealHype.drawer.dica")}</p>
      {earned.length > 0 && <><h4 className="label mb-1">{t("sealHype.drawer.conquistados", { n: earned.length })}</h4><ul className="hype-seal-list">{earned.map(item)}</ul></>}
      {goals.length > 0 && <><h4 className="label mb-1 mt-2">{t("sealHype.drawer.proximas")}</h4><ul className="hype-seal-list">{goals.map(item)}</ul></>}
    </section>
  );
}
