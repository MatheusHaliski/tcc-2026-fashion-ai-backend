"use client";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { label } from "@/lib/api/taxonomy";
import { Card, cn } from "@/components/ui";
import { countryName } from "@/components/globe";
import { BrandLogo } from "@/components/brand-logo";
import { displayScore, levelForScore, levelTone } from "@/lib/hype/model";
import type { HypeLevel } from "@/lib/hype/types";
import { finiteRankRows, growthBar, hypeBarWidth, volumeBarWidths, volumeValue } from "@/lib/explorer/rank-bars";

/** Linha de ranking: rótulo e valor; no Hype v2 também a faixa e quantos itens públicos sustentam a média. */
export interface RankRow { label: string; value: number; level?: HypeLevel | null; items?: number | null; hex?: string | null; }
/** Rankings de Hype v2 (P2-04): só `publicEligible`, grupos com ≥ minItems; crescimento (TREND) separado de volume. */
export interface InsightsHype { algorithmVersion?: string | null; minItems?: number; byCategory?: RankRow[]; byColor?: RankRow[]; byBrand?: RankRow[]; bySeason?: RankRow[]; growthByCategory?: RankRow[]; }
export interface Insights { rankings: Record<string, RankRow[]>; hype?: InsightsHype | null; aiInsight?: string; explanation?: unknown; fallbackUsed?: boolean; note?: string; }
type RowKind = "category" | "color" | "brand" | "season" | "country";
const RANK_LABEL: Record<string, string> = { get topBrands() { return tr("explorer.marcas_mais_usadas_pecas"); }, get topColors() { return tr("explorer.cores_mais_usadas"); }, get topCountries() { return tr("explorer.paises_com_mais_looks_publicos"); } };

/** Faixa do Hype sempre com o nome em texto (a cor do chip só acompanha). */
export function LevelChip({ level }: { level: HypeLevel }) {
  const { t } = useI18n();
  return <span className={cn("hype-level-chip", levelTone(level))}>{t(`hype.level.${level}`)}</span>;
}

/** Nome de exibição de uma linha de ranking conforme o tipo do grupo. */
function rowName(kind: RowKind, raw: string) {
  if (kind === "country") return countryName(raw);
  if (kind === "season") return label(raw.toLowerCase());
  if (kind === "brand") return raw;
  return label(raw);
}

function RowName({ kind, row }: { kind: RowKind; row: RankRow }) {
  const name = rowName(kind, String(row.label));
  return (
    <span className="xp-row-name">
      {row.hex && <span className="xp-dot" style={{ background: row.hex }} aria-hidden="true" />}
      {kind === "brand" && <BrandLogo name={name} size={20} />}
      <span className="truncate">{name}</span>
    </span>
  );
}

/** Card de ranking de Hype v2: média 0–100 (barra na escala absoluta), faixa em texto e base de itens públicos. */
function HypeRankCard({ title, kind, rows, minItems }: { title: string; kind: RowKind; rows?: RankRow[] | null; minItems: number }) {
  const { t } = useI18n();
  const list = finiteRankRows(rows);
  return (
    <Card className="min-w-0"><div data-ranking={kind}>
      <p className="label">{title}</p>
      {list.length === 0 ? <p className="type-caption text-muted">{t("explorer.hype.insufficient_groups", { n: minItems })}</p> : (
        <ul className="fai-list xp-rows type-body-sm" aria-label={title}>{list.map((r, i) => {
          const v = Number(r.value); const level = r.level ?? levelForScore(v);
          return (
            <li key={i} className="xp-row">
              <RowName kind={kind} row={r} />
              <span className="xp-row-val"><b className="tabular">{displayScore(v)}</b>{level && <LevelChip level={level} />}</span>
              <span className="xp-row-bar" aria-hidden="true"><span style={{ width: hypeBarWidth(v) }} /></span>
              <span className="xp-row-meta tabular">{r.items != null ? t("explorer.hype.items", { count: r.items }) : null}</span>
            </li>
          );
        })}</ul>
      )}
    </div></Card>
  );
}

/** Crescimento (dimensão TREND, 50 = estável): barra que sai do meio, número e a direção em texto. Não é volume. */
function GrowthCard({ title, rows, minItems }: { title: string; rows?: RankRow[] | null; minItems: number }) {
  const { t } = useI18n();
  const list = finiteRankRows(rows);
  return (
    <Card className="min-w-0"><div data-ranking="growth">
      <p className="label">{title}</p>
      {list.length === 0 ? <p className="type-caption text-muted">{t("explorer.hype.insufficient_groups", { n: minItems })}</p> : (
        <ul className="fai-list xp-rows type-body-sm" aria-label={title}>{list.map((r, i) => {
          const { shown, dir, left, width } = growthBar(r.value);
          return (
            <li key={i} className="xp-row" data-direction={dir}>
              <RowName kind="category" row={r} />
              <span className="xp-row-val"><b className="tabular">{shown}</b><span className="xp-dir">{t(`explorer.hype.growth_${dir}`)}</span></span>
              <span className="xp-row-bar is-diverging" aria-hidden="true"><span style={{ left, width }} /></span>
              <span className="xp-row-meta tabular">{r.items != null ? t("explorer.hype.items", { count: r.items }) : null}</span>
            </li>
          );
        })}</ul>
      )}
    </div></Card>
  );
}

/** Card de volume (popularidade): contagens de itens públicos, barra relativa ao maior do ranking. */
function VolumeCard({ title, kind, rows }: { title: string; kind: RowKind; rows?: RankRow[] | null }) {
  const { t, fmtNumber } = useI18n();
  const list = rows ?? [];
  const widths = volumeBarWidths(list);
  return (
    <Card className="min-w-0"><div data-ranking={`volume-${kind}`}>
      <p className="label">{title}</p>
      {list.length === 0 ? <p className="type-caption text-muted">{t("explorer.sem_dados_suficientes")}</p> : (
        <ul className="fai-list xp-rows type-body-sm" aria-label={title}>{list.map((r, i) => (
          <li key={i} className="xp-row is-volume">
            <RowName kind={kind} row={r} />
            <span className="xp-row-val"><b className="tabular">{fmtNumber(volumeValue(r.value))}</b></span>
            <span className="xp-row-bar" aria-hidden="true"><span style={{ width: widths[i] }} /></span>
          </li>))}</ul>
      )}
    </div></Card>
  );
}

/**
 * Insights globais (P2-04): a leitura de tendência e três blocos separados — Hype atual (v2 público, com faixa e base),
 * Crescimento (TREND, 50 = estável) e Volume (contagens). Só o bloco `hype` é Hype: sem ele, "Dados insuficientes".
 */
export function GlobalInsights({ data }: { data: Insights }) {
  const { t } = useI18n();
  const h = data.hype ?? null; const min = h?.minItems ?? 3; const r = data.rankings ?? {};
  return (
    <div className="grid gap-4">
      <Card><p className="label">{t("explorer.leitura_de_tendencia", { value: data.fallbackUsed ? t("explorer.motor_local") : t("explorer.ia_rf24") })}</p><p className="type-h2">{data.aiInsight}</p>{data.note && <p className="type-caption text-faint mt-2">{data.note}</p>}</Card>
      <section className="xp-section" aria-labelledby="xp-hype">
        <h2 id="xp-hype" className="type-h3">{t("explorer.hype.section_hype")}</h2>
        <p className="type-caption text-muted">{t("explorer.hype.section_hype_hint", { n: min })}</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <HypeRankCard title={t("explorer.hype.by_category")} kind="category" rows={h?.byCategory} minItems={min} />
          <HypeRankCard title={t("explorer.hype.by_color")} kind="color" rows={h?.byColor} minItems={min} />
          <HypeRankCard title={t("explorer.hype.by_brand")} kind="brand" rows={h?.byBrand} minItems={min} />
          <HypeRankCard title={t("explorer.hype.by_season")} kind="season" rows={h?.bySeason} minItems={min} />
        </div>
      </section>
      <section className="xp-section" aria-labelledby="xp-growth">
        <h2 id="xp-growth" className="type-h3">{t("explorer.hype.section_growth")}</h2>
        <p className="type-caption text-muted">{t("explorer.hype.section_growth_hint")}</p>
        <div className="grid gap-4 md:grid-cols-2"><GrowthCard title={t("explorer.hype.growth_by_category")} rows={h?.growthByCategory} minItems={min} /></div>
      </section>
      <section className="xp-section" aria-labelledby="xp-volume">
        <h2 id="xp-volume" className="type-h3">{t("explorer.hype.section_volume")}</h2>
        <p className="type-caption text-muted">{t("explorer.hype.section_volume_hint")}</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <VolumeCard title={RANK_LABEL.topBrands} kind="brand" rows={r.topBrands} />
          <VolumeCard title={RANK_LABEL.topColors} kind="color" rows={r.topColors} />
          <VolumeCard title={RANK_LABEL.topCountries} kind="country" rows={r.topCountries} />
        </div>
      </section>
    </div>
  );
}
