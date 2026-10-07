"use client";
import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { label, subcategoryLabel } from "@/lib/api/taxonomy";
import { lensApi } from "@/lib/lens/api";
import { bandOf, shownSimilarity, LENS_PATTERNS } from "@/lib/lens/model";
import type { LensDetectionView } from "@/lib/lens/types";
import { FashionCard, FashionCardFront } from "@/components/fashion-card";
import { Button, cn, useToast } from "@/components/ui";
import { useLens, useLensReading } from "./lens-context";
import { LensCardBack, LensCrop, LensFitTrend, LensFlipButton, LensMetric, LensPortal, LensSwatch } from "./lens-parts";
import { LensCorrectButton, LensOwnDialog } from "./lens-correct";

/** Nome do padrão lido (PatternAnalyzer) no idioma corrente. */
export function usePatternLabel() {
  const { t } = useI18n();
  return (p: string | null | undefined) => {
    if (!p) return "";
    const k = p.toUpperCase();
    return (LENS_PATTERNS as readonly string[]).includes(k) ? t(`lens.pattern.${k}`) : label(p);
  };
}

/** Verso "Leitura da peça": atributos, confiança, Estilo & Hype (separados) e Corrigir / Não é roupa. */
function DetectionBack({ detection }: { detection: LensDetectionView }) {
  const { t } = useI18n();
  const { scan, version, dismissDetection } = useLens();
  const reading = useLensReading(scan, detection.id, version);
  const pattern = usePatternLabel();
  const band = bandOf(detection);
  const color = detection.colors[0];
  const rows: [string, string][] = [
    [t("common.category"), label(detection.category)], [t("common.subcategory"), subcategoryLabel(detection.subcategory)],
    [t("common.color"), color ? label(color.name) : ""], [t("common.material"), label(detection.material)],
    [t("lens.attr.pattern"), pattern(detection.pattern)], [t("common.estilos"), detection.styles.map(label).join(", ")],
    [t("common.ocasioes"), detection.occasions.map(label).join(", ")],
  ];
  return (
    <article className="fai-card hype-back lens-det-back" aria-label={t("lens.detection.back_title")}>
      <header className="hype-back-head">
        <span className="min-w-0"><span className="hype-back-kicker">{t("lens.detection.back_title")}</span><span className="type-caption truncate">{detection.label}</span></span>
        <LensFlipButton side="back" />
      </header>
      <div className="hype-back-body">
        <dl className="lens-attrs">
          {rows.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val || <span className="text-muted">{t("lens.attr.unread")}</span>}</dd></div>)}
        </dl>
        <ul className="lens-metrics">
          <LensMetric name={t("lens.detection.confidence")} value={detection.confidence * 100} suffix="%" note={t(`lens.confidence.${band}`)} />
        </ul>
        {reading.loading ? <p className="type-caption text-muted" aria-busy="true">{t("lens.style.loading")}</p>
          : reading.data ? <LensFitTrend compact fit={reading.data.fit} trend={reading.data.trend} /> : null}
        <div className="lens-det-back-actions">
          <LensCorrectButton detection={detection} />
          <Button size="sm" variant="ghost" onClick={() => dismissDetection(detection)}>{t("lens.detection.not_clothing")}</Button>
        </div>
      </div>
    </article>
  );
}

/**
 * LensDetectionCard (§7.1): a peça detectada. Frente = recorte + identidade + ações (Eu tenho · Quero · Recriar);
 * verso = leitura da peça. Confiança baixa: borda tracejada + "confira esta leitura" (a peça nunca some).
 */
export function LensDetectionCard({ detection, index, total }: { detection: LensDetectionView; index: number; total: number }) {
  const { t } = useI18n(); const toast = useToast();
  const { scan, imageUrl, updateDetection, goTab } = useLens();
  const [ownOpen, setOwnOpen] = useState(false);
  const [wantBusy, setWantBusy] = useState(false);
  const pattern = usePatternLabel();
  const band = bandOf(detection);
  const color = detection.colors[0];
  const top = shownSimilarity(detection.topMatch?.similarity);
  async function want() {
    setWantBusy(true);
    try { updateDetection(await lensApi.setWanted(scan.id, detection.id, !detection.wanted)); }
    catch (e) { toast.fromError(e); } finally { setWantBusy(false); }
  }
  const sub = [label(detection.material), pattern(detection.pattern)].filter(Boolean).join(" · ");
  return (
    <FashionCard name={detection.label} className="lens-det-wrap">
      <FashionCardFront>
        <article className={cn("fai-card lens-det", band === "LOW" && "is-low")} aria-label={t("lens.detection.aria", { n: index + 1, total, label: detection.label })}>
          <LensCrop url={imageUrl} box={detection.box} width={scan.width} height={scan.height} />
          <div className="lens-det-body">
            <p className="lens-det-n">{t("lens.detection.n", { n: index + 1 })}{detection.status === "CORRECTED" && <span className="badge badge-thread">{t("lens.status.corrected")}</span>}</p>
            <h3 className="lens-det-title">{detection.label}</h3>
            <p className="lens-det-meta">
              {color && <LensSwatch hex={color.hex} name={label(color.name)} />}
              {sub && <span>{sub}</span>}
            </p>
            {detection.styles.length > 0 && <p className="lens-det-styles">{detection.styles.slice(0, 2).map((s) => <span key={s} className="badge">{label(s)}</span>)}</p>}
            <p className={cn("lens-conf", `is-${band.toLowerCase()}`)}>{t(`lens.confidence.${band}`)}{band === "LOW" && <span> · {t("lens.confidence.check")}</span>}</p>
            <p className="lens-det-closet">
              {detection.ownedItemId ? <Link href={`/pieces/${encodeURIComponent(detection.ownedItemId)}`}>{t("lens.detection.owned_link")}</Link>
                : top != null ? t("lens.detection.top_match", { pct: top }) : t("lens.closet.none")}
            </p>
          </div>
          <div className="lens-det-actions">
            <Button size="sm" onClick={() => setOwnOpen(true)} aria-haspopup="dialog">{detection.ownedItemId ? t("lens.action.owned") : t("lens.action.own")}</Button>
            <Button size="sm" aria-pressed={detection.wanted} loading={wantBusy} onClick={want}>{detection.wanted ? t("lens.action.wanted") : t("lens.action.want")}</Button>
            <Button size="sm" onClick={() => goTab("recreate", detection.id)}>{t("lens.action.recreate")}</Button>
            <LensFlipButton side="front" />
          </div>
          {ownOpen && <LensPortal><LensOwnDialog detection={detection} open={ownOpen} onClose={() => setOwnOpen(false)} /></LensPortal>}
        </article>
      </FashionCardFront>
      <LensCardBack><DetectionBack detection={detection} /></LensCardBack>
    </FashionCard>
  );
}
