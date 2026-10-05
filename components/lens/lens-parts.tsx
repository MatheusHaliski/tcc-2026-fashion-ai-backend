"use client";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { label } from "@/lib/api/taxonomy";
import { ARROW, LEVELS, levelTone } from "@/lib/hype/model";
import type { HypeLevel } from "@/lib/hype/types";
import { cropOf, shownSimilarity } from "@/lib/lens/model";
import type { LensBox, LensDetectionView, LensFit, LensMatchView, LensTrend } from "@/lib/lens/types";
import { useCardFlip } from "@/components/fashion-card";
import { HypeStateNotice } from "@/components/hype/hype-state-notice";
import { Button, cn } from "@/components/ui";

/**
 * Peças pequenas do Lens: recorte da peça, selo de semelhança, lacuna, verso dos cards, os seis números do look e
 * o par Compatibilidade × Hype (sempre lado a lado, nunca somados).
 */

/**
 * Diálogos abertos de dentro de um FashionCard vão para o body: o card usa perspective/preserve-3d, que prendem um
 * elemento `fixed` à caixa do card.
 */
export function LensPortal({ children }: { children: ReactNode }) {
  return typeof document === "undefined" ? null : createPortal(children, document.body);
}

/** Recorte da caixa da peça direto da imagem do scan (CSS), sem distorcer: o quadro 4:5 envolve a proporção da caixa. */
export function LensCrop({ url, box, width, height, className }: { url: string | null; box: LensBox; width: number; height: number; className?: string }) {
  const c = cropOf(box, width, height);
  return (
    <span className={cn("lens-crop", className)} aria-hidden>
      <span className={cn("lens-crop-img", c.ratio >= 0.8 ? "is-wide" : "is-tall", !url && "is-empty")}
        style={{ aspectRatio: String(c.ratio), backgroundImage: url ? `url("${url}")` : undefined, backgroundSize: c.size, backgroundPosition: c.position }} />
    </span>
  );
}

/** Amostra de cor + nome (o nome nunca depende só da cor). */
export function LensSwatch({ hex, name }: { hex: string | null | undefined; name: string }) {
  return <span className="lens-swatch-row"><span className="lens-swatch" style={{ background: hex ?? undefined }} aria-hidden />{name}</span>;
}

const KNOWN_REASONS = new Set(["SAME_SUBCATEGORY", "SAME_CATEGORY", "COLOR_CLOSE", "SAME_PATTERN", "SAME_MATERIAL", "STYLE_OVERLAP", "VISUAL_CLOSE"]);

/**
 * Selo de SEMELHANÇA ("é parecida?"), dentro do PieceCard (slot `extra`): texto + barra + até 3 motivos em texto.
 * Sem valor útil não há selo: a lista mostra "sem correspondência", nunca "0%".
 */
export function LensMatchBadge({ match }: { match: Pick<LensMatchView, "similarity" | "reasons" | "scope"> }) {
  const { t } = useI18n();
  const pct = shownSimilarity(match.similarity);
  if (pct == null) return null;
  const reasons = match.reasons.filter((r) => KNOWN_REASONS.has(r)).slice(0, 3).map((r) => t(`lens.reason.${r}`));
  const near = match.scope === "MY_CLOSET" && pct < 65;
  return (
    <div className="lens-match">
      <p className="lens-match-head"><b>{t("lens.match.similarity", { pct })}</b>{near && <span className="lens-match-near">{t("lens.match.near")}</span>}</p>
      <span className="lens-match-bar" aria-hidden><i style={{ width: `${pct}%` }} /></span>
      {reasons.length > 0 && <p className="lens-match-reasons">{reasons.join(" · ")}</p>}
    </div>
  );
}

/** Silhueta decorativa da categoria (a lacuna mostra a forma do que falta, sem foto de produto nem marca). */
function Silhouette({ category }: { category: string | null }) {
  const d = category === "lower_piece" ? "M16 6h32l3 52H38l-6-34-6 34H13z"
    : category === "shoes_piece" ? "M6 40c8 0 14-4 18-12l10 4c4 2 10 3 16 4 6 1 8 4 8 8v4H6z"
    : category === "accessory_piece" ? "M20 22c0-8 5-12 12-12s12 4 12 12M12 22h40l-4 32H16z"
    : category === "full_body_piece" ? "M24 6h16l2 10 6 4-4 8 8 30H12l8-30-4-8 6-4z"
    : "M22 8l-14 8 5 12 6-3v31h26V25l6 3 5-12-14-8c-2 4-6 6-10 6s-8-2-10-6z";
  return <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden className="lens-gap-svg"><path d={d} /></svg>;
}

/**
 * LACUNA: "Você ainda não tem uma peça assim". Ações: usar uma alternativa sua (quando há), ver na comunidade e Quero.
 * Sem preço e sem marca: é uma lacuna, não um anúncio.
 */
export function LensGapCard({ detection, onDiscover, onWant, onAlternative, wantBusy }: {
  detection: Pick<LensDetectionView, "label" | "category" | "wanted">; onDiscover?: () => void; onWant?: () => void; onAlternative?: () => void; wantBusy?: boolean;
}) {
  const { t } = useI18n();
  return (
    <article className="fai-card lens-gap" aria-label={t("lens.gap.aria", { label: detection.label })}>
      <span className="lens-gap-art"><Silhouette category={detection.category} /></span>
      <p className="lens-gap-title">{t("lens.gap.title")}</p>
      <p className="lens-gap-sub">{detection.label}{detection.category ? ` · ${label(detection.category)}` : ""}</p>
      <div className="lens-gap-actions">
        {onAlternative && <Button size="sm" onClick={onAlternative}>{t("lens.gap.use_alternative")}</Button>}
        {onDiscover && <Button size="sm" onClick={onDiscover}>{t("lens.gap.discover")}</Button>}
        {onWant && <Button size="sm" aria-pressed={detection.wanted} loading={wantBusy} onClick={onWant}>{detection.wanted ? t("lens.action.wanted") : t("lens.action.want")}</Button>}
      </div>
    </article>
  );
}

/**
 * Botão ↻ dos cards do Lens: mesmas regras do CardFlipButton (só ele vira, o foco acompanha o giro, a face escondida
 * fica inert), com o texto da leitura — o verso do Lens é "Leitura da peça", não o Hype.
 */
export function LensFlipButton({ side }: { side: "front" | "back" }) {
  const ctx = useCardFlip();
  const { t } = useI18n();
  if (!ctx) return null;
  const text = side === "front" ? t("lens.card.flip_to_back", { name: ctx.name }) : t("lens.card.flip_to_front", { name: ctx.name });
  return (
    <button type="button" ref={(el) => ctx.register(side, el)} className="card-flip-btn" aria-label={text} title={text} aria-controls={ctx.backId} data-side={side}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); ctx.flip(side === "front"); }}>
      <span aria-hidden className="card-flip-icon">↻</span>
    </button>
  );
}

/** Verso dos cards do Lens (região nomeada "Leitura de …"; montada só no primeiro giro, inert enquanto escondida). */
export function LensCardBack({ children }: { children: ReactNode }) {
  const ctx = useCardFlip();
  const { t } = useI18n();
  const hidden = !ctx?.flipped;
  return (
    <div id={ctx?.backId} className="fcard-face is-back" role="region" aria-label={t("lens.card.back_label", { name: ctx?.name ?? "" })}
      inert={hidden || undefined} aria-hidden={hidden || undefined}>
      {ctx?.mounted ? children : null}
    </div>
  );
}

/** Barra de um valor 0–100 com rótulo e número (mesmo desenho do HypeMetricBar); sem dado = "—", nunca barra zerada. */
export function LensMetric({ name, value, suffix = "", note }: { name: string; value: number | null | undefined; suffix?: string; note?: string }) {
  const { t } = useI18n();
  const has = value != null && Number.isFinite(value);
  return (
    <li className="hype-metric">
      <span className="hype-metric-label">{name}{note && <span className="hype-metric-hint">{note}</span>}</span>
      <span className="hype-metric-value tabular">{has ? `${Math.round(value!)}${suffix}` : <><span aria-hidden>—</span><span className="sr-only">{t("lens.no_data")}</span></>}</span>
      <span className="hype-bar hype-metric-bar" aria-hidden><i style={{ width: `${has ? Math.max(0, Math.min(100, value!)) : 0}%`, background: "var(--thread)" }} /></span>
    </li>
  );
}

const isLevel = (l: string | null): l is HypeLevel => !!l && (LEVELS as string[]).includes(l);

/** Hype do GRUPO de peças parecidas: faixa em texto + seta, ou "dados insuficientes" (nunca 0). */
export function LensTrendTile({ trend, compact }: { trend: LensTrend | null | undefined; compact?: boolean }) {
  const { t } = useI18n();
  const available = trend?.status === "AVAILABLE" && (trend.level != null || trend.score != null);
  return (
    <div className={cn("hype-vs-tile lens-tile", compact && "is-compact")}>
      <span className="hype-vs-k">{t("lens.trend.title")}</span>
      {available ? (
        <>
          <span className="lens-trend-line">
            {isLevel(trend!.level) ? <span className={cn("hype-level-chip", levelTone(trend!.level))}>{t(`hype.level.${trend!.level}`)}</span> : trend!.level ? <span className="hype-level-chip">{trend!.level}</span> : null}
            {trend!.direction && (
              <span className={cn("hype-trend", `is-${trend!.direction.toLowerCase()}`)}>
                <span aria-hidden>{ARROW[trend!.direction]}</span><span className="sr-only">{t(`lens.trend.direction.${trend!.direction}`)}</span>
              </span>
            )}
            {trend!.score != null && <b className="tabular lens-trend-score">{Math.round(trend!.score)}</b>}
          </span>
          {!compact && trend!.label && <span className="type-caption text-muted">{t("lens.trend.group", { label: trend!.label, n: trend!.items })}</span>}
        </>
      ) : compact ? <b className="lens-tile-empty">{t("hype.state.insufficient")}</b> : (
        <>
          <HypeStateNotice state={{ kind: "insufficient", stale: false }} />
          <span className="type-caption text-muted">{t("lens.trend.insufficient_hint")}</span>
        </>
      )}
    </div>
  );
}

/** Compatibilidade com o DNA de estilo, ou o convite para criar o DNA (sem DNA, nenhum número é inventado). */
export function LensFitTile({ fit, compact }: { fit: LensFit | null | undefined; compact?: boolean }) {
  const { t } = useI18n();
  const parts = fit ? Object.entries(fit.parts ?? {}).filter(([, v]) => v != null && Number.isFinite(v)) : [];
  return (
    <div className={cn("hype-vs-tile lens-tile", compact && "is-compact")}>
      <span className="hype-vs-k">{t("lens.fit.title")}</span>
      {fit ? (
        <>
          <b className="hype-vs-v tabular">{t("lens.fit.score", { score: Math.round(fit.score) })}</b>
          {!compact && parts.length > 0 && (
            <ul className="lens-fit-parts">
              {parts.map(([k, v]) => <LensMetric key={k} name={t(`lens.fit.part.${["styles", "colors", "occasions"].includes(k) ? k : "other"}`)} value={v} suffix="%" />)}
            </ul>
          )}
        </>
      ) : (
        <>
          <span className="type-body-sm">{compact ? t("lens.fit.no_dna_short") : t("hype.vs.no_dna")}</span>
          <Link href="/dna" className="hype-vs-cta">{t("hype.vs.no_dna_cta")}</Link>
        </>
      )}
    </div>
  );
}

/** Compatibilidade × Hype lado a lado, cada um com o próprio rótulo — e a explicação de que nunca se somam. */
export function LensFitTrend({ fit, trend, compact }: { fit: LensFit | null | undefined; trend: LensTrend | null | undefined; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <section className={cn("hype-vs lens-fit-trend", compact && "is-compact")} aria-label={t("lens.style.title")}>
      <LensFitTile fit={fit} compact={compact} />
      <LensTrendTile trend={trend} compact={compact} />
      {!compact && <p className="hype-vs-hint type-caption text-muted">{t("lens.style.never_summed")}</p>}
    </section>
  );
}
