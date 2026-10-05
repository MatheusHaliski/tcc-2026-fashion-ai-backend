"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { label } from "@/lib/api/taxonomy";
import type { LensReadingView } from "@/lib/lens/types";
import { FashionCard, FashionCardFront } from "@/components/fashion-card";
import { LensCardBack, LensFitTrend, LensFlipButton, LensMetric, LensSwatch } from "./lens-parts";

/**
 * LensReadingCard (§7.4): a leitura do look inteiro (ou da peça em foco). Frente = composição de estilo em barras com
 * %, paleta (amostra + nome), ocasiões e estação; verso = como a leitura foi feita e Compatibilidade × Hype separados.
 */
export function LensReadingCard({ reading, title, pieces }: { reading: LensReadingView; title: string; pieces: number }) {
  const { t } = useI18n();
  const styles = [...reading.styles].filter((s) => s.share > 0).sort((a, b) => b.share - a.share).slice(0, 5);
  return (
    <FashionCard name={title} className="lens-reading-wrap">
      <FashionCardFront>
        <article className="fai-card lens-reading" aria-label={t("lens.reading.aria", { title })}>
          <header className="lens-reading-head">
            <span className="min-w-0"><span className="hype-back-kicker">{t("lens.reading.kicker")}</span><h3 className="lens-det-title">{title}</h3></span>
            <LensFlipButton side="front" />
          </header>
          <div className="lens-reading-body">
            <section aria-label={t("lens.reading.styles")}>
              <p className="lens-sub">{t("lens.reading.styles")}</p>
              {styles.length ? <ul className="lens-metrics">{styles.map((s) => <LensMetric key={s.key} name={label(s.key)} value={s.share} suffix="%" />)}</ul>
                : <p className="type-caption text-muted">{t("lens.reading.no_styles")}</p>}
            </section>
            {reading.palette.length > 0 && (
              <section aria-label={t("lens.reading.palette")}>
                <p className="lens-sub">{t("lens.reading.palette")}</p>
                <ul className="lens-palette">{reading.palette.slice(0, 5).map((c, i) => <li key={`${c.name}-${i}`}><LensSwatch hex={c.hex} name={label(c.name)} /></li>)}</ul>
              </section>
            )}
            <dl className="lens-attrs is-inline">
              {reading.occasions.length > 0 && <div><dt>{t("common.ocasioes")}</dt><dd>{reading.occasions.map(label).join(", ")}</dd></div>}
              {reading.season && <div><dt>{t("common.season")}</dt><dd>{label(reading.season)}</dd></div>}
            </dl>
          </div>
        </article>
      </FashionCardFront>
      <LensCardBack>
        <article className="fai-card hype-back lens-reading-back">
          <header className="hype-back-head">
            <span className="min-w-0"><span className="hype-back-kicker">{t("lens.reading.back_title")}</span><span className="type-caption truncate">{title}</span></span>
            <LensFlipButton side="back" />
          </header>
          <div className="hype-back-body">
            <p className="type-body-sm">{t("lens.reading.explain", { n: pieces })}</p>
            <LensFitTrend compact fit={reading.fit} trend={reading.trend} />
          </div>
        </article>
      </LensCardBack>
    </FashionCard>
  );
}
