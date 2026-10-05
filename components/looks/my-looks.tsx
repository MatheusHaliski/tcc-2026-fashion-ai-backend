"use client";
import { useState } from "react";
import Link from "next/link";
import { api, qs } from "@/lib/api/client";
import type { Page, SchemeView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { Dropdown, EmptyState, ErrorState, Pagination, SegmentPicker, SkeletonGrid } from "@/components/ui";
import { SchemeCard } from "@/components/scheme-card";
import { hypeLevelFilter, lookHypeSortOptions } from "@/components/hype/hype-filters";

/** Ocasiões dos filtros de looks (Meus looks e Looks salvos). */
export const LOOK_OCCASIONS = ["casual", "work", "party", "formal", "sport", "travel", "date"] as const;
/** Origem do look — valores de GET /api/me/schemes?kind= ("" = todas). Variação da MESMA lista: SegmentPicker, não aba. */
const KINDS = [["", "common.all"], ["ia", "looks.origin.ai"], ["manual", "looks.origin.manual"], ["remix", "looks.origin.remix"]] as const;
export type LookKind = (typeof KINDS)[number][0];
/** Estado do look — valores de GET /api/me/schemes?state=; arquivados só voltam com state=arquivados. */
const STATES = [["", "common.all"], ["publicados", "looks.state.published"], ["rascunhos", "looks.state.drafts"], ["favoritos", "looks.state.favorites"], ["arquivados", "looks.state.archived"]] as const;
type LookState = (typeof STATES)[number][0];

/**
 * Ordenação dos looks (RF53 · P1-07) — valores de GET /api/me/schemes?sort= ("" = mais recentes). Hype é ORDENAÇÃO e
 * FILTRO, nunca aba; nas listas da própria pessoa vale o Hype pessoal (inclusive dos looks privados).
 */
export function LookSortDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  return <Dropdown label={t("hypeLooks.sort")} prefix={`${t("hypeLooks.sort")}:`} value={value} onChange={onChange}
    options={[{ id: "", label: t("common.mais_recentes") }, ...lookHypeSortOptions().map((o) => ({ id: o.value, label: o.label }))]} />;
}

/** Faixa mínima de Hype (GET /api/me/schemes?hypeLevel=): as mesmas opções do filtro do guarda-roupa. */
function HypeLevelDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const f = hypeLevelFilter();
  return <Dropdown label={f.label} prefix={`${f.label}:`} value={value} onChange={onChange}
    options={[{ id: "", label: t("common.all") }, ...f.options.map((o) => ({ id: o.value, label: o.label }))]} />;
}

/** Origem pedida na URL (?kind=); valor desconhecido vale "todas". */
export const parseLookKind = (v: string | null): LookKind => (KINDS.find(([id]) => id === v)?.[0] ?? "");

/** Filtro de ocasião dos looks ("Ocasião: …"). */
export function OccasionFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  return <Dropdown label={t("common.occasion")} prefix={`${t("common.occasion")}:`} value={value} onChange={onChange}
    options={[{ id: "", label: t("common.all") }, ...LOOK_OCCASIONS.map((o) => ({ id: o, label: label(o) }))]} />;
}

/**
 * Meus looks (gestão, em /looks): todos os looks da pessoa — inclusive rascunhos e arquivados —, com a origem
 * (IA · manual · remix) e os filtros de estado e ocasião. O Lookbook mostra só a vitrine (looks publicados).
 * A origem fica com quem chama (vai para a URL); estado, ocasião, ordenação, faixa de Hype e página são locais.
 * Ordenar ou filtrar por Hype usa o HypeScore v2 PESSOAL (look privado também tem, só para o dono); look sem dados
 * fica por último, nunca como 0.
 */
export function MyLooks({ kind, onKind }: { kind: LookKind; onKind: (k: LookKind) => void }) {
  const { t } = useI18n();
  const [occasion, setOccasion] = useState(""); const [state, setState] = useState<LookState>("");
  const [sort, setSort] = useState(""); const [hypeLevel, setHypeLevel] = useState("");
  // trocar qualquer filtro (inclusive a origem vinda da URL) volta para a primeira página, sem buscar a página velha antes
  const filters = `${kind}|${state}|${occasion}|${sort}|${hypeLevel}`;
  const [paging, setPaging] = useState({ filters, page: 0 });
  const page = paging.filters === filters ? paging.page : 0;
  const { data, loading, error, reload } = useApi<Page<SchemeView>>((signal) => api.get(`/api/me/schemes${qs({ page, size: 12, kind, state, occasion, sort, hypeLevel })}`, { signal }), [page, kind, state, occasion, sort, hypeLevel]);
  const filtered = !!(kind || state || occasion || hypeLevel);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SegmentPicker label={t("looks.origin")} value={kind} onChange={onKind} options={KINDS.map(([id, key]) => ({ id, label: t(key) }))} />
        <Dropdown label={t("closet.state")} prefix={`${t("closet.state")}:`} value={state} onChange={setState} options={STATES.map(([id, key]) => ({ id, label: t(key) }))} />
        <OccasionFilter value={occasion} onChange={setOccasion} />
        <HypeLevelDropdown value={hypeLevel} onChange={setHypeLevel} />
        <LookSortDropdown value={sort} onChange={setSort} />
      </div>
      {(sort || hypeLevel) && <p className="mb-3 type-caption text-muted">{t("hypeLooks.personal_note")}</p>}
      {error ? <ErrorState error={error} onRetry={reload} />
        : loading ? <SkeletonGrid />
        : !data || data.items.length === 0
          ? <EmptyState title={filtered ? t("common.empty") : t("looks.empty")} hint={filtered ? undefined : t("nav.createLookHint")}
              action={filtered ? undefined : <Link href="/schemes/new" className="btn btn-primary">{t("scheme.create")}</Link>} />
          : <><div className="grid-looks">{data.items.map((s) => <SchemeCard key={s.id} scheme={s} />)}</div>
            <Pagination page={data.page} hasMore={data.hasMore} total={data.total} size={data.size} onPage={(p) => setPaging({ filters, page: p })} /></>}
    </>
  );
}
