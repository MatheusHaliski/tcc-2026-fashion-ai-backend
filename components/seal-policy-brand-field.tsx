"use client";
import { useEffect, useState } from "react";
import { Button, Field, Input, SegmentPicker } from "@/components/ui";
import { ReferenceSelectField } from "@/components/reference-select-field";
import { useI18n } from "@/lib/i18n/i18n";

/**
 * Exercício 13 — marca exigida por uma regra da política do selo. A regra guarda o tipo e o ID da marca escolhida na
 * lista (`brandReference`), nunca o texto digitado: a busca só filtra as opções. `CATALOG` são as marcas do catálogo
 * (`brands`) e `PROFILE` os perfis de marca aprovados (`brand_profiles`). Regra antiga, com a marca em texto, continua
 * aparecendo como texto não verificado e pode ser trocada por uma marca da lista.
 */
export type SealBrandKind = "CATALOG" | "PROFILE";
export interface SealBrandReference { kind: SealBrandKind; id: string; nome?: string | null; /** só na leitura: a marca ainda existe? */ disponivel?: boolean }
interface BrandRule { brand?: string | null; brandReference?: SealBrandReference | null }

const KINDS: SealBrandKind[] = ["CATALOG", "PROFILE"];

export function SealPolicyBrandField({ index, rule, onChange }: {
  index: number; rule: BrandRule; onChange: (patch: BrandRule) => void;
}) {
  const { t } = useI18n();
  const reference = rule.brandReference ?? null;
  const [kind, setKind] = useState<SealBrandKind>(reference?.kind ?? "CATALOG");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  // a busca espera a pessoa parar de digitar: cada tecla não vira uma chamada
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const path = `/api/opcoes/marcas-politica?kind=${kind}${term ? `&q=${encodeURIComponent(term)}` : ""}`;
  const legacy = !reference && rule.brand?.trim() ? rule.brand.trim() : "";
  const changeKind = (next: SealBrandKind) => {
    setKind(next);
    if (reference && reference.kind !== next) onChange({ brandReference: null });   // o ID só vale junto do tipo
  };
  return (
    <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2" data-seal-brand-field={index}>
      <div className="sm:col-span-2">
        <p className="label mb-1">{t("sealPolicy.marcaRef.tipo")}</p>
        <SegmentPicker label={t("sealPolicy.marcaRef.tipo")} value={kind} onChange={changeKind}
          options={KINDS.map((k) => ({ id: k, label: t(`sealPolicy.marcaRef.kind.${k}`) }))} />
      </div>
      <Field label={t("sealPolicy.marcaRef.buscar")} id={`sp-brand-q-${index}`} hint={t("sealPolicy.marcaRef.buscar_dica")}>
        <Input id={`sp-brand-q-${index}`} type="search" value={search} maxLength={80} onChange={(e) => setSearch(e.target.value)} />
      </Field>
      <ReferenceSelectField id={`sp-brand-${index}`} path={path} messages="sealPolicy.marcaRef" stateAttr="seal-brand"
        value={reference?.id ?? ""} selectedName={reference?.nome}
        onChange={(id) => { if (!id) onChange({ brandReference: null }); }}
        onSelect={(option) => { if (option) onChange({ brand: null, brandReference: { kind, id: option.id, nome: option.nome } }); }} />
      {reference?.disponivel === false && <p role="status" className="error-text sm:col-span-2">{t("sealPolicy.marcaRef.indisponivel", { b: reference.nome ?? "" })}</p>}
      {legacy && <div className="sm:col-span-2 flex flex-wrap items-center gap-2" data-seal-brand-legacy>
        <p className="help">{t("sealPolicy.marcaRef.legado", { b: legacy })}</p>
        <Button size="sm" type="button" variant="ghost" onClick={() => onChange({ brand: null })}>{t("sealPolicy.marcaRef.remover_legado")}</Button>
      </div>}
    </div>
  );
}
