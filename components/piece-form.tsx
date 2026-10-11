"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api, mediaUrl, type ApiError } from "@/lib/api/client";
import { tr, useI18n } from "@/lib/i18n/i18n";
import { CATEGORY_LABEL, label, useTaxonomy, subcategoryLabel } from "@/lib/api/taxonomy";
import { Button, ChipMultiSelect, Field, Input, Select, Spinner } from "@/components/ui";
import { BrandSearchInput } from "@/components/brand-search-input";
import { FaiIcon } from "@/components/fai-icon";
import { SealSuggestionHype } from "@/components/hype/hype-seals";
import type { HypeLevel } from "@/lib/hype/types";
import { MAX_TAGS, keepAllowed } from "@/lib/pieces/tags";

export interface PieceFormValue {
  draftId?: string | null; useDefaultImage: boolean; name: string; category: string; subcategory: string; sex: string; brandId?: string | null; brandName: string;
  color: string; material: string; size: string; market?: string; occasion: string[]; style: string[]; seals: string[]; price: string; visibility: string;
  tags: string; notes: string; condition: string; purchaseDate: string; purchaseLocation: string; sku: string; careInstructions: string; forSale: boolean;
  /** RF4 · Estúdio: false = salvar sem a foto de estúdio gerada no rascunho */
  studio?: boolean;
  /** RF4 · buscador web de marcas: logo filtrado (fundo branco, letras pretas), fonte e referência externa */
  brandLogoUrl?: string | null; brandLogoWideUrl?: string | null; brandSource?: string | null; brandRef?: string | null; brandDomain?: string | null; brandEdgePx?: number | null;
  /** RF4 · Arte de fundo da peça (aura, material, skin, anatomia) — mesmo formato do look */
  background?: Record<string, unknown> | null;
  variation?: string | null; attributes?: Record<string, string[]>;
}
export const EMPTY_PIECE: PieceFormValue = { draftId: null, useDefaultImage: false, name: "", category: "", subcategory: "", sex: "UNISSEX", brandName: "", color: "", material: "", size: "m", occasion: [], style: [], seals: [], price: "", visibility: "PRIVATE", tags: "", notes: "", condition: "", purchaseDate: "", purchaseLocation: "", sku: "", careInstructions: "", forSale: false, background: null };
/** "Sem marca" é o que a análise escreve no campo quando não acha marca na peça; o backend salva a peça sem marca. */
const NO_BRAND = ["sem marca", "no brand", "sin marca"];
export const isNoBrand = (name?: string | null) => !!name && NO_BRAND.includes(name.trim().toLowerCase());
/** As quatro categorias de peça (RF4.CA): parte de cima, parte de baixo, calçado e acessório. */
export const PIECE_CATEGORIES = ["upper_piece", "lower_piece", "shoes_piece", "accessory_piece"];

export function toPayload(v: PieceFormValue) {
  // só o que o backend guarda: o logo largo, o domínio e a medida de nitidez são apenas do slot do formulário
  const { brandLogoWideUrl: _w, brandDomain: _d, brandEdgePx: _e, ...rest } = v; void _w; void _d; void _e;
  return { ...rest, brandLogoUrl: v.brandLogoUrl || null, brandSource: v.brandSource || null, brandRef: v.brandRef || null, price: v.price === "" ? null : Number(v.price), tags: v.tags.split(",").map((s) => s.trim()).filter(Boolean), brandId: v.brandId || null, purchaseDate: v.purchaseDate || null, condition: v.condition || null, market: v.market || null, background: v.background ?? null };
}

/** `hype`: HypeScore atual da peça avaliada (RF53); sem cálculo ainda, vem null e nada aparece. */
interface SealOption { targetOwnerId: string; kind: "BRAND" | "CELEBRITY"; name: string; logoUrl?: string | null; confidence: number; justification?: string; hype?: { score: number | null; level: HypeLevel | null } | null }
/** identificador guardado em seals[] da peça: tipo + nome (o mesmo formato "TIPO:nome" que o card lê) */
const sealId = (s: SealOption) => `${s.kind}:${s.name}`;

/**
 * Selos da peça (RF4 · Mais detalhes): nada de rótulos padronizados — a IA compara marca, tipo, cor, ocasião e estilo com
 * as marcas e celebridades cadastradas e sugere as que têm peça semelhante. Enquanto procura, avisa.
 */
export function PieceSealSuggestions({ value, onChange }: { value: PieceFormValue; onChange: (v: PieceFormValue) => void }) {
  const { t, fmtNumber } = useI18n();
  const [search, setSearch] = useState<{ loading: boolean; list: SealOption[]; message?: string | null; failed?: boolean }>({ loading: false, list: [] });
  const key = JSON.stringify([value.name, value.brandName, value.category, value.subcategory, value.color, value.occasion, value.style,
    value.material, value.variation, value.attributes, value.sex, value.size, value.market, value.background]);
  useEffect(() => {
    if (!(value.brandName ?? "").trim() && !value.subcategory && value.style.length === 0) { setSearch({ loading: false, list: [] }); return; }
    let alive = true; setSearch((x) => ({ ...x, loading: true, failed: false }));
    const h = setTimeout(() => {
      api.post<{ suggestions: SealOption[]; message?: string | null }>("/api/seal-suggestions/preview-piece", { name: value.name, category: value.category, subcategory: value.subcategory, color: value.color, brandName: value.brandName, occasion: value.occasion, style: value.style,
        material: value.material, variation: value.variation, attributes: value.attributes, sex: value.sex, size: value.size, market: value.market, background: value.background })
        .then((r) => { if (alive) setSearch({ loading: false, list: r.suggestions ?? [], message: r.message }); })
        .catch(() => { if (alive) setSearch({ loading: false, list: [], failed: true }); });
    }, 400);
    return () => { alive = false; clearTimeout(h); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (s: SealOption) => { const id = sealId(s); const on = value.seals.includes(id); onChange({ ...value, seals: on ? value.seals.filter((x) => x !== id) : value.seals.length < 2 ? [...value.seals, id] : value.seals }); };
  return (
    <div className="grid gap-2" aria-busy={search.loading}>
      {search.loading ? <p className="flex items-center gap-2 type-body-sm text-muted" role="status"><Spinner size={16} />{t("schemeBuilder.pesquisando_selos")}</p> : (
        <>
          {search.list.map((s) => { const on = value.seals.includes(sealId(s)); return (
            <button key={s.targetOwnerId} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(s)} className={`list-row is-action flex items-center gap-3 text-left ${on ? "is-active" : ""}`}>
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-line-soft bg-surface">{s.logoUrl ? <img src={mediaUrl(s.logoUrl)} alt="" className="h-full w-full object-contain" /> : <FaiIcon id={s.kind === "CELEBRITY" ? "ACT-27" : "ACT-26"} size={20} decorative />}</span>
              <span className="min-w-0 flex-1"><span className="block type-body"><b>{s.name}</b> <span className="text-faint">· {s.kind === "CELEBRITY" ? t("schemeBuilder.selo_celebridade") : t("schemeBuilder.selo_marca")}</span></span>{s.justification && <span className="block type-caption text-muted">{s.justification}</span>}<SealSuggestionHype hype={s.hype} /></span>
              <span className="type-data text-muted">{fmtNumber(Math.round(s.confidence * 100))}%</span>
              <span aria-hidden className={`grid h-5 w-5 place-items-center rounded border ${on ? "border-ink bg-ink text-surface" : "border-line"}`}>{on ? "✓" : ""}</span>
            </button>); })}
          {!search.list.length && <p className="type-body-sm text-muted">{search.failed ? t("schemeBuilder.selos_indisponiveis") : search.message ?? t("pieceForm.selos_por_comparacao")}</p>}
        </>
      )}
    </div>
  );
}

/** Campos de "Mais detalhes" (RF4): selos pela IA, visibilidade e à venda (RF4.CA8). */
export function PieceMoreDetails({ value, onChange, error, idPrefix = "" }: { value: PieceFormValue; onChange: (v: PieceFormValue) => void; error?: ApiError | null; idPrefix?: string }) {
  const { t } = useI18n(); const err = error?.fields ?? {};
  const set = <K extends keyof PieceFormValue>(k: K, v: PieceFormValue[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-x-4 sm:grid-cols-2">
      <Field label={t("pieceForm.selos_da_peca")} error={err.seals} className="sm:col-span-2"><PieceSealSuggestions value={value} onChange={onChange} /></Field>
      <Field label={t("common.visibility")} id={`${idPrefix}visibility`} error={err.visibility}><Select id={`${idPrefix}visibility`} value={value.visibility} onChange={(e) => set("visibility", e.target.value)}><option value="PRIVATE">{t("common.private")}</option><option value="FOLLOWERS">{t("common.followers")}</option><option value="PUBLIC">{t("common.public")}</option></Select></Field>
      <label className="mb-3 flex items-start gap-2 self-end pb-3 type-body"><input type="checkbox" className="mt-1" checked={value.forSale} onChange={(e) => set("forSale", e.target.checked)} /><span><span className="whitespace-nowrap">{t("common.forSale")}</span><span className="block type-caption text-muted">{t("pieceForm.a_venda_aparece_na_sub_aba")}</span></span></label>
    </div>
  );
}

/** Dados da peça (RF4/RF7) dirigidos pela taxonomia oficial; até 2 ocasiões e 2 estilos; cor sempre com nome (acessível). */
export function PieceFields({ value, onChange, error, fieldErrors, afterBrand }: {
  value: PieceFormValue; onChange: (v: PieceFormValue) => void; error?: ApiError | null; fieldErrors?: Record<string, string>;
  /** nota logo abaixo do campo Marca (ex.: marca lida com incerteza na foto, com "Usar {marca}") */
  afterBrand?: React.ReactNode;
}) {
  const { t } = useI18n(); const tax = useTaxonomy(); const err: Record<string, string> = { ...(error?.fields ?? {}), ...(fieldErrors ?? {}) };
  const set = <K extends keyof PieceFormValue>(k: K, v: PieceFormValue[K]) => onChange({ ...value, [k]: v });
  const allowedOccasions = (category: string) => (category ? tax?.allowedOccasionsByCategory?.[category] : undefined) ?? tax?.occasions;
  const occasions = allowedOccasions(value.category) ?? [];
  const categories = Object.keys(tax?.subcategories ?? {}).filter((c) => PIECE_CATEGORIES.includes(c));
  // código fora da taxonomia (peça antiga): o ChipMultiSelect mostra o problema com "Remover" — nada some em silêncio
  return (
    <div className="grid gap-x-4 sm:grid-cols-2">
      <Field label={t("common.nome")} id="name" required error={err.name} className="sm:col-span-2"><Input id="name" value={value.name} onChange={(e) => set("name", e.target.value)} required maxLength={80} /></Field>
      <Field label={t("common.category")} id="category" required error={err.category}>
        <Select id="category" value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value, subcategory: "", occasion: keepAllowed(value.occasion, allowedOccasions(e.target.value)) })}><option value="">—</option>{categories.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</option>)}</Select>
      </Field>
      <Field label={t("common.subcategory")} id="subcategory" required error={err.subcategory}>
        <Select id="subcategory" value={value.subcategory} onChange={(e) => set("subcategory", e.target.value)} disabled={!value.category}><option value="">—</option>{(tax?.subcategories?.[value.category] ?? []).map((s) => <option key={s} value={s}>{subcategoryLabel(s)}</option>)}</Select>
      </Field>
      <Field label={t("common.color")} id="color" required error={err.color} hint={value.color ? `${label(value.color)}${tax?.colors?.[value.color] ? ` (${tax.colors[value.color]})` : ""}` : undefined}>
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-6 w-6 shrink-0 rounded-full border border-line-soft" style={{ background: tax?.colors?.[value.color] ?? "transparent" }} />
          <Select id="color" value={value.color} onChange={(e) => set("color", e.target.value)}><option value="">—</option>{Object.entries(tax?.colors ?? {}).map(([k]) => <option key={k} value={k}>{label(k)}</option>)}</Select>
        </div>
      </Field>
      <Field label={t("common.material")} id="material" required error={err.material}><Select id="material" value={value.material} onChange={(e) => set("material", e.target.value)}><option value="">—</option>{(tax?.materials ?? []).map((m) => <option key={m} value={m}>{label(m.toLowerCase())}</option>)}</Select></Field>
      <Field label={t("pieceForm.sexo")} id="sex" required error={err.sex}><Select id="sex" value={value.sex} onChange={(e) => set("sex", e.target.value)}>{(tax?.sexes ?? ["MASCULINO", "FEMININO", "UNISSEX"]).map((s) => <option key={s} value={s}>{label(s.toLowerCase())}</option>)}</Select></Field>
      <Field label={t("common.size")} id="size" required error={err.size}><Select id="size" value={value.size} onChange={(e) => set("size", e.target.value)}>{(tax?.sizes ?? ["m"]).map((s) => <option key={s} value={s}>{s.toUpperCase().replace("BR_", "BR ")}</option>)}</Select></Field>
      <Field label={t("common.brand")} id="brand" error={err.brandName} className="sm:col-span-2">
        <BrandSearchInput error={err.brandName}
          value={{ brandName: value.brandName, brandLogoUrl: value.brandLogoUrl ?? null, brandLogoWideUrl: value.brandLogoWideUrl ?? null, brandSource: value.brandSource ?? null, brandRef: value.brandRef ?? null, brandDomain: value.brandDomain ?? null, edgePx: value.brandEdgePx ?? null }}
          onChange={(b) => onChange({ ...value, brandId: null, brandName: b.brandName, brandLogoUrl: b.brandLogoUrl, brandLogoWideUrl: b.brandLogoWideUrl ?? null, brandSource: b.brandSource, brandRef: b.brandRef, brandDomain: b.brandDomain ?? null, brandEdgePx: b.edgePx ?? null })} />
      </Field>
      {afterBrand}
      <Field label={t("pieceForm.usd", { txt: t("common.price") })} id="price" required error={err.price}><Input id="price" type="number" step="0.01" min="0" inputMode="decimal" value={value.price} onChange={(e) => set("price", e.target.value)} /></Field>
      <ChipMultiSelect className="sm:col-span-2" legend={t("common.occasion")} max={PIECE_MAX_TAGS} options={occasions.map((o) => ({ id: o, label: label(o) }))} value={value.occasion} onChange={(v) => set("occasion", v)}
        error={err.occasion} hint={t("pieceForm.dica_ocasioes")} limitMessage={t("pieceForm.limite_ocasioes")} problem={(v) => tagProblem("occasion", v, tax, value.category)} />
      <ChipMultiSelect className="sm:col-span-2" legend={t("common.style")} max={PIECE_MAX_TAGS} options={(tax?.styles ?? []).map((o) => ({ id: o, label: label(o) }))} value={value.style} onChange={(v) => set("style", v)}
        error={err.style} hint={t("pieceForm.dica_estilos")} limitMessage={t("pieceForm.limite_estilos")} problem={(v) => tagProblem("style", v, tax, value.category)} />
    </div>
  );
}

/** Peça: até 2 ocasiões e até 2 estilos (esquemas de vestimenta: até 3 — regra própria, em scheme-builder). */
export const PIECE_MAX_TAGS = MAX_TAGS;

/**
 * Mensagem para um valor que não pertence à lista do campo (sugestão da IA ou dado antigo): diz o que ele é e como
 * corrigir — nunca "valor fora da taxonomia". Ex.: "casual" é ocasião, não estilo.
 */
export function tagProblem(field: "occasion" | "style", v: string, tax: ReturnType<typeof useTaxonomy>, category: string): string {
  const occ = tax?.occasions ?? [], sty = tax?.styles ?? [];
  if (field === "style" && occ.includes(v)) return tr("pieceForm.e_ocasiao_nao_estilo", { v: label(v) });
  if (field === "occasion" && sty.includes(v)) return tr("pieceForm.e_estilo_nao_ocasiao", { v: label(v) });
  if (field === "occasion" && occ.includes(v)) return tr("pieceForm.ocasiao_fora_da_categoria", { v: label(v), cat: CATEGORY_LABEL[category] ?? label(category) });
  return tr(field === "style" ? "pieceForm.estilo_desconhecido" : "pieceForm.ocasiao_desconhecida", { v });
}

/** Campos da peça em cada etapa do criador (para levar a pessoa ao campo com problema). */
export const PIECE_FIELD_STEP: Record<string, "data" | "more"> = {
  name: "data", category: "data", subcategory: "data", color: "data", material: "data", sex: "data", size: "data", brandName: "data",
  price: "data", occasion: "data", style: "data", seals: "more", visibility: "more", forSale: "more", market: "data",
};

/** Validação no cliente, antes de enviar — as mesmas regras do servidor, com as mesmas mensagens compreensíveis. */
export function validatePieceForm(v: PieceFormValue, tax: ReturnType<typeof useTaxonomy>): Record<string, string> {
  const e: Record<string, string> = {};
  const need = (k: string, ok: boolean, msg: string) => { if (!ok) e[k] = msg; };
  need("name", !!(v.name ?? "").trim(), tr("pieceForm.err_nome"));
  need("category", !!v.category, tr("pieceForm.err_escolha", { campo: tr("common.category").toLowerCase() }));
  need("subcategory", !!v.subcategory, tr("pieceForm.err_escolha", { campo: tr("common.subcategory").toLowerCase() }));
  need("color", !!v.color, tr("pieceForm.err_escolha", { campo: tr("common.color").toLowerCase() }));
  need("material", !!v.material, tr("pieceForm.err_escolha", { campo: tr("common.material").toLowerCase() }));
  need("price", v.price !== "" && Number(v.price) >= 0, tr("pieceForm.err_preco"));
  const occasions = v.category ? tax?.allowedOccasionsByCategory?.[v.category] ?? tax?.occasions ?? [] : tax?.occasions ?? [];
  const check = (k: "occasion" | "style", allowed: string[]) => {
    const list = Array.from(new Set(v[k]));
    const bad = list.find((x) => !allowed.includes(x));
    if (bad) e[k] = tagProblem(k, bad, tax, v.category);
    else if (list.length === 0) e[k] = tr(k === "style" ? "pieceForm.err_estilo_obrigatorio" : "pieceForm.err_ocasiao_obrigatoria");
    else if (list.length > PIECE_MAX_TAGS) e[k] = tr(k === "style" ? "pieceForm.limite_estilos" : "pieceForm.limite_ocasioes");
  };
  if (tax) { check("occasion", occasions); check("style", tax.styles ?? []); }
  return e;
}

/** Formulário completo (edição da peça no card ampliado): dados + "Mais detalhes" recolhível com seta. */
export function PieceForm({ value, onChange, onSubmit, busy, error, fieldErrors, submitLabel, prefilledNote }: {
  value: PieceFormValue; onChange: (v: PieceFormValue) => void; onSubmit: () => void; busy?: boolean; error?: ApiError | null; fieldErrors?: Record<string, string>; submitLabel: string; prefilledNote?: string;
}) {
  const { t } = useI18n(); const err = error?.fields ?? {};
  function submit(e: FormEvent) { e.preventDefault(); onSubmit(); }
  // "Mais detalhes" abre sozinho quando já há algo preenchido ali (edição) ou quando o servidor apontou erro nesses campos.
  const moreOpen = ["seals", "visibility", "forSale"].some((k) => err[k]) || !!(value.seals.length || value.forSale);
  return (
    <form onSubmit={submit} noValidate className="grid gap-2">
      {prefilledNote && <p className="mb-3 rounded-md bg-thread-soft p-3 type-body-sm">{prefilledNote}</p>}
      <PieceFields value={value} onChange={onChange} error={error} fieldErrors={fieldErrors} />
      <details className="more-details" open={moreOpen}>
        <summary>{t("pieceForm.moreDetails")}</summary>
        <div className="pt-3"><PieceMoreDetails value={value} onChange={onChange} error={error} /></div>
      </details>
      {error && Object.keys(err).length === 0 && <p role="alert" className="error-text">{error.message}</p>}
      <div className="flex justify-end gap-2"><Button type="submit" variant="primary" size="lg" loading={busy}>{submitLabel}</Button></div>
    </form>
  );
}
