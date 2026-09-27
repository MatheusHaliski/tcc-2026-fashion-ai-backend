"use client";
import type { Dispatch, SetStateAction } from "react";
import { ChipMultiSelect } from "@/components/ui";
import { label, useTaxonomy } from "@/lib/api/taxonomy";
import { tagProblem } from "@/components/piece-form";
import { useI18n } from "@/lib/i18n/i18n";

/** Esquema de vestimenta (look e look DNA): até 3 ocasiões e até 3 estilos — a peça tem regra própria (até 2). */
export const SCHEME_MAX_TAGS = 3;

/** Ocasiões ou estilos de um look, no padrão de escolha múltipla (contador, limite explicado, valores inválidos à vista). */
export function SchemeTags<F extends { occasion: string[]; style: string[] }>({ k, form, setForm, tax, className }: {
  k: "occasion" | "style"; form: F; setForm: Dispatch<SetStateAction<F>>; tax: ReturnType<typeof useTaxonomy>; className?: string;
}) {
  const { t } = useI18n();
  const options = (k === "style" ? tax?.styles : tax?.occasions) ?? [];
  return (
    <ChipMultiSelect className={className} legend={t(k === "style" ? "common.style" : "common.occasion")} max={SCHEME_MAX_TAGS}
      options={options.map((o) => ({ id: o, label: label(o) }))} value={form[k]}
      onChange={(v) => setForm((f) => ({ ...f, [k]: v }))}
      hint={t(k === "style" ? "schemeTags.dica_estilos" : "schemeTags.dica_ocasioes")}
      limitMessage={t(k === "style" ? "schemeTags.limite_estilos" : "schemeTags.limite_ocasioes")}
      problem={(v) => tagProblem(k, v, tax, "")} />
  );
}
