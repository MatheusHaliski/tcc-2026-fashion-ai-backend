"use client";
import { useEffect, useId, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { CATEGORY_KEYS, label } from "@/lib/api/taxonomy";
import { displayScore, hypeViewState, LEVELS } from "@/lib/hype/model";
import { GLOBE_LAYERS, GLOBE_METRICS, globeFiltersFrom, globeSearch, hypeShown, levelRows, metricValue, type GlobeFilters, type GlobeLayer, type GlobeMetric } from "@/lib/hype/globe";
import type { HypeGlobe, HypeGlobeCountry, HypeGlobeTop, HypeLevel } from "@/lib/hype/types";
import { Button, Chip, Dropdown, SegmentPicker, cn } from "@/components/ui";
import { countryName, levelColor } from "@/components/globe";
import { HypeBadge } from "./hype-badge";

const ALL = "__all__";

/**
 * Filtros do globo de Hype na URL (?layers&metric&type&window&category&minLevel&country), como as outras abas do
 * Explorador: o estado acompanha a URL (link, voltar) e cada troca grava com router.replace.
 */
export function useGlobeFilters() {
  const router = useRouter(); const pathname = usePathname(); const sp = useSearchParams();
  const spKey = sp?.toString() ?? "";
  const [f, setF] = useState<GlobeFilters>(() => globeFiltersFrom(sp));
  useEffect(() => {
    const next = globeFiltersFrom(sp);
    setF((cur) => (sameGlobe(cur, next) ? cur : next));
  }, [spKey]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Troca filtros (e, se vier, o país selecionado) e grava na URL. */
  function change(patch: Partial<GlobeFilters>, country?: string) {
    const n: GlobeFilters = { ...f, ...patch };
    setF(n);
    router.replace(`${pathname}?${globeSearch(n, spKey, country)}`, { scroll: false });
  }
  return { f, change, urlCountry: (sp?.get("country") ?? "").trim().toUpperCase() };
}

const sameGlobe = (a: GlobeFilters, b: GlobeFilters) => a.metric === b.metric && a.type === b.type && a.window === b.window && a.category === b.category
  && a.minLevel === b.minLevel && a.layers.length === b.layers.length && a.layers.every((l) => b.layers.includes(l));

/**
 * Barra de filtros dinâmicos ACIMA do globo (uma linha; quebra no celular): CAMADAS (vários ao mesmo tempo), MÉTRICA das
 * colunas, TIPO, JANELA, CATEGORIA e NÍVEL MÍNIMO. Tudo com teclado (chips com aria-pressed, grupos de rádio, listas).
 */
export function HypeGlobeFilterBar({ f, onChange, categories }: { f: GlobeFilters; onChange: (patch: Partial<GlobeFilters>) => void; categories?: string[] | null }) {
  const { t } = useI18n();
  const layersId = useId();
  const toggle = (l: GlobeLayer) => onChange({ layers: f.layers.includes(l) ? f.layers.filter((x) => x !== l) : GLOBE_LAYERS.filter((x) => x === l || f.layers.includes(x)) });
  const cats = (categories?.length ? categories : [...CATEGORY_KEYS]);
  return (
    <div className="globe-filters" role="group" aria-label={t("globeHype.filters")}>
      <div className="globe-filter-layers" role="group" aria-labelledby={layersId}>
        <span id={layersId} className="globe-filter-label">{t("globeHype.layers")}</span>
        {GLOBE_LAYERS.map((l) => (
          <Chip key={l} active={f.layers.includes(l)} onClick={() => toggle(l)} className="globe-layer-chip">
            <LayerGlyph layer={l} />{t(`globeHype.layer.${l}`)}
          </Chip>
        ))}
      </div>
      <Dropdown label={t("globeHype.metric_label")} prefix={t("globeHype.metric_prefix")} value={f.metric}
        options={GLOBE_METRICS.map((m) => ({ id: m, label: t(`globeHype.metric.${m}`) }))} onChange={(v: GlobeMetric) => onChange({ metric: v })} />
      <SegmentPicker label={t("hypeRanking.type")} value={f.type} onChange={(v) => onChange({ type: v })}
        options={[{ id: "PIECE", label: t("hypeRanking.pieces") }, { id: "SCHEME", label: t("hypeRanking.looks") }]} />
      <SegmentPicker label={t("hypeRanking.window")} value={f.window} onChange={(v) => onChange({ window: v })}
        options={[{ id: "1", label: t("hypeRanking.today") }, { id: "7", label: t("hypeRanking.days", { n: 7 }) }, { id: "30", label: t("hypeRanking.days", { n: 30 }) }]} />
      <Dropdown label={t("hypeRanking.category")} prefix={t("globeHype.category_prefix")} value={f.category || ALL}
        options={[{ id: ALL, label: t("hypeRanking.all_categories") }, ...cats.map((c) => ({ id: c, label: label(c) }))]} onChange={(v) => onChange({ category: v === ALL ? "" : v })} />
      <Dropdown label={t("globeHype.min_level")} prefix={t("globeHype.min_level_prefix")} value={f.minLevel || ALL}
        options={[{ id: ALL, label: t("globeHype.any_level") }, ...LEVELS.map((l) => ({ id: l, label: t(`hype.level.${l}`) }))]}
        onChange={(v) => onChange({ minLevel: v === ALL ? "" : (v as HypeLevel) })} />
    </div>
  );
}

/** Ícone mínimo de cada camada (o mesmo desenho da legenda). */
function LayerGlyph({ layer }: { layer: GlobeLayer }) {
  return (
    <svg className={`globe-glyph is-${layer}`} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      {layer === "numbers" && <><rect x="1" y="4" width="14" height="8" rx="4" /><text x="8" y="10.4" textAnchor="middle">9</text></>}
      {layer === "columns" && <><rect x="3" y="7" width="2.6" height="7" rx="1" /><rect x="7" y="3" width="2.6" height="11" rx="1" /><rect x="11" y="9" width="2.6" height="5" rx="1" /></>}
      {layer === "figures" && <><circle cx="8" cy="3.4" r="2" /><path d="M5.6 6.2 Q8 5.2 10.4 6.2 L11.6 11.4 Q8 12.2 4.4 11.4 Z" /><path d="M6.8 12 L6.6 15 M9.2 12 L9.4 15" fill="none" strokeWidth="1.2" /></>}
      {layer === "cards" && <><rect x="1.5" y="3" width="13" height="10" rx="2" fill="none" strokeWidth="1.4" /><rect x="3.4" y="5" width="4" height="6" rx="1" /></>}
      {layer === "heat" && <><circle cx="8" cy="8" r="6.5" opacity=".35" /><circle cx="8" cy="8" r="3.6" opacity=".7" /><circle cx="8" cy="8" r="1.6" /></>}
    </svg>
  );
}

/**
 * Legenda das camadas ligadas, com a mesma codificação do desenho: a cor é SÓ a faixa (com o nome de cada uma), a
 * altura é a métrica (e o maior valor do recorte em texto), o número é o Hype; apagado = abaixo do mínimo de itens.
 */
export function HypeGlobeLegend({ f, data }: { f: GlobeFilters; data?: HypeGlobe | null }) {
  const { t } = useI18n();
  const on = (l: GlobeLayer) => f.layers.includes(l);
  const usesLevel = on("numbers") || on("columns") || on("heat") || on("cards");
  const rows = data?.countries ?? [];
  const best = rows.reduce<{ c: HypeGlobeCountry; v: number } | null>((acc, c) => { const v = metricValue(c, f.metric); return v != null && (!acc || v > acc.v) ? { c, v } : acc; }, null);
  if (!f.layers.length) return <p className="globe-legend-empty type-caption text-muted">{t("globeHype.no_layers")}</p>;
  return (
    <div className="globe-legend" aria-label={t("globeHype.legend")} role="group">
      <ul className="globe-legend-items">
        {on("numbers") && <li><LayerGlyph layer="numbers" /><span>{t(f.metric === "max" ? "globeHype.legend_numbers_max" : "globeHype.legend_numbers_avg")}</span></li>}
        {/* Lote A3: a altura mínima visível também é dita na legenda (não esconder a regra do desenho) */}
        {on("columns") && <li><LayerGlyph layer="columns" /><span>{t("globeHype.legend_columns", { metric: t(`globeHype.metric.${f.metric}`) })}
          {best && <span className="text-muted"> · {t("globeHype.legend_columns_max", { value: Math.round(best.v), country: countryName(best.c.country) })}</span>}
          <span className="text-muted"> · {t("hypeGlobe.legend_columns_min")}</span></span></li>}
        {on("figures") && <li><LayerGlyph layer="figures" /><span>{t("globeHype.legend_figures")}</span></li>}
        {on("cards") && <li><LayerGlyph layer="cards" /><span>{t("globeHype.legend_cards")}</span></li>}
        {on("heat") && <li><LayerGlyph layer="heat" /><span>{t("globeHype.legend_heat")}</span></li>}
        <li><span className="globe-legend-dim" aria-hidden="true" /><span>{t("globeHype.legend_dim", { n: data?.minItems ?? 3 })}</span></li>
      </ul>
      {usesLevel && (
        <ul className="globe-legend-levels" aria-label={t("globeHype.legend_levels")}>
          {LEVELS.map((l) => <li key={l}><i style={{ background: levelColor(l) }} aria-hidden="true" />{t(`hype.level.${l}`)}</li>)}
        </ul>
      )}
    </div>
  );
}

/** "Ver como tabela": os mesmos números do globo numa tabela acessível (o mundo no rodapé). */
export function HypeGlobeTable({ data, metric, selected, onSelect }: { data?: HypeGlobe | null; metric: GlobeMetric; selected?: string; onSelect: (iso: string) => void }) {
  const { t, fmtNumber } = useI18n();
  const rows = data?.countries ?? [];
  const n = (v?: number | null) => (v == null ? "—" : fmtNumber(Math.round(v)));
  if (!rows.length) return <p className="type-body-sm text-muted">{t("globeHype.empty")}</p>;
  return (
    <div className="globe-table-wrap">
      <table className="globe-table">
        <caption>{t("globeHype.table_caption", { metric: t(`globeHype.metric.${metric}`) })}</caption>
        <thead>
          <tr>
            <th scope="col">{t("globeHype.col_country")}</th><th scope="col" className="num">{t("globeHype.col_items")}</th><th scope="col" className="num">{t("globeHype.col_creators")}</th>
            <th scope="col" className="num">{t("globeHype.metric.avg")}</th><th scope="col" className="num">{t("globeHype.metric.max")}</th><th scope="col" className="num">{t("globeHype.metric.growth")}</th><th scope="col">{t("globeHype.col_top_level")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.country} className={cn(!c.sufficient && "is-dim", selected === c.country && "is-selected")}>
              <th scope="row"><button type="button" className="globe-table-country" aria-pressed={selected === c.country} onClick={() => onSelect(c.country)}>{countryName(c.country)}</button>
                {!c.sufficient && <span className="type-caption text-muted"> · {t("globeHype.few_data")}</span>}</th>
              <td className="num tabular">{fmtNumber(c.count)}</td><td className="num tabular">{fmtNumber(c.creators)}</td>
              <td className="num tabular">{n(c.avgHype)}</td><td className="num tabular">{n(c.maxHype)}</td><td className="num tabular">{n(c.trend)}</td>
              <td>{c.topLevel ? <span className="globe-level-cell"><i style={{ background: levelColor(c.topLevel) }} aria-hidden="true" />{t(`hype.level.${c.topLevel}`)}</span> : "—"}</td>
            </tr>
          ))}
        </tbody>
        {data?.world && (
          <tfoot>
            <tr>
              <th scope="row">{t("hypeRanking.world")}</th><td className="num tabular">{fmtNumber(data.world.count)}</td><td className="num tabular">{fmtNumber(data.world.creators)}</td>
              <td className="num tabular">{n(data.world.avgHype)}</td><td className="num tabular">{n(data.world.maxHype)}</td><td className="num">—</td><td>—</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/**
 * Painel do país selecionado: Hype médio e máximo (com a faixa por escrito), quantos estão subindo, crescimento, a
 * distribuição das faixas numa barra pequena (com as contagens em texto) e o card do item de destaque.
 */
export function HypeGlobeCountryPanel({ country, metric, onOpen }: { country?: HypeGlobeCountry | null; metric: GlobeMetric; onOpen: (top: HypeGlobeTop, country: string) => void }) {
  const { t, fmtNumber } = useI18n();
  if (!country) return <p className="type-body-sm text-muted">{t("globeHype.country_empty")}</p>;
  const avg = hypeShown(country, "avg"); const max = hypeShown(country, "max");
  const dist = levelRows(country.levels);
  const total = dist.reduce((s, r) => s + r.count, 0);
  const top = country.top;
  return (
    <section className="globe-country" aria-label={t("globeHype.country_aria", { country: countryName(country.country) })} data-metric={metric}>
      <dl className="globe-country-stats">
        <div><dt>{t("globeHype.metric.avg")}</dt><dd><b className="tabular">{avg.value != null ? displayScore(avg.value) : "—"}</b>{avg.level && <span className="globe-level-cell"><i style={{ background: levelColor(avg.level) }} aria-hidden="true" />{t(`hype.level.${avg.level}`)}</span>}</dd></div>
        <div><dt>{t("globeHype.metric.max")}</dt><dd><b className="tabular">{max.value != null ? displayScore(max.value) : "—"}</b>{max.level && <span className="globe-level-cell"><i style={{ background: levelColor(max.level) }} aria-hidden="true" />{t(`hype.level.${max.level}`)}</span>}</dd></div>
        <div><dt>{t("globeHype.rising")}</dt><dd><b className="tabular">{fmtNumber(country.rising)}</b><span className="text-muted">{t("globeHype.of_items", { count: country.count })}</span></dd></div>
        <div><dt>{t("globeHype.metric.growth")}</dt><dd><b className="tabular">{country.trend != null ? Math.round(country.trend) : "—"}</b><span className="text-muted">{t("globeHype.creators_count", { count: country.creators })}</span></dd></div>
      </dl>
      {!country.sufficient && <p className="type-caption text-muted">{t("globeHype.few_data_hint")}</p>}
      {total > 0 && (
        <div className="globe-dist">
          <p className="label">{t("globeHype.distribution")}</p>
          <div className="globe-dist-bar" role="img" aria-label={dist.map((r) => `${t(`hype.level.${r.level}`)}: ${r.count}`).join(", ")}>
            {dist.map((r) => <span key={r.level} style={{ flexGrow: r.count, background: levelColor(r.level) }} title={`${t(`hype.level.${r.level}`)}: ${r.count}`} />)}
          </div>
          <ul className="globe-dist-list type-caption">{dist.map((r) => <li key={r.level}><i style={{ background: levelColor(r.level) }} aria-hidden="true" />{t(`hype.level.${r.level}`)} <b className="tabular">{r.count}</b></li>)}</ul>
        </div>
      )}
      {top && (
        <div className="globe-top">
          <p className="label">{t("globeHype.top_item")}</p>
          <div className="globe-top-card">
            <span className="globe-top-thumb" aria-hidden="true">{top.imageUrl && <img src={mediaUrl(top.imageUrl)} alt="" loading="lazy" />}</span>
            <span className="min-w-0">
              <span className="globe-top-name">{top.name}</span>
              <span className="type-caption text-muted">{[top.owner?.username ? `@${top.owner.username}` : null, top.category ? label(top.category) : null].filter(Boolean).join(" · ")}</span>
              <HypeBadge state={hypeViewState(top.hype)} summary={top.hype} />
            </span>
            <Button size="sm" onClick={() => onOpen(top, country.country)}>{t("globeHype.open_analysis")}</Button>
          </div>
        </div>
      )}
    </section>
  );
}
