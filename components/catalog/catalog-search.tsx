"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { catalogApi, enoughToSearch, type CatalogProduct, type CatalogVariant, type DesignTraits, type DiscoverResponse, type MatchReason, type SearchResponse } from "@/lib/api/catalog";
import { label, useTaxonomy } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";
import { CATEGORY_CARDS, type CaptureCategory } from "@/lib/capture/capture-guides";
import { Badge, Button, Chip, Field, Input, Skeleton, cn } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";
import { CategoryCards } from "@/components/catalog/category-cards";
import { BrandAutocomplete, type CatalogBrand } from "@/components/catalog/brand-autocomplete";
import { GarmentGlyph } from "@/components/capture/garment-glyphs";

export interface CatalogSearchContext { category: string; subcategory: string; brand: string; query: string }
const ILLUSTRATION: Record<string, "tshirt" | "pants_back" | "sneaker_side" | "bag" | "dress"> = { upper_piece: "tshirt", lower_piece: "pants_back", shoes_piece: "sneaker_side", accessory_piece: "bag", full_body_piece: "dress" };

/**
 * RF47 · Busca catalogada: categoria → subcategoria → marca → nome/modelo. Duas ou três informações já disparam a busca
 * (e sugestões enquanto digita). Resultados em cards com a foto oficial e o "% compatível" (similaridade da busca, não
 * certeza de que a peça física é aquela — quem confirma é a pessoa). Sem resultado: refinar, procurar nas lojas oficiais
 * da marca ou cair para a própria foto.
 */
export function CatalogSearch({ initial, onPick, onUsePhoto, category: controlledCategory, onContext, pickLabel, noResultHint, browse }: {
  initial?: Partial<CatalogSearchContext>; onPick: (p: CatalogProduct, v: CatalogVariant | null) => void;
  /** Sem ele, a busca não oferece "usar minha foto" (modo embutido no criador de peça, onde a foto fica logo abaixo). */
  onUsePhoto?: (ctx: CatalogSearchContext) => void;
  /** Embutida no criador (RF4): a categoria é a do formulário, escolhida fora — a busca não repete os cards de categoria. */
  category?: string;
  /** Tipo (subcategoria) escolhido na busca segue para o formulário. */
  onContext?: (ctx: Partial<CatalogSearchContext>) => void;
  /** Texto do botão de cada resultado (padrão "É esta"; no provador, "Provar"). */
  pickLabel?: string;
  /** Frase do painel quando não há resultado e não há "usar minha foto" (padrão: preencher os dados abaixo). */
  noResultHint?: string;
  /** Navegar pela loja: só a marca (ou só o tipo) já lista produtos — o provador mostra a vitrine da marca. */
  browse?: boolean;
}) {
  const { t } = useI18n();
  const tax = useTaxonomy();
  const embedded = controlledCategory !== undefined;
  const [ownCategory, setOwnCategory] = useState(initial?.category ?? "");
  const category = embedded ? controlledCategory : ownCategory;
  const setCategory = (c: string) => { setOwnCategory(c); setSubcategory(""); };
  const [subcategory, setSubcategoryState] = useState(initial?.subcategory ?? "");
  const setSubcategory = (s: string) => { setSubcategoryState(s); onContext?.({ subcategory: s }); };
  // categoria trocada fora (modo embutido): o tipo anterior não vale mais
  const prevCat = useRef(category);
  useEffect(() => { if (prevCat.current !== category) { prevCat.current = category; setSubcategoryState(""); } }, [category]);
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [brandRef, setBrandRef] = useState<CatalogBrand | null>(null);
  const [query, setQuery] = useState(initial?.query ?? "");
  const [color, setColor] = useState("");
  const [gender, setGender] = useState("");
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [refine, setRefine] = useState(false);
  const [code, setCode] = useState("");
  const [discover, setDiscover] = useState<{ busy: boolean; result: DiscoverResponse | null }>({ busy: false, result: null });
  const seq = useRef(0);
  const params = useMemo(() => ({ category: category || undefined, subcategory: subcategory || undefined, brand: brand.trim() || undefined,
    q: [query, code].filter((s) => s.trim()).join(" ").trim() || undefined, color: color || undefined }), [category, subcategory, brand, query, code, color]);
  const enough = browse ? !!(brand.trim() || subcategory || category || (params.q ?? "").length >= 2) : enoughToSearch({ brand, subcategory, q: params.q });

  // busca automática com debounce assim que houver contexto suficiente; o botão "Buscar peças" força
  useEffect(() => {
    if (!enough) { setRes(null); return; }
    const n = ++seq.current;
    const ctl = new AbortController();
    const h = setTimeout(() => run(n, ctl.signal), 350);
    return () => { clearTimeout(h); ctl.abort(); };
  }, [params.category, params.subcategory, params.brand, params.q, params.color]); // eslint-disable-line react-hooks/exhaustive-deps

  // sugestões de modelo enquanto digita (com marca ou tipo já escolhidos)
  useEffect(() => {
    if (query.trim().length < 2 || (!brand.trim() && !subcategory)) { setSuggestions([]); return; }
    const ctl = new AbortController();
    const h = setTimeout(() => catalogApi.suggestions({ category: params.category, subcategory: params.subcategory, brand: params.brand, q: query }, ctl.signal)
      .then((r) => setSuggestions((r.suggestions ?? []).filter((s) => s.toLowerCase() !== query.trim().toLowerCase()))).catch(() => setSuggestions([])), 300);
    return () => { clearTimeout(h); ctl.abort(); };
  }, [query, brand, subcategory]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(n: number, signal?: AbortSignal) {
    setLoading(true); setError(null); setDiscover({ busy: false, result: null });
    try {
      const r = await catalogApi.search({ ...params, limit: 24 }, signal);
      if (n === seq.current) setRes(r);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      if (n === seq.current) setError(e instanceof ApiError ? e.message : t("catalog.erro_busca"));
    } finally { if (n === seq.current) setLoading(false); }
  }
  async function searchOfficial() {
    setDiscover({ busy: true, result: null });
    try {
      const r = await catalogApi.discover({ brand: params.brand, subcategory: params.subcategory, category: params.category, query: params.q, color: params.color });
      setDiscover({ busy: false, result: r });
    } catch (e) { setDiscover({ busy: false, result: { results: [], status: "NOT_FOUND", message: e instanceof ApiError ? e.message : t("catalog.erro_busca") } }); }
  }
  const ctx: CatalogSearchContext = { category, subcategory, brand: brand.trim(), query: params.q ?? "" };
  const subs = category ? tax?.subcategories?.[category] ?? [] : [];
  const shown = discover.result?.results.length ? discover.result.results : res?.results ?? [];
  const filtered = shown.filter((p) => (!gender || p.gender === gender));
  const colors = Array.from(new Set(shown.flatMap((p) => [p.color, ...(p.variants ?? []).map((v) => v.color)]).filter((c): c is string => !!c)));
  const genders = Array.from(new Set(shown.map((p) => p.gender).filter((g): g is string => !!g)));
  const canSearchOfficial = !!res?.canSearchOfficial && !discover.busy && !discover.result;

  return (
    <div className="grid gap-4">
      {!embedded && <section aria-labelledby="cs-cat">
        <p id="cs-cat" className="label">{t("catalog.q_categoria")}</p>
        <CategoryCards compact columns={3} options={CATEGORY_CARDS} value={(category as CaptureCategory) || null} label={t("catalog.q_categoria")}
          onChange={(c) => setCategory(c)} />
      </section>}
      {category && (
        <section aria-labelledby="cs-sub">
          <p id="cs-sub" className="label">{t("catalog.q_tipo")}</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="cs-sub">
            {subs.map((s) => <Chip key={s} active={subcategory === s} onClick={() => setSubcategory(subcategory === s ? "" : s)}>{label(s)}</Chip>)}
          </div>
        </section>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("catalog.q_marca")} id="cs-brand" hint={brand && res && !res.intent.brandKnown ? t("catalog.marca_desconhecida") : undefined}>
          <BrandAutocomplete id="cs-brand" value={brand} onChange={(name, b) => { setBrand(name); setBrandRef(b); }} />
        </Field>
        <Field label={t("catalog.q_nome")} id="cs-q" hint={t("catalog.q_nome_hint")}>
          <Input id="cs-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholderFor(category, t)} autoComplete="off"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); run(++seq.current); } }} />
          {suggestions.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label={t("catalog.sugestoes")}>{suggestions.map((s) => <Chip key={s} onClick={() => setQuery(s)}>{s}</Chip>)}</div>}
          {query.trim() && res?.intent.design && <DesignUnderstood design={res.intent.design} />}
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => run(++seq.current)} loading={loading} disabled={!enough && !brand && !subcategory}>{t("catalog.buscar_pecas")}</Button>
        {!enough && <span className="type-caption text-muted">{t("catalog.duas_ou_tres_infos")}</span>}
        {onUsePhoto && <Button variant="ghost" size="sm" onClick={() => onUsePhoto(ctx)}>{t("catalog.usar_minha_foto")}</Button>}
      </div>

      {error && <p role="alert" className="error-text">{error}</p>}
      {loading && !res && <div className="grid-cards"><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>}
      {res && (
        <section aria-live="polite" aria-labelledby="cs-results">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 id="cs-results" className="type-h3">
              {discover.result?.results.length ? discover.result.message : filtered.length ? t("catalog.encontramos", { count: filtered.length, tipo: subcategory ? label(subcategory).toLowerCase() : t("common.pieces").toLowerCase(), marca: res.intent.brand ?? "" }) : res.message ?? t("catalog.nao_encontramos")}
            </h2>
            {brandRef && <BrandLogo name={brandRef.name} src={brandRef.logoUrl} size={22} />}
          </div>
          {(colors.length > 1 || genders.length > 1) && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label={t("catalog.filtros_rapidos")}>
              {colors.length > 1 && <><span className="type-caption text-muted">{t("common.color")}:</span>{colors.map((c) => <Chip key={c} active={color === c} onClick={() => setColor(color === c ? "" : c)}><span className="h-3 w-3 rounded-full border border-line-soft" style={{ background: tax?.colors?.[c] ?? "#999" }} />{label(c)}</Chip>)}</>}
              {genders.length > 1 && <><span className="type-caption text-muted ml-2">{t("catalog.genero")}:</span>{genders.map((g) => <Chip key={g} active={gender === g} onClick={() => setGender(gender === g ? "" : g)}>{label(g.toLowerCase())}</Chip>)}</>}
            </div>
          )}
          {filtered.length > 0 && (
            <ul className="grid-cards" aria-label={t("catalog.resultados")}>
              {filtered.map((p) => <li key={p.id}><CatalogResultCard product={p} onPick={(v) => onPick(p, v)} pickLabel={pickLabel} /></li>)}
            </ul>
          )}
          <div className={cn("mt-4 rounded-md border border-line-soft bg-surface-2 p-3", !filtered.length && "border-dashed")}>
            {!filtered.length && !discover.result && <p className="type-body font-medium">{t("catalog.nao_encontramos")}</p>}
            <div className="mt-1 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setRefine((r) => !r)} aria-expanded={refine}>{t("catalog.nao_encontrei")}</Button>
              {canSearchOfficial && <Button size="sm" variant="primary" onClick={searchOfficial}>{t("catalog.pesquisar_lojas_oficiais")}</Button>}
              {onUsePhoto ? <Button size="sm" variant="ghost" onClick={() => onUsePhoto(ctx)}>{t("catalog.adicionar_com_minha_foto")}</Button>
                : <span className="type-body-sm text-muted self-center">{noResultHint ?? t("catalog.ou_preencha_abaixo")}</span>}
            </div>
            {discover.busy && <p className="mt-2 type-body-sm" role="status" aria-live="polite">{t("catalog.procurando_oficiais", { marca: res.intent.brand ?? "" })}</p>}
            {discover.result && !discover.result.results.length && <p className="mt-2 type-body-sm text-muted" role="status">{discover.result.message}</p>}
            {refine && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Field label={t("catalog.codigo_sku")} id="cs-code" hint={t("catalog.codigo_sku_hint")}><Input id="cs-code" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
                <Field label={t("common.color")} id="cs-color">
                  <div className="flex flex-wrap gap-1.5">{(tax ? Object.keys(tax.colors).slice(0, 18) : []).map((c) => <Chip key={c} active={color === c} onClick={() => setColor(color === c ? "" : c)}><span className="h-3 w-3 rounded-full border border-line-soft" style={{ background: tax?.colors?.[c] }} />{label(c)}</Chip>)}</div>
                </Field>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

type T = (k: string, v?: Record<string, unknown>) => string;

/** Rótulo de cada característica única (estampa, posição, tamanho, lados, cores com papel). */
export function designLabels(d: DesignTraits, t: T): string[] {
  const out: string[] = [];
  if (d.pattern) out.push(t(`catalog.design.pattern.${d.pattern}`));
  if (d.logoPlacement && !(d.logoPlacement === "ALLOVER" && d.pattern === "ALLOVER_LOGO")) out.push(t(`catalog.design.placement.${d.logoPlacement}`));
  if (d.logoSize) out.push(t(`catalog.design.size.${d.logoSize}`));
  const sides = d.sides ?? [];
  if (sides.length) out.push(sides.length > 1 ? t("catalog.design.sides.both") : t(`catalog.design.sides.${sides[0]}`));
  (d.baseColors ?? []).forEach((c) => out.push(t("catalog.design.base_color", { cor: label(c).toLowerCase() })));
  (d.printColors ?? []).forEach((c) => out.push(t("catalog.design.print_color", { cor: label(c).toLowerCase() })));
  (d.anyColors ?? []).forEach((c) => out.push(label(c)));
  return out;
}
function reasonLabel(r: MatchReason, t: T): string {
  switch (r.facet) {
    case "pattern": return t(`catalog.design.pattern.${r.value}`);
    case "placement": return t(`catalog.design.placement.${r.value}`);
    case "size": return t(`catalog.design.size.${r.value}`);
    case "sides": return r.value.includes("+") ? t("catalog.design.sides.both") : t(`catalog.design.sides.${r.value}`);
    case "baseColor": return t("catalog.design.base_color", { cor: label(r.value).toLowerCase() });
    case "printColor": return t("catalog.design.print_color", { cor: label(r.value).toLowerCase() });
    default: return label(r.value);
  }
}

/** "Entendemos: logo em toda a peça · frente e verso · cinza · preto" — o que foi lido da descrição digitada. */
function DesignUnderstood({ design }: { design: DesignTraits }) {
  const { t } = useI18n();
  const labels = designLabels(design, t);
  if (!labels.length) return null;
  return (
    <div className="design-understood" role="status" aria-live="polite">
      <span className="type-caption text-muted">{t("catalog.design.entendemos")}</span>
      {labels.map((l) => <span key={l} className="design-chip">{l}</span>)}
      <Badge tone={design.source === "AI" ? "thread" : "chalk"}>{design.source === "AI" ? t("catalog.design.lido_pela_ia") : t("catalog.design.lido_do_texto")}</Badge>
    </div>
  );
}

function placeholderFor(category: string, t: (k: string) => string) {
  return category === "shoes_piece" ? t("catalog.ex_tenis") : category === "lower_piece" ? t("catalog.ex_calca") : t("catalog.ex_camiseta");
}

/** Card de resultado: foto oficial dominante (ou a ilustração da categoria), marca, nome, modelo, cor, tipo e fonte. */
export function CatalogResultCard({ product: p, onPick, pickLabel }: { product: CatalogProduct; onPick: (variant: CatalogVariant | null) => void; pickLabel?: string }) {
  const { t } = useI18n();
  const tax = useTaxonomy();
  const [variant, setVariant] = useState<CatalogVariant | null>(p.selectedVariant ?? null);
  const img = p.imageUrl;
  const source = p.source?.domain && p.source.domain !== "null" ? p.source.domain : t("catalog.fonte_fashionai");
  return (
    <article className="catalog-card surface">
      <div className="catalog-card-media" aria-hidden={!img}>
        {img ? <img src={img} alt={`${p.brand?.name ?? ""} ${p.productName}`} loading="lazy" /> : <GarmentGlyph id={ILLUSTRATION[p.category] ?? "generic"} size={120} animated={false} numbered={false} className="text-muted" />}
        {typeof p.matchPercent === "number" && <Badge tone="thread" className="catalog-card-match">{t("catalog.compativel", { pct: p.matchPercent })}</Badge>}
        {p.ingestionStatus === "DISCOVERED" && <Badge tone="chalk" className="catalog-card-new">{t("catalog.loja_oficial")}</Badge>}
      </div>
      <div className="catalog-card-body">
        <p className="flex items-center gap-1.5 type-caption text-muted"><BrandLogo name={p.brand?.name} src={p.brand?.logoUrl} size={18} />{p.brand?.name}</p>
        <h3 className="type-h3 leading-tight">{p.productName}</h3>
        <p className="type-body-sm text-muted">{[p.modelName && p.modelName !== p.productName ? p.modelName : null, label(p.subcategory)].filter(Boolean).join(" · ")}</p>
        {p.description && <p className="catalog-card-desc type-caption text-muted">{p.description}</p>}
        {(p.matchScore?.reasons?.length ?? 0) > 0 && (
          <ul className="catalog-reasons" aria-label={t("catalog.design.por_que_esta")}>
            {p.matchScore!.reasons!.slice(0, 5).map((r) => (
              <li key={`${r.facet}:${r.value}`} className={cn("catalog-reason", r.ok ? "is-ok" : "is-miss")}>
                <span aria-hidden>{r.ok ? "✓" : "✗"}</span><span className="sr-only">{r.ok ? t("catalog.design.tem") : t("catalog.design.nao_tem")}</span>{reasonLabel(r, t)}
              </li>
            ))}
          </ul>
        )}
        {(p.variants?.length ?? 0) > 1 ? (
          <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label={t("common.color")}>
            {p.variants!.map((v) => <button key={v.id} type="button" className={cn("catalog-swatch", (variant?.id ?? p.selectedVariant?.id) === v.id && "is-active")} title={v.colorName ?? v.color ?? v.key} aria-label={v.colorName ?? v.color ?? v.key} aria-pressed={(variant?.id ?? null) === v.id} onClick={() => setVariant(v)} style={{ background: tax?.colors?.[v.color ?? ""] ?? "var(--surface-3)" }} />)}
          </div>
        ) : p.colorName ? <p className="mt-1 flex items-center gap-1.5 type-body-sm"><span className="h-3 w-3 rounded-full border border-line-soft" style={{ background: p.colorHex ?? undefined }} />{p.colorName}</p> : null}
        <p className="mt-1 type-caption text-faint">{t("catalog.fonte", { fonte: source })}</p>
        <Button variant="primary" size="sm" className="mt-2 self-start" onClick={() => onPick(variant)}>{pickLabel ?? t("catalog.e_esta")}</Button>
      </div>
    </article>
  );
}
