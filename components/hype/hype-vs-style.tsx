"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import type { StyleCompatibility } from "@/lib/hype/types";

/**
 * HYPE × SEU ESTILO lado a lado — e nunca misturados. O Hype diz se algo está relevante no FashionAI agora; a
 * compatibilidade diz se combina com o SEU DNA de estilo. Uma peça pode ter Hype 94 e combinar 38% com você.
 */
export function HypeVsStyle({ score, compatibility, signedIn }: { score?: number | null; compatibility?: StyleCompatibility | null; signedIn: boolean }) {
  const { t } = useI18n();
  return (
    <section className="hype-vs" aria-label={t("hype.vs.title")}>
      <div className="hype-vs-tile">
        <span className="hype-vs-k">{t("hype.vs.hype")}</span>
        <b className="hype-vs-v tabular">{score != null ? Math.round(score) : "—"}</b>
      </div>
      <div className="hype-vs-tile">
        <span className="hype-vs-k">{t("hype.vs.style")}</span>
        {compatibility ? <b className="hype-vs-v tabular">{compatibility.score}%</b>
          : signedIn ? <Link href="/dna" className="hype-vs-cta">{t("hype.vs.no_dna_cta")}</Link> : <b className="hype-vs-v">—</b>}
      </div>
      <p className="hype-vs-hint type-caption text-muted">{compatibility || !signedIn ? t("hype.vs.hint") : t("hype.vs.no_dna")}</p>
    </section>
  );
}
