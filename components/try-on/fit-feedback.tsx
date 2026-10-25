"use client";

import Link from "next/link";
import { cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import type { FitRegion, FitVerdict, SizeGrid } from "@/lib/tryon/sizes";

/**
 * Retorno de caimento no provador: uma frase ("Vestiu bem", "Está justo na cintura", "Ficou apertado no peito e na
 * cintura"), o comprimento quando foge da medida e, por região, como a peça fica. Sem altura e peso informados, um
 * convite para personalizar em Meu Avatar: a estimativa pelo corpo padrão é menos certa.
 */
export function FitFeedback({ grid, feedback, natural, personalized }: { grid: SizeGrid; feedback: FitVerdict; natural: string | null; personalized: boolean }) {
  const { t, locale } = useI18n();
  const list = (regions: FitRegion[]) => {
    const parts = regions.map((r) => t(`fit.onde.${r}`));
    try { return new Intl.ListFormat(locale, { type: "conjunction" }).format(parts); } catch { return parts.join(", "); }
  };
  const verdict = t(`fit.verdict.${feedback.verdict}`, { onde: list(feedback.where) }).trim();
  const length = feedback.length && feedback.length !== "true" ? t(`fit.comprimento.${feedback.length}`) : null;
  const regions = feedback.regions.filter((r) => r.region !== "foot");
  return (
    <span className={cn("fit-feedback", `is-${feedback.verdict}`)}>
      <span className="fit-feedback-verdict" role="status" aria-live="polite">
        <strong>{verdict}</strong>{length && <> · {length}</>}
      </span>
      {grid !== "shoes" && regions.length > 1 && (
        <span className="fit-feedback-regions">
          {regions.map((r) => (
            <span key={r.region} className={cn("fit-region", `is-${r.fit}`)}>
              {t(`fit.regiao.${r.region}`)}: {t(r.region === "length" ? `fit.comp.${r.fit}` : `fit.estado.${r.fit}`)}
            </span>
          ))}
        </span>
      )}
      {natural && <span className="fit-feedback-natural">{t(grid === "shoes" ? "fit.avatar_calca" : "fit.avatar_veste", { natural })}</span>}
      {!personalized && <Link className="fit-feedback-link" href="/avatar#medidas">{t("fit.personalizar")}</Link>}
    </span>
  );
}
