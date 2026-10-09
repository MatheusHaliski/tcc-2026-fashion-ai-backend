"use client";
import { ChipMultiSelect, Dropdown, Field, Input, SegmentPicker } from "@/components/ui";
import { DIMENSION_ORDER, LEVELS, dimensionsFor } from "@/lib/hype/model";
import type { HypeLevel, HypeMomentum } from "@/lib/hype/types";
import { useI18n } from "@/lib/i18n/i18n";
import { HYPE_MOMENTUM_CHOICES, MAX_HYPE_MOMENTUM, type SealHypeCriteria, type SealTierId } from "@/components/seal-policy-editor";

/** Política de um selo do emissor; os números são metas, a elegibilidade é conferida no servidor. */
export function SealHypeEditor({ value, onChange, tier, onTier }: {
  value: SealHypeCriteria; onChange: (criteria: SealHypeCriteria) => void;
  tier: SealTierId; onTier: (tier: "LOOK" | "PECA") => void;
}) {
  const { t } = useI18n();
  const set = (patch: Partial<SealHypeCriteria>) => onChange({ ...value, ...patch });
  const numeric = (raw: string) => raw.trim() === "" || !Number.isFinite(Number(raw)) ? null : Math.min(100, Math.max(0, Math.round(Number(raw))));
  return <section className="grid gap-3" aria-label={t("sealHypeIssuer.criteria")}>
    <p className="type-body-sm text-muted">{t("sealHypeIssuer.criteria_hint")}</p>
    <SegmentPicker label={t("sealPolicy.nivel")} value={tier === "PECA" ? "PECA" : "LOOK"} onChange={(next) => {
      onTier(next);
      if (next === "PECA" && value.dimensionMins?.INFLUENCE != null) {
        const { INFLUENCE: _ignored, ...dimensionMins } = value.dimensionMins; void _ignored; set({ dimensionMins });
      }
    }} options={[{ id: "LOOK", label: t("sealPolicy.nivel_look") }, { id: "PECA", label: t("sealPolicy.nivel_peca") }]} />
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("sealPolicy.hype.nivel_minimo")} id="issuer-hype-level"><Dropdown block id="issuer-hype-level" value={value.minLevel ?? ""}
        onChange={(minLevel) => set({ minLevel: (minLevel || null) as HypeLevel | null })}
        options={[{ id: "", label: t("sealPolicy.hype.qualquer_nivel") }, ...LEVELS.map((level) => ({ id: level, label: t(`hype.level.${level}`) }))]} /></Field>
      <Field label={t("sealPolicy.hype.score_minimo")} id="issuer-hype-score" hint={t("sealPolicy.hype.score_dica")}><Input type="number" inputMode="numeric" id="issuer-hype-score" min={0} max={100} step={1}
        value={value.minScore ?? ""} onChange={(event) => set({ minScore: numeric(event.target.value) })} /></Field>
    </div>
    <ChipMultiSelect legend={t("sealPolicy.hype.momento")} max={MAX_HYPE_MOMENTUM} value={value.momentum ?? []} onChange={(momentum) => set({ momentum: momentum as HypeMomentum[] })}
      options={HYPE_MOMENTUM_CHOICES.map((momentum) => ({ id: momentum, label: t(`sealPolicy.hype.chip.${momentum}`) }))} hint={t("sealPolicy.hype.momento_dica")} />
    <fieldset>
      <legend className="label mb-1">{t("sealHypeIssuer.dimensions")}</legend>
      <p className="help mb-3">{t("sealHypeIssuer.dimensions_hint")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {dimensionsFor(tier === "PECA" ? "PIECE" : "SCHEME", DIMENSION_ORDER).map((dimension) => <Field key={dimension} label={t(`hype.dimension.${dimension}`)} id={`issuer-hype-${dimension}`} hint={t(`hype.dimension_hint.${dimension}`)}>
          <Input id={`issuer-hype-${dimension}`} type="number" inputMode="numeric" min={0} max={100} step={1} value={value.dimensionMins?.[dimension] ?? ""}
            placeholder={t("sealHypeIssuer.no_minimum")} onChange={(event) => {
              const dimensionMins = { ...value.dimensionMins }, min = numeric(event.target.value);
              if (min == null) delete dimensionMins[dimension]; else dimensionMins[dimension] = min;
              set({ dimensionMins });
            }} />
        </Field>)}
      </div>
    </fieldset>
    <p role="note" className="type-caption text-muted">{t("sealHypeIssuer.server_validation")}</p>
  </section>;
}
