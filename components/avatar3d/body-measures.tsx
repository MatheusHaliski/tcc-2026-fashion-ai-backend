"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Field, Input, useToast } from "@/components/ui";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { TAPE_RANGE, defaultBodyModel, validateBody, withPersonalMeasures, type BodyModel, type Sex, type TapeMeasures } from "@/lib/avatar3d/body-spec";
import { bodyMeasures, bodyPosition, naturalSize } from "@/lib/tryon/sizes";

type TapeKey = keyof TapeMeasures;
const TAPE_KEYS: TapeKey[] = ["chest", "waist", "hip", "shoe"];
const RANGE = { height: [120, 220], weight: [30, 250] } as const;
const num = (s: string) => { const v = Number(s.replace(",", ".")); return s.trim() && Number.isFinite(v) ? v : null; };
const within = (v: number | null, [lo, hi]: readonly [number, number]) => v === null || (v >= lo && v <= hi);

/**
 * "Suas medidas" em Meu Avatar: altura e peso (e, se quiser, medidas de fita e o número do calçado). Altura e peso
 * deixam o corpo do avatar com o da pessoa; tudo junto faz o provador dizer se a roupa vestiu bem, ficou justa ou
 * apertada. Com avatar salvo, "Salvar medidas" grava só o corpo; antes disso, as medidas vão junto com o avatar.
 * Os números ficam só com a pessoa: quem vê o avatar recebe as proporções, sem altura, peso ou medidas.
 */
export function BodyMeasuresCard({ sex, initial, canSave, onDraft, onSaved }: {
  sex: Sex; initial: BodyModel | null; canSave: boolean; onDraft?: (body: BodyModel | null) => void; onSaved?: () => void;
}) {
  const { t, fmtNumber } = useI18n(); const toast = useToast();
  const [height, setHeight] = useState(initial?.heightCm ? String(initial.heightCm) : "");
  const [weight, setWeight] = useState(initial?.weightKg ? String(initial.weightKg) : "");
  const [tape, setTape] = useState<Record<TapeKey, string>>(() => Object.fromEntries(TAPE_KEYS.map((k) => [k, initial?.measuresCm?.[k] ? String(initial.measuresCm[k]) : ""])) as Record<TapeKey, string>);
  const [more, setMore] = useState(!!initial?.measuresCm);
  const [busy, setBusy] = useState(false);
  const h = num(height), w = num(weight), tapeNums = Object.fromEntries(TAPE_KEYS.map((k) => [k, num(tape[k])])) as Record<TapeKey, number | null>;
  const errors = {
    height: !within(h, RANGE.height), weight: !within(w, RANGE.weight),
    ...Object.fromEntries(TAPE_KEYS.map((k) => [k, !within(tapeNums[k], TAPE_RANGE[k])])),
  } as Record<"height" | "weight" | TapeKey, boolean>;
  const valid = !Object.values(errors).some(Boolean);
  const model = useMemo(() => {
    const base = validateBody(initial) ?? defaultBodyModel(sex);
    return withPersonalMeasures(base, valid ? h : null, valid ? w : null, valid ? tapeNums : null);
  }, [initial, sex, h, w, JSON.stringify(tapeNums), valid]); // eslint-disable-line react-hooks/exhaustive-deps
  const informed = h !== null || w !== null || !!model.measuresCm;
  useEffect(() => { if (!canSave) onDraft?.(valid && informed ? model : null); }, [model, valid, informed, canSave]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = bodyMeasures(model.params, model.sex, model.measuresCm);
  const sizes = {
    top: naturalSize("letter", bodyPosition("letter", model.sex, m, "upper_piece", model.params.stature)),
    pants: naturalSize("numeric", bodyPosition("numeric", model.sex, m, "lower_piece", model.params.stature)),
    shoe: naturalSize("shoes", bodyPosition("shoes", model.sex, m, "shoes_piece")),
  };
  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    try { await api.patch("/api/me/avatar3d", { body: model }); toast.success(t("medidas.salvas")); onSaved?.(); }
    catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  const field = (key: "height" | "weight" | TapeKey, value: string, set: (v: string) => void, range: readonly [number, number]) => (
    <Field id={`medida-${key}`} label={t(`medidas.${key}`)} error={errors[key] ? t("medidas.fora_da_faixa", { min: range[0], max: range[1] }) : undefined} className="mb-0">
      <Input id={`medida-${key}`} inputMode="decimal" autoComplete="off" value={value} error={errors[key]} onChange={(e) => set(e.target.value)} />
    </Field>
  );
  return (
    <Card>
      <section id="medidas" aria-labelledby="medidas-titulo" className="grid gap-3">
        <div>
          <h2 id="medidas-titulo" className="type-h3">{t("medidas.titulo")}</h2>
          <p className="type-body-sm text-muted">{t("medidas.lead")}</p>
        </div>
        <div className="body-measures-grid">
          {field("height", height, setHeight, RANGE.height)}
          {field("weight", weight, setWeight, RANGE.weight)}
        </div>
        <div>
          <Button size="sm" variant="ghost" aria-expanded={more} aria-controls="medidas-fita" onClick={() => setMore((v) => !v)}>{t(more ? "medidas.menos" : "medidas.mais")}</Button>
        </div>
        {more && (
          <div id="medidas-fita" className="grid gap-2">
            <p className="type-caption text-muted">{t("medidas.fita_dica")}</p>
            <div className="body-measures-grid">
              {TAPE_KEYS.map((k) => <div key={k}>{field(k, tape[k], (v) => setTape((old) => ({ ...old, [k]: v })), TAPE_RANGE[k])}</div>)}
            </div>
          </div>
        )}
        <p className="type-body-sm" role="status" aria-live="polite">
          {t("medidas.estimado", { top: sizes.top, pants: sizes.pants, shoe: sizes.shoe })}
          <span className="text-muted"> · {t("medidas.medidas_cm", { chest: fmtNumber(Math.round(m.chest)), waist: fmtNumber(Math.round(m.waist)), hip: fmtNumber(Math.round(m.hip)) })}</span>
        </p>
        <p className="type-caption text-muted">{t("medidas.privacidade")}</p>
        {canSave
          ? <div><Button variant="primary" disabled={!valid || busy} onClick={save}>{t(busy ? "medidas.salvando" : "medidas.salvar")}</Button></div>
          : <p className="type-caption text-muted">{t("medidas.junto_do_avatar")}</p>}
      </section>
    </Card>
  );
}
