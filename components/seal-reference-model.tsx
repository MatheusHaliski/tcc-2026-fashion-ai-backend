"use client";
import { label, subcategoryLabel } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";
import type { SealReferenceModel } from "@/lib/seals/reference-model";

export function SealReferencePreview({ model }: { model: SealReferenceModel }) {
  const { t } = useI18n();
  const background = (bg: Record<string, unknown>) => Object.entries(bg).map(([key, value]) => (
    <li key={key}>{t(`sealCopilot.background.${key}`)}: {typeof value === "object" && value !== null
      ? Object.values(value).map((v) => label(String(v))).join(", ") : label(String(value))}</li>
  ));
  return <section aria-label={t("sealCopilot.reference")} className="seal-ai-note mt-3">
    <h3 className="type-h3">{model.title}</h3>
    <p className="type-body-sm mt-2">{model.description}</p>
    {model.tier === "PERFIL" && <p className="help mt-2">{t("sealCopilot.profile_hint")} · {t(`sealCopilot.target.${model.target}`)}</p>}
    {model.earnedSeals && <div className="mt-2"><p className="label">{t("sealCopilot.earned")}</p>
      <p className="help">{t(model.earnedSeals.match === "ALL" ? "sealCopilot.earned_all" : "sealCopilot.earned_any")}</p>
      <ul className="type-caption">{model.earnedSeals.rules.map((r, i) => <li key={i}>{r.name ?? r.sealId} · {t(`sealCopilot.scope.${r.scope}`)} · {t("sealCopilot.earned_count", { n: r.minCount })}</li>)}</ul>
    </div>}
    <p className="help mt-2">{t("sealCopilot.reference_hint")}</p>
    <p className="type-caption mt-2">{t(model.match === "ANY" ? "sealPolicy.qualquer_regra" : "sealPolicy.todas_as_regras")}</p>
    <div className="grid gap-3 mt-3 sm:grid-cols-2">
      {model.pieces.map((piece, i) => <article key={i} className="rounded-lg border p-3">
        <h4 className="type-body-sm font-semibold">{piece.name || subcategoryLabel(piece.subcategory) || label(piece.category) || t("sealPolicy.pecas")}</h4>
        <p className="type-caption">{t(`sealCopilot.quantity.${piece.quantifier}`, { n: piece.count })}</p>
        <dl className="type-caption mt-2 grid gap-1">
          {(["category", "subcategory", "brand", "color", "material", "variation", "sex", "size", "market"] as const).filter((k) => piece[k]).map((k) => <div key={k}>
            <dt className="inline text-muted">{t(`sealCopilot.field.${k}`)}: </dt><dd className="inline">{k === "brand" ? piece[k] : k === "subcategory" ? subcategoryLabel(piece[k]) : label(piece[k])}</dd>
          </div>)}
          {Object.entries(piece.attributes ?? {}).map(([dimension, codes]) => <div key={dimension}><dt className="inline text-muted">{label(dimension)}: </dt><dd className="inline">{codes.map(label).join(", ")}</dd></div>)}
        </dl>
        {piece.background && <ul className="type-caption mt-2">{background(piece.background)}</ul>}
      </article>)}
    </div>
    <p className="type-caption mt-3">{t("sealCopilot.total", { min: model.minPieces, max: model.maxPieces ?? "∞" })}</p>
    {model.background && <div className="mt-2"><p className="label">{t("sealCopilot.look_background")}</p><ul className="type-caption">{background(model.background)}</ul></div>}
  </section>;
}
