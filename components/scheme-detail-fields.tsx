"use client";
import type { Dispatch, SetStateAction } from "react";
import { Field, Select } from "@/components/ui";
import { label } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";
import { PieceColecaoField } from "@/components/piece-colecao-field";
import { PieceIntensidadeTermicaField } from "@/components/piece-intensidade-termica-field";

export const MOODS = ["COMFORTABLE", "ELEGANT", "SOPHISTICATED", "ENERGETIC"];

type LookDetails = { season: string; mood: string; colecaoId: string | null; intensidadeTermicaId: string | null };

/**
 * Detalhes do look no formulário de cadastro: estação e humor (listas fixas) e coleção e intensidade térmica (opções
 * das tabelas colecao e intensidade_termica; o valor salvo é o ID, gravado como FK em schemes).
 */
export function SchemeDetailFields<F extends LookDetails>({ form, setForm }: { form: F; setForm: Dispatch<SetStateAction<F>> }) {
  const { t } = useI18n();
  return <>
    <Field label={t("common.season")} id="season"><Select id="season" value={form.season ?? ""} onChange={(e) => setForm({ ...form, season: e.target.value })}><option value="">—</option>{["SPRING", "SUMMER", "AUTUMN", "WINTER"].map((s) => <option key={s} value={s}>{label(s.toLowerCase())}</option>)}</Select></Field>
    <Field label={t("common.mood")} id="mood"><Select id="mood" value={form.mood ?? ""} onChange={(e) => setForm({ ...form, mood: e.target.value })}><option value="">—</option>{MOODS.map((m) => <option key={m} value={m}>{label(m.toLowerCase())}</option>)}</Select></Field>
    <PieceColecaoField value={form.colecaoId ?? ""} hint={null} onChange={(id) => setForm({ ...form, colecaoId: id || null })} />
    <PieceIntensidadeTermicaField value={form.intensidadeTermicaId ?? ""} hint={null}
      onChange={(id) => setForm({ ...form, intensidadeTermicaId: id || null })} />
  </>;
}
